import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllAutoTags() {
  console.log('🔍 Checking all auto_tags in database...\n');

  const { data, error } = await supabase
    .from('published_items')
    .select('id, title, auto_tags')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${data.length} total items:\n`);

  const withTags = data.filter(item => item.auto_tags && item.auto_tags.length > 0);
  const withoutTags = data.filter(item => !item.auto_tags || item.auto_tags.length === 0);

  console.log(`✅ Items WITH auto_tags: ${withTags.length}`);
  withTags.forEach((item, index) => {
    console.log(`  [${index + 1}] ${item.title} - ${JSON.stringify(item.auto_tags)}`);
  });

  console.log(`\n❌ Items WITHOUT auto_tags: ${withoutTags.length}`);
}

checkAllAutoTags();
