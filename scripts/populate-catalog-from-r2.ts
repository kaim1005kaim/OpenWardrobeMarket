/**
 * Populate published_items.image_id directly from R2 catalog files
 *
 * This updates null image_ids in published_items with actual R2 file paths
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

async function populateCatalogFromR2() {
  console.log('[populate-catalog] Fetching catalog files from R2...');

  const r2Files = await listCatalogFiles();
  console.log(`[populate-catalog] Found ${r2Files.length} catalog files in R2`);

  // Get catalog items with null image_id
  const { data: nullItems, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title')
    .eq('category', 'catalog')
    .is('image_id', null);

  if (fetchError) {
    console.error('[populate-catalog] Error fetching null items:', fetchError);
    process.exit(1);
  }

  console.log(`[populate-catalog] Found ${nullItems?.length || 0} items with null image_id`);

  if (!nullItems || nullItems.length === 0) {
    console.log('[populate-catalog] Nothing to do - all items have image_id');
    return;
  }

  let updated = 0;
  let notFound = 0;

  for (const item of nullItems) {
    // Delete items with null image_id since we can't match them
    console.log(`[populate-catalog] Deleting ${item.id} (${item.title}) - cannot match without image_id`);

    const { error: deleteError } = await supabase
      .from('published_items')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      console.error(`[populate-catalog] Error deleting ${item.id}:`, deleteError.message);
      notFound++;
    } else {
      updated++;
    }
  }

  console.log('\n[populate-catalog] Deleted null image_id items:', updated);
  console.log('[populate-catalog] Now inserting R2 files...');

  // Insert all R2 files as new published_items
  let inserted = 0;
  let skipped = 0;

  for (const filePath of r2Files) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('published_items')
      .select('id')
      .eq('image_id', filePath)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Extract title from filename
    const filename = filePath.replace('catalog/', '').replace('.png', '');
    const title = filename;

    const { error: insertError } = await supabase
      .from('published_items')
      .insert({
        image_id: filePath,
        title,
        category: 'catalog',
        sale_type: 'not_for_sale',
        is_active: true,
      });

    if (insertError) {
      console.error(`[populate-catalog] Error inserting ${filePath}:`, insertError.message);
    } else {
      inserted++;
      if (inserted % 100 === 0) {
        console.log(`[populate-catalog] Inserted ${inserted} items...`);
      }
    }
  }

  console.log('\n[populate-catalog] Complete:');
  console.log(`  Deleted (null image_id): ${updated}`);
  console.log(`  Inserted (new): ${inserted}`);
  console.log(`  Skipped (already exists): ${skipped}`);
}

populateCatalogFromR2().catch((error) => {
  console.error('[populate-catalog] Fatal error:', error);
  process.exit(1);
});
