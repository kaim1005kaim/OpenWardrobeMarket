import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuery() {
  console.log('🔍 Debug: Checking items without embedding...\n');

  const { data, error } = await supabase
    .from('published_items')
    .select('id, title, auto_tags, tags, embedding')
    .is('embedding', null)
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${data.length} items without embedding:\n`);

  data.forEach((item, index) => {
    console.log(`[${index + 1}] ${item.title}`);
    console.log(`    auto_tags: ${JSON.stringify(item.auto_tags)}`);
    console.log(`    tags: ${JSON.stringify(item.tags)}`);
    console.log(`    embedding: ${item.embedding ? 'exists' : 'null'}`);
    console.log('');
  });

  const withAutoTags = data.filter(item => item.auto_tags && item.auto_tags.length > 0);
  const withTags = data.filter(item => item.tags && item.tags.length > 0);

  console.log(`✅ Items with auto_tags: ${withAutoTags.length}`);
  console.log(`✅ Items with tags: ${withTags.length}`);
}

debugQuery();
