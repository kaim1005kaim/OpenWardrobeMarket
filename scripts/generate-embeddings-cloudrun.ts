/**
 * Generate CLIP embeddings for existing items using Cloud Run CLIP server
 *
 * This script:
 * 1. Fetches all published items without embeddings
 * 2. Downloads images from R2
 * 3. Sends to Cloud Run CLIP server
 * 4. Stores embeddings in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLIP_SERVER_URL = 'https://openwadrobemarket-623835591545.europe-west1.run.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Item {
  id: string;
  title: string;
  poster_url: string | null;
  original_url: string | null;
  image_id: string | null;
}

async function generateEmbedding(imageUrl: string): Promise<number[]> {
  console.log(`  Downloading image from: ${imageUrl}`);

  // Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }

  const imageBuffer = await imageResponse.buffer();
  console.log(`  Image size: ${imageBuffer.length} bytes`);

  // Create form data
  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: 'image.jpg',
    contentType: 'image/jpeg',
  });

  // Send to CLIP server
  console.log(`  Sending to CLIP server: ${CLIP_SERVER_URL}/embed`);
  const response = await fetch(`${CLIP_SERVER_URL}/embed`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CLIP server error: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json() as { embedding: number[]; dimension: number };
  console.log(`  ✅ Generated embedding: ${result.dimension} dimensions`);

  return result.embedding;
}

async function main() {
  console.log('🚀 Starting embedding generation for existing items\n');
  console.log(`CLIP Server: ${CLIP_SERVER_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  // Test CLIP server
  console.log('Testing CLIP server...');
  const healthResponse = await fetch(`${CLIP_SERVER_URL}/health`);
  if (!healthResponse.ok) {
    console.error('❌ CLIP server is not responding');
    console.error('   Please check Cloud Run deployment');
    process.exit(1);
  }
  const healthData = await healthResponse.json();
  console.log('✅ CLIP server is healthy:', healthData);
  console.log('');

  // Get items without embeddings
  const { data: items, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title, poster_url, original_url, image_id')
    .is('embedding', null)
    .limit(100);

  if (fetchError) {
    console.error('❌ Error fetching items:', fetchError);
    return;
  }

  if (!items || items.length === 0) {
    console.log('✅ All items already have embeddings!');
    return;
  }

  console.log(`Found ${items.length} items without embeddings\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] Processing: ${item.title || 'Untitled'}`);
    console.log(`  Item ID: ${item.id}`);

    try {
      // Try to get image URL in order of preference
      const imageUrl = item.poster_url || item.original_url ||
        (item.image_id ? `https://assets.open-wardrobe-market.com/${item.image_id}` : null);

      if (!imageUrl) {
        console.log('  ⚠️  No image URL available, skipping');
        skippedCount++;
        continue;
      }

      console.log(`  Using image URL: ${imageUrl}`);

      // Generate embedding
      const embedding = await generateEmbedding(imageUrl);

      // Store in database
      const { error: updateError } = await supabase
        .from('published_items')
        .update({ embedding: `[${embedding.join(',')}]` })
        .eq('id', item.id);

      if (updateError) {
        console.error(`  ❌ Failed to update database:`, updateError.message);
        errorCount++;
        continue;
      }

      console.log(`  ✅ Embedding saved to database`);
      successCount++;

      // Rate limiting: wait 1 second between requests
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  📊 Total: ${items.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
