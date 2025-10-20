/**
 * Generate pseudo-embeddings from auto_tags for existing items
 *
 * This creates a 512-dimensional vector based on tag presence,
 * allowing similarity search without actual image embeddings.
 *
 * Method: Tag hashing + normalization
 * - Each tag is hashed to 8 dimensions
 * - Final vector is normalized to unit length
 *
 * Usage:
 *   npx tsx scripts/generate-tag-based-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EMBEDDING_DIM = 512;
const TAGS_PER_DIM = 8; // Each tag influences 8 dimensions

/**
 * Generate a pseudo-embedding from tags
 *
 * Algorithm:
 * 1. For each tag, compute hash
 * 2. Use hash to determine which dimensions to affect
 * 3. Add weighted contribution to those dimensions
 * 4. Normalize to unit vector
 */
function generateTagEmbedding(tags: string[]): number[] {
  const vector = new Array(EMBEDDING_DIM).fill(0);

  if (!tags || tags.length === 0) {
    // Return zero vector for items without tags
    return vector;
  }

  // Weight tags by position (earlier tags are more important)
  tags.forEach((tag, index) => {
    const weight = 1.0 / (index + 1); // 1.0, 0.5, 0.33, 0.25, ...
    const hash = crypto.createHash('sha256').update(tag.toLowerCase()).digest();

    // Use hash bytes to select dimensions
    for (let i = 0; i < TAGS_PER_DIM; i++) {
      const dimIndex = hash.readUInt16BE(i * 2) % EMBEDDING_DIM;
      const value = (hash.readUInt8(i) / 255) * 2 - 1; // Map to [-1, 1]
      vector[dimIndex] += value * weight;
    }
  });

  // Normalize to unit vector (for cosine similarity)
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return vector.map(val => val / magnitude);
  }

  return vector;
}

async function main() {
  console.log('🚀 Generating tag-based embeddings for existing items...');

  // Fetch all items with auto_tags but no embedding
  const { data: items, error: fetchError } = await supabase
    .from('published_items')
    .select('id, title, auto_tags, tags')
    .is('embedding', null)
    .not('auto_tags', 'is', null)
    .eq('is_active', true)
    .limit(1000);

  if (fetchError) {
    console.error('Error fetching items:', fetchError);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅ No items with tags need embeddings. All done!');
    return;
  }

  console.log(`📦 Found ${items.length} items with tags`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any;
    console.log(`\n[${i + 1}/${items.length}] Processing: ${item.title || item.id}`);

    // Combine auto_tags and user tags
    const allTags = [
      ...(item.auto_tags || []),
      ...(item.tags || []),
    ];

    if (allTags.length === 0) {
      console.warn('  ⚠️  No tags available');
      failureCount++;
      continue;
    }

    console.log(`  📌 Tags (${allTags.length}):`, allTags.slice(0, 5).join(', '), allTags.length > 5 ? '...' : '');

    // Generate pseudo-embedding
    const embedding = generateTagEmbedding(allTags);

    // Update database
    const { error: updateError } = await supabase
      .from('published_items')
      .update({ embedding })
      .eq('id', item.id);

    if (updateError) {
      console.error('  ❌ Failed to update database:', updateError);
      failureCount++;
    } else {
      console.log('  ✅ Tag-based embedding saved successfully');
      successCount++;
    }

    // No rate limiting needed - this is all local computation
  }

  console.log('\n🎉 Batch processing complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total: ${items.length}`);
  console.log('\n💡 Note: These are pseudo-embeddings based on tags.');
  console.log('   For better accuracy, generate real CLIP embeddings when images become available.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
