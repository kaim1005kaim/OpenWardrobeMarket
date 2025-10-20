import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmbeddingsStatus() {
  console.log('🔍 Checking embeddings status...\n');

  const { data, error } = await supabase
    .from('published_items')
    .select('id, title, auto_tags, embedding')
    .order('created_at', { ascending: false});

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const withEmbedding = data.filter(item => item.embedding && item.embedding.length > 0);
  const withoutEmbedding = data.filter(item => !item.embedding || item.embedding.length === 0);
  const withAutoTags = data.filter(item => item.auto_tags && item.auto_tags.length > 0);

  console.log(`📊 Total items: ${data.length}`);
  console.log(`✅ Items WITH embedding: ${withEmbedding.length}`);
  console.log(`❌ Items WITHOUT embedding: ${withoutEmbedding.length}`);
  console.log(`📌 Items WITH auto_tags: ${withAutoTags.length}\n`);

  if (withEmbedding.length > 0) {
    console.log('Items WITH embedding:');
    withEmbedding.forEach((item, index) => {
      const hasTags = item.auto_tags && item.auto_tags.length > 0;
      console.log(`  [${index + 1}] ${item.title} - tags: ${hasTags ? item.auto_tags.join(', ') : '(none)'}`);
    });
  }
}

checkEmbeddingsStatus();
