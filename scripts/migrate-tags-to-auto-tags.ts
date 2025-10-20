import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateTags() {
  console.log('🔄 Migrating tags to auto_tags...\n');

  // Get all items without auto_tags
  const { data: items, error } = await supabase
    .from('published_items')
    .select('id, title, tags')
    .or('auto_tags.is.null,auto_tags.eq.{}')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching items:', error);
    return;
  }

  console.log(`📦 Found ${items.length} items without auto_tags\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any;
    console.log(`[${i + 1}/${items.length}] Processing: ${item.title}`);

    try {
      // Get existing tags
      const existingTags = item.tags || [];

      if (!Array.isArray(existingTags) || existingTags.length === 0) {
        console.log('  ⚠️  No tags available');
        failCount++;
        continue;
      }

      console.log(`  📌 Migrating ${existingTags.length} tags: ${existingTags.join(', ')}`);

      // Update database
      const { error: updateError } = await supabase
        .from('published_items')
        .update({ auto_tags: existingTags })
        .eq('id', item.id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        failCount++;
        continue;
      }

      console.log('  ✅ Migrated successfully');
      successCount++;

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${items.length}`);
}

migrateTags();
