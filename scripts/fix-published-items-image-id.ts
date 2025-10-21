/**
 * Fix published_items.image_id to use R2 key paths instead of UUIDs
 *
 * This script converts image_id from UUID format (e.g., "dd43e103-e2df-47a3-ba31-1f057870d1df")
 * to R2 key format (e.g., "usergen/1234567890_uuid.png")
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check if a string is a UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function fixPublishedItemsImageIds() {
  console.log('[fix-published-items] Starting migration...');

  // Get all published_items with UUID image_ids (not just user-generated)
  const { data: publishedItems, error: fetchError } = await supabase
    .from('published_items')
    .select('id, image_id, category, original_url');

  if (fetchError) {
    console.error('[fix-published-items] Error fetching published items:', fetchError);
    return;
  }

  console.log(`[fix-published-items] Found ${publishedItems?.length || 0} user-generated items`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of publishedItems || []) {
    // Skip if image_id is already a path (not a UUID)
    if (!isUUID(item.image_id)) {
      console.log(`[fix-published-items] Skipping ${item.id}: already has path format (${item.image_id})`);
      skippedCount++;
      continue;
    }

    console.log(`[fix-published-items] Processing ${item.id} with UUID image_id: ${item.image_id}`);

    // Fetch the corresponding image record
    const { data: imageRecord, error: imageError } = await supabase
      .from('images')
      .select('id, r2_key, r2_url')
      .eq('id', item.image_id)
      .single();

    if (imageError || !imageRecord) {
      console.error(`[fix-published-items] Failed to find image for ${item.id}:`, imageError?.message);
      errorCount++;
      continue;
    }

    // Use r2_key if available, otherwise construct from UUID
    const newImageId = imageRecord.r2_key || `usergen/${imageRecord.id}.png`;

    console.log(`[fix-published-items] Updating ${item.id}: ${item.image_id} -> ${newImageId}`);

    // Update published_items with the R2 key
    const { error: updateError } = await supabase
      .from('published_items')
      .update({ image_id: newImageId })
      .eq('id', item.id);

    if (updateError) {
      console.error(`[fix-published-items] Failed to update ${item.id}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`[fix-published-items] ✓ Updated ${item.id}`);
      fixedCount++;
    }
  }

  console.log('\n[fix-published-items] Migration complete:');
  console.log(`  Fixed: ${fixedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
}

fixPublishedItemsImageIds().catch((error) => {
  console.error('[fix-published-items] Fatal error:', error);
  process.exit(1);
});
