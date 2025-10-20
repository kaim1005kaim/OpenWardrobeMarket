import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAutoTags } from '../src/lib/autoTags';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillAutoTags() {
  console.log('🔄 Backfilling auto_tags for existing items...\n');

  // Get all items without auto_tags
  const { data: items, error } = await supabase
    .from('published_items')
    .select('id, title, image_id')
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
      // Get generation history for this item
      const { data: historyData, error: historyError } = await supabase
        .from('generation_history')
        .select('dna, answers, prompt')
        .eq('image_id', item.image_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (historyError || !historyData) {
        console.log('  ⚠️  No generation history found');
        failCount++;
        continue;
      }

      const dna = historyData.dna || {};
      const answers = historyData.answers || {};
      const prompt = historyData.prompt || '';

      // Generate auto tags
      const autoTags = generateAutoTags({ answers, dna, prompt });

      if (autoTags.length === 0) {
        console.log('  ⚠️  No tags generated');
        failCount++;
        continue;
      }

      console.log(`  📌 Generated ${autoTags.length} tags: ${autoTags.slice(0, 5).join(', ')}...`);

      // Update database
      const { error: updateError } = await supabase
        .from('published_items')
        .update({ auto_tags: autoTags })
        .eq('id', item.id);

      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        failCount++;
        continue;
      }

      console.log('  ✅ Updated successfully');
      successCount++;

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n🎉 Backfill complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${items.length}`);
}

backfillAutoTags();
