/**
 * Generate CLIP embeddings for user-generated items without embeddings
 *
 * Processes images from R2 and updates published_items with vector embeddings
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
  console.log('🚀 Generating embeddings for user-generated items...');
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
    console.log(`   Dimensions: ${healthData.dimension}\n`);
  } catch (error) {
    console.error('❌ CLIP server is not running!');
    console.error('   Please start the server first:');
    console.error('   cd server && python clip-server.py --model vit-b-32 --device mps --port 5001\n');
    process.exit(1);
  }

  // Get user-generated items without embeddings
  const { data: items, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title, image_id')
    .neq('category', 'catalog')
    .is('embedding', null)
    .not('image_id', 'is', null);

  if (fetchError) {
    console.error('❌ Error fetching items:', fetchError);
    return;
  }

  console.log(`📦 Found ${items.length} user items without embeddings\n`);

  if (items.length === 0) {
    console.log('✅ All user items already have embeddings!');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] Processing: ${item.title}`);
    console.log(`  Item ID: ${item.id}`);
    console.log(`  Image ID: ${item.image_id}`);

    try {
      // Get image URL from images table
      const { data: imageData, error: imageError } = await supabase
        .from('images')
        .select('r2_url')
        .eq('id', item.image_id)
        .single();

      if (imageError || !imageData || !imageData.r2_url) {
        console.log('  ❌ No R2 URL found for image');
        failureCount++;
        continue;
      }

      console.log(`  📥 Downloading from R2...`);

      // Extract R2 key from URL
      const r2Key = imageData.r2_url.replace(/^https?:\/\/[^\/]+\//, '');

      // Download image from R2
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
      });

      const getResponse = await s3Client.send(getCommand);
      const imageBuffer = Buffer.from(await getResponse.Body!.transformToByteArray());

      console.log(`  📐 Image size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

      // Generate embedding
      console.log('  🧠 Generating embedding...');
      const embedding = await generateEmbedding(imageBuffer);

      if (!embedding) {
        console.log('  ❌ Failed to generate embedding');
        failureCount++;
        continue;
      }

      console.log('  ✅ Embedding generated');

      // Update database
      const { error: updateError } = await supabase
        .from('published_items')
        .update({ embedding })
        .eq('id', item.id);

      if (updateError) {
        console.error('  ❌ Failed to update database:', updateError);
        failureCount++;
      } else {
        console.log('  💾 Database updated');
        successCount++;
      }
    } catch (error: any) {
      console.error('  ❌ Error processing image:', error.message);
      failureCount++;
    }
  }

  console.log('\n🎉 Processing complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total processed: ${items.length}`);

  // Check final coverage
  const { count: totalCount } = await supabase
    .from('published_items')
    .select('*', { count: 'exact', head: true })
    .neq('category', 'catalog');

  const { count: embeddingsCount } = await supabase
    .from('published_items')
    .select('*', { count: 'exact', head: true })
    .neq('category', 'catalog')
    .not('embedding', 'is', null);

  console.log('\n📊 Final Statistics:');
  console.log(`   Total user items: ${totalCount}`);
  console.log(`   Items with embeddings: ${embeddingsCount}`);
  console.log(`   Coverage: ${totalCount ? ((embeddingsCount! / totalCount) * 100).toFixed(1) : 0}%`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
