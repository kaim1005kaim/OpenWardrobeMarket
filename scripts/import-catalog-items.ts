/**
 * Import catalog images as published_items
 *
 * Creates published_items records for all catalog images in R2,
 * preparing them for CLIP embedding generation.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT!;
const R2_BUCKET = process.env.R2_BUCKET || 'owm-assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_BASE_URL!;
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

async function main() {
  console.log('📦 Importing catalog images as published_items...\n');

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

  console.log(`📦 Found ${imageFiles.length} catalog images\n`);

  if (imageFiles.length === 0) {
    console.log('✅ No images found');
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  let failureCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const obj = imageFiles[i];
    const key = obj.Key!;
    const filename = key.split('/').pop() || key;

    console.log(`[${i + 1}/${imageFiles.length}] ${filename}`);

    try {
      // Check if item already exists
      const { data: existingItems } = await supabase
        .from('published_items')
        .select('id')
        .eq('title', filename)
        .limit(1);

      if (existingItems && existingItems.length > 0) {
        console.log('  ⏭️  Already exists');
        skipCount++;
        continue;
      }

      // Create new published_item
      const imageUrl = `${R2_PUBLIC_URL}/${key}`;

      const { error: insertError } = await supabase
        .from('published_items')
        .insert({
          title: filename,
          description: `Catalog image: ${filename}`,
          price: 0,
          category: 'catalog',
          tags: [],
          auto_tags: [],
          is_active: true,
          user_id: null, // System/catalog item
          image_id: null, // No associated image record
        });

      if (insertError) {
        console.log(`  ❌ Failed: ${insertError.message}`);
        failureCount++;
      } else {
        console.log('  ✅ Imported');
        successCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failureCount++;
    }
  }

  console.log('\n🎉 Import complete!');
  console.log(`✅ Imported: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total: ${imageFiles.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
