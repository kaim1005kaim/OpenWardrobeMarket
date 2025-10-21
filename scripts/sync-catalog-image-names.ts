/**
 * Sync catalog image_id in published_items to match actual R2 file names
 *
 * This fixes the issue where published_items has old long file names
 * (e.g., "catalog/1980s_A_full-body_shot_of_Walter_Van_Beirendonck_st(15).png")
 * but R2 has new short file names (e.g., "catalog/1980s_15.png")
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const r2Bucket = process.env.R2_BUCKET!;
const r2Endpoint = process.env.R2_S3_ENDPOINT!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!r2AccessKeyId || !r2SecretAccessKey || !r2Bucket || !r2Endpoint) {
  console.error('Missing R2 environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

async function listCatalogFiles(): Promise<string[]> {
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: r2Bucket,
      Prefix: 'catalog/',
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && item.Key.endsWith('.png')) {
          files.push(item.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function syncCatalogImageNames() {
  console.log('[sync-catalog-names] Fetching catalog files from R2...');

  const r2Files = await listCatalogFiles();
  console.log(`[sync-catalog-names] Found ${r2Files.length} catalog files in R2`);

  // Get all catalog items from published_items
  const { data: publishedItems, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title, image_id')
    .eq('category', 'catalog');

  if (fetchError) {
    console.error('[sync-catalog-names] Error fetching published items:', fetchError);
    process.exit(1);
  }

  console.log(`[sync-catalog-names] Found ${publishedItems?.length || 0} catalog items in published_items`);

  let updated = 0;
  let notFound = 0;
  let alreadyCorrect = 0;

  for (const item of publishedItems || []) {
    // Skip if image_id is null
    if (!item.image_id) {
      notFound++;
      continue;
    }

    // Check if image_id exists in R2
    const exists = r2Files.includes(item.image_id);

    if (exists) {
      console.log(`[sync-catalog-names] ✓ ${item.image_id} - OK`);
      alreadyCorrect++;
      continue;
    }

    // Try to find matching file by pattern
    // Old: catalog/1980s_A_full-body_shot_of_Walter_Van_Beirendonck_st(15).png
    // New: catalog/1980s_15.png

    const match = item.image_id.match(/catalog\/(19\d{2}s).*\((\d+)\)\.png$/);
    if (match) {
      const decade = match[1];
      const number = match[2];
      const newImageId = `catalog/${decade}_${number}.png`;

      if (r2Files.includes(newImageId)) {
        console.log(`[sync-catalog-names] Updating ${item.id}: ${item.image_id} -> ${newImageId}`);

        const { error: updateError } = await supabase
          .from('published_items')
          .update({ image_id: newImageId })
          .eq('id', item.id);

        if (updateError) {
          console.error(`[sync-catalog-names] Error updating ${item.id}:`, updateError.message);
        } else {
          updated++;
        }
      } else {
        console.warn(`[sync-catalog-names] ⚠ Could not find ${newImageId} in R2`);
        notFound++;
      }
    } else {
      console.warn(`[sync-catalog-names] ⚠ Could not parse pattern from ${item.image_id}`);
      notFound++;
    }
  }

  console.log('\n[sync-catalog-names] Complete:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Not found: ${notFound}`);
}

syncCatalogImageNames().catch((error) => {
  console.error('[sync-catalog-names] Fatal error:', error);
  process.exit(1);
});
