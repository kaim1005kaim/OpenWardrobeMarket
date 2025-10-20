/**
 * Test similarity search on existing data
 *
 * This script tests the vector similarity search by:
 * 1. Selecting a test item
 * 2. Finding similar items using the vector search API
 * 3. Displaying results with similarity scores
 *
 * Usage:
 *   npx tsx scripts/test-similarity-search.ts [item-id]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const targetId = process.argv[2];

  console.log('🔍 Testing Vector Similarity Search\n');

  // If no ID provided, list available items
  if (!targetId) {
    console.log('📋 Available items with embeddings:');
    const { data: items } = await supabase
      .from('published_items')
      .select('id, title, auto_tags')
      .not('embedding', 'is', null)
      .eq('is_active', true)
      .limit(20);

    if (!items || items.length === 0) {
      console.log('❌ No items with embeddings found.');
      console.log('💡 Run: npx tsx scripts/generate-tag-based-embeddings.ts');
      return;
    }

    items.forEach((item: any, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Tags: ${(item.auto_tags || []).join(', ')}`);
    });

    console.log('\n💡 Usage: npx tsx scripts/test-similarity-search.ts <item-id>');
    return;
  }

  // Fetch target item
  const { data: targetItem, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title, auto_tags, tags, embedding')
    .eq('id', targetId)
    .single();

  if (fetchError || !targetItem) {
    console.error('❌ Item not found:', targetId);
    return;
  }

  console.log('🎯 Target Item:');
  console.log(`   Title: ${targetItem.title}`);
  console.log(`   Auto Tags: ${(targetItem.auto_tags || []).join(', ')}`);
  console.log(`   User Tags: ${(targetItem.tags || []).join(', ')}`);
  console.log(`   Has Embedding: ${!!targetItem.embedding}`);

  if (!targetItem.embedding) {
    console.log('\n❌ This item has no embedding. Run:');
    console.log('   npx tsx scripts/generate-tag-based-embeddings.ts');
    return;
  }

  console.log('\n🔎 Searching for similar items...\n');

  // Test pure vector search
  console.log('━━━ Method 1: Pure Vector Search (Cosine Similarity) ━━━');
  const { data: vectorResults, error: vectorError } = await supabase
    .rpc('match_similar_items', {
      query_embedding: targetItem.embedding,
      match_threshold: 0.0, // Show all results
      match_count: 10,
    });

  if (vectorError) {
    console.error('Error:', vectorError);
  } else {
    displayResults(vectorResults, targetId);
  }

  // Test hybrid search
  const allTags = [...(targetItem.auto_tags || []), ...(targetItem.tags || [])];
  if (allTags.length > 0) {
    console.log('\n━━━ Method 2: Hybrid Search (Vector + Tags) ━━━');
    const { data: hybridResults, error: hybridError } = await supabase
      .rpc('match_similar_items_hybrid', {
        query_embedding: targetItem.embedding,
        query_tags: allTags,
        match_count: 10,
        vector_weight: 0.7,
        tag_weight: 0.3,
      });

    if (hybridError) {
      console.error('Error:', hybridError);
    } else {
      displayHybridResults(hybridResults, targetId);
    }
  }

  console.log('\n✅ Test complete!');
}

function displayResults(results: any[], excludeId: string) {
  if (!results || results.length === 0) {
    console.log('   No similar items found.');
    return;
  }

  // Filter out the target item itself
  const filtered = results.filter(r => r.id !== excludeId);

  if (filtered.length === 0) {
    console.log('   No similar items found (excluding self).');
    return;
  }

  filtered.forEach((item, index) => {
    const similarity = ((1 - (item.similarity || 0)) * 100).toFixed(1);
    console.log(`\n${index + 1}. ${item.title}`);
    console.log(`   Similarity: ${similarity}%`);
    console.log(`   Tags: ${(item.auto_tags || []).join(', ')}`);
  });
}

function displayHybridResults(results: any[], excludeId: string) {
  if (!results || results.length === 0) {
    console.log('   No similar items found.');
    return;
  }

  // Filter out the target item itself
  const filtered = results.filter(r => r.id !== excludeId);

  if (filtered.length === 0) {
    console.log('   No similar items found (excluding self).');
    return;
  }

  filtered.forEach((item, index) => {
    const vectorSim = (item.vector_similarity * 100).toFixed(1);
    const tagSim = (item.tag_similarity * 100).toFixed(1);
    const combined = (item.combined_score * 100).toFixed(1);

    console.log(`\n${index + 1}. ${item.title}`);
    console.log(`   Combined Score: ${combined}%`);
    console.log(`   ├─ Vector: ${vectorSim}% (weight: 70%)`);
    console.log(`   └─ Tags: ${tagSim}% (weight: 30%)`);
    console.log(`   Tags: ${(item.auto_tags || []).join(', ')}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
