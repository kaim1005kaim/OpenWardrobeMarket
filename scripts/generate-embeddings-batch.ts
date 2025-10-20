/**
 * Batch generate CLIP embeddings for existing published items
 *
 * This script fetches all published items without embeddings and generates
 * CLIP vectors for them using the Hugging Face API.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings-batch.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - HUGGINGFACE_API_KEY
 *   - R2_PUBLIC_BASE_URL (for resolving image URLs)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_BASE_URL!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!HF_API_KEY) {
  console.error('Missing HUGGINGFACE_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateEmbedding(imageUrl: string): Promise<number[] | null> {
  try {
    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageUrl}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Generate embedding via Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: base64Image,
          options: {
            wait_for_model: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', errorText);
      return null;
    }

    const embedding = await response.json();

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('Invalid embedding format');
      return null;
    }

    // Normalize to 512 dimensions
    let normalizedEmbedding = embedding;
    if (embedding.length !== 512) {
      if (embedding.length > 512) {
        normalizedEmbedding = embedding.slice(0, 512);
      } else {
        normalizedEmbedding = [...embedding, ...new Array(512 - embedding.length).fill(0)];
      }
    }

    return normalizedEmbedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting batch embedding generation...');

  // Fetch all published items without embeddings
  // Join with images table to get the actual R2 URL
  const { data: items, error: fetchError } = await supabase
    .from('published_items')
    .select(`
      id,
      title,
      image_id,
      images (
        id,
        r2_url,
        r2_key
      )
    `)
    .is('embedding', null)
    .eq('is_active', true)
    .limit(1000); // Process in batches

  if (fetchError) {
    console.error('Error fetching items:', fetchError);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅ No items need embeddings. All done!');
    return;
  }

  console.log(`📦 Found ${items.length} items without embeddings`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any;
    console.log(`\n[${i + 1}/${items.length}] Processing: ${item.title || item.id}`);

    // Resolve image URL from joined images table
    const imageData = item.images;
    let imageUrl = null;

    if (imageData) {
      // Use r2_url directly if available
      imageUrl = imageData.r2_url;

      // If only r2_key is available, construct URL
      if (!imageUrl && imageData.r2_key) {
        imageUrl = `${R2_PUBLIC_URL}/${imageData.r2_key}`;
      }
    }

    if (!imageUrl) {
      console.warn('  ⚠️  No image URL available');
      failureCount++;
      continue;
    }

    // Generate embedding
    const embedding = await generateEmbedding(imageUrl);

    if (!embedding) {
      console.warn('  ❌ Failed to generate embedding');
      failureCount++;
      continue;
    }

    // Update database
    const { error: updateError } = await supabase
      .from('published_items')
      .update({ embedding })
      .eq('id', item.id);

    if (updateError) {
      console.error('  ❌ Failed to update database:', updateError);
      failureCount++;
    } else {
      console.log('  ✅ Embedding saved successfully');
      successCount++;
    }

    // Rate limiting: wait 1 second between requests to avoid API throttling
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('\n🎉 Batch processing complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total: ${items.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
