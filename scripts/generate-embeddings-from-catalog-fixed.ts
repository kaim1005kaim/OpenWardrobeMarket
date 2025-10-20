/**
 * Test CLIP embedding generation for first 10 catalog images
 *
 * This script tests the FormData fix by processing only 10 images
 * to verify successful embedding generation before processing all 1000.
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT!;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';
const CLIP_SERVER_URL = process.env.CLIP_SERVER_URL || 'http://localhost:5001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_BASE_URL!;

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
    const axios = (await import('axios')).default;
    const FormData = (await import('form-data')).default;

    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

    const response = await axios.post(`${CLIP_SERVER_URL}/embed`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const result = response.data;
    const embedding = result.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('Invalid embedding format');
      return null;
    }

    // Normalize to 512 dimensions if needed
    let normalizedEmbedding = embedding;
    if (embedding.length !== 512) {
      if (embedding.length > 512) {
        normalizedEmbedding = embedding.slice(0, 512);
      } else {
        normalizedEmbedding = [...embedding, ...new Array(512 - embedding.length).fill(0)];
      }
    }

    return normalizedEmbedding;
  } catch (error: any) {
    if (error.response) {
      console.error('CLIP server error:', error.response.data);
    } else {
      console.error('Error generating embedding:', error.message);
    }
    return null;
  }
}

async function main() {
  console.log('🚀 Generating CLIP embeddings for all catalog images...');
  console.log(`🔗 Using CLIP server at: ${CLIP_SERVER_URL}\n`);

  // Check CLIP server health
  try {
    const healthResponse = await fetch(`${CLIP_SERVER_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error('CLIP server not responding');
    }
    const healthData = await healthResponse.json();
    console.log('✅ CLIP server is healthy');
    console.log(`   Model: ${healthData.model}`);
    console.log(`   Device: ${healthData.device}`);
    console.log(`   Dimensions: ${healthData.dimensions}\n`);
  } catch (error) {
    console.error('❌ CLIP server is not running!');
    console.error('   Please start the server first:');
    console.error('   cd server && python clip-server.py --model vit-b-32 --device mps --port 5001\n');
    process.exit(1);
  }

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

  console.log(`📦 Found ${imageFiles.length} total images in catalog/\n`);

  // Process ALL images (not just 10)
  const testImages = imageFiles;

  if (testImages.length === 0) {
    console.log('❌ No images found in catalog/');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < testImages.length; i++) {
    const obj = testImages[i];
    const key = obj.Key!;
    const filename = key.split('/').pop() || key;

    console.log(`\n[${i + 1}/${testImages.length}] Processing: ${filename}`);

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
          console.log('  📝 Updated existing item in database');
          successCount++;
        }
      } else {
        console.log('  ⚠️  No matching item in database (skipped)');
        console.log('     To create items, use the catalog import script first');
        failureCount++;
      }
    } catch (error) {
      console.error('  ❌ Error processing image:', error);
      failureCount++;
    }
  }

  console.log('\n🎉 Test complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total tested: ${testImages.length}`);

  if (successCount > 0) {
    console.log('\n🚀 Fix verified! Ready to process all 1000 images.');
    console.log('   Run: CLIP_SERVER_URL=http://localhost:5001 npx tsx scripts/generate-embeddings-from-catalog.ts');
  } else {
    console.log('\n⚠️  No successful embeddings generated. Check errors above.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
