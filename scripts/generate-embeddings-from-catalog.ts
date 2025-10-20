/**
 * Generate CLIP embeddings for catalog images in R2
 *
 * This script scans the owm-assets/catalog/ directory in R2 and generates
 * embeddings for all images found there.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings-from-catalog.ts
 *
 * Environment variables required:
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_S3_ENDPOINT
 *   - R2_BUCKET
 *   - HUGGINGFACE_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT!;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_BASE_URL!;

if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ENDPOINT || !HF_API_KEY) {
  console.error('Missing required environment variables');
  console.error('Required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT, HUGGINGFACE_API_KEY');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateEmbedding(imageBuffer: Buffer): Promise<number[] | null> {
  try {
    const base64Image = imageBuffer.toString('base64');

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
  console.log('🚀 Scanning catalog images in R2...');

  // List all objects in catalog/ directory
  const listCommand = new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: 'catalog/',
  });

  const listResponse = await s3Client.send(listCommand);
  const objects = listResponse.Contents || [];

  // Filter image files
  const imageFiles = objects.filter(obj => {
    const key = obj.Key || '';
    return /\.(jpg|jpeg|png|webp)$/i.test(key);
  });

  console.log(`📦 Found ${imageFiles.length} images in catalog/`);

  if (imageFiles.length === 0) {
    console.log('✅ No images found in catalog/');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const obj = imageFiles[i];
    const key = obj.Key!;
    const filename = key.split('/').pop() || key;

    console.log(`\n[${i + 1}/${imageFiles.length}] Processing: ${filename}`);

    try {
      // Download image from R2
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      });

      const getResponse = await s3Client.send(getCommand);
      const imageBuffer = Buffer.from(await getResponse.Body!.transformToByteArray());

      console.log(`  📥 Downloaded (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

      // Generate embedding
      const embedding = await generateEmbedding(imageBuffer);

      if (!embedding) {
        console.warn('  ❌ Failed to generate embedding');
        failureCount++;
        continue;
      }

      console.log('  ✅ Embedding generated');

      // Check if item already exists in database
      const imageUrl = `${R2_PUBLIC_URL}/${key}`;

      const { data: existingItems } = await supabase
        .from('published_items')
        .select('id')
        .eq('title', filename)
        .limit(1);

      if (existingItems && existingItems.length > 0) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('published_items')
          .update({ embedding })
          .eq('id', existingItems[0].id);

        if (updateError) {
          console.error('  ❌ Failed to update database:', updateError);
          failureCount++;
        } else {
          console.log('  📝 Updated existing item');
          successCount++;
        }
      } else {
        console.log('  ⚠️  No matching item in database (skipped)');
        console.log('     To create items, use the catalog import script first');
        failureCount++;
      }

      // Rate limiting
      if (i < imageFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('  ❌ Error processing image:', error);
      failureCount++;
    }
  }

  console.log('\n🎉 Processing complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total: ${imageFiles.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
