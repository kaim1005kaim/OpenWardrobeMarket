import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAutoTags() {
  console.log('🔍 Checking auto_tags in database...\n');

  const { data, error } = await supabase
    .from('published_items')
    .select('id, title, auto_tags, ai_description')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${data.length} items:\n`);

  data.forEach((item, index) => {
    console.log(`[${index + 1}] ${item.title}`);
    console.log(`    ID: ${item.id}`);
    console.log(`    auto_tags: ${JSON.stringify(item.auto_tags)}`);
    console.log(`    ai_description: ${item.ai_description || '(empty)'}`);
    console.log('');
  });

  const withTags = data.filter(item => item.auto_tags && item.auto_tags.length > 0);
  const withDescription = data.filter(item => item.ai_description);

  console.log(`✅ Items with auto_tags: ${withTags.length}/${data.length}`);
  console.log(`✅ Items with ai_description: ${withDescription.length}/${data.length}`);
}

checkAutoTags();
