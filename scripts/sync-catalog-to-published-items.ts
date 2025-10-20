import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncCatalogToPublishedItems() {
  console.log('[sync-catalog] Starting sync from assets to published_items...');

  // Fetch catalog items from assets table
  const { data: catalogAssets, error: fetchError } = await supabase
    .from('assets')
    .select('id, title, tags, final_key, raw_key, created_at, user_id')
    .eq('status', 'public')
    .or('final_key.ilike.catalog/%,raw_key.ilike.catalog/%');

  if (fetchError) {
    console.error('[sync-catalog] Error fetching catalog assets:', fetchError);
    process.exit(1);
  }

  console.log(`[sync-catalog] Found ${catalogAssets?.length || 0} catalog assets`);

  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const asset of catalogAssets || []) {
    const imageKey = asset.final_key || asset.raw_key;

    if (processed === 0) {
      console.log(`[sync-catalog] DEBUG First asset user_id:`, asset.user_id, 'Type:', typeof asset.user_id);
    }

    if (!imageKey || !imageKey.startsWith('catalog/')) {
      skipped++;
      continue;
    }

    // Check if already exists in published_items
    const { data: existing } = await supabase
      .from('published_items')
      .select('id')
      .eq('image_id', imageKey)
      .single();

    if (existing) {
      console.log(`[sync-catalog] Skipping ${imageKey} - already exists`);
      skipped++;
      continue;
    }

    // Insert into published_items
    const insertData = {
      title: asset.title || imageKey.replace('catalog/', '').replace(/\.(png|jpg|jpeg)$/i, ''),
      category: 'catalog',
      image_id: imageKey,
      user_id: null, // Catalog items don't have user_id
      tags: asset.tags || [],
      auto_tags: asset.tags || [],
      sale_type: 'not_for_sale',
      created_at: asset.created_at || new Date().toISOString()
    };

    if (processed === 0) {
      console.log(`[sync-catalog] DEBUG Insert data:`, JSON.stringify(insertData, null, 2));
    }

    const { error: insertError } = await supabase
      .from('published_items')
      .insert(insertData);

    if (insertError) {
      console.error(`[sync-catalog] Error inserting ${imageKey}:`, insertError.message);
      if (processed === 0) {
        console.error(`[sync-catalog] DEBUG Full error:`, insertError);
      }
      errors++;
    } else {
      console.log(`[sync-catalog] ✓ Synced ${imageKey}`);
      synced++;
    }
  }

  console.log(`\n[sync-catalog] Complete!`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

syncCatalogToPublishedItems()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[sync-catalog] Fatal error:', error);
    process.exit(1);
  });
