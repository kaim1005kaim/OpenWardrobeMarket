export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Find similar items based on auto_tags overlap
 *
 * Algorithm:
 * 1. Get the target item's auto_tags
 * 2. Find items that share at least 2 tags
 * 3. Rank by number of overlapping tags
 * 4. Return top N most similar items
 */
export async function POST(req: NextRequest) {
  try {
    const { itemId, limit = 10 } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to get the target item from published_items first
    let { data: targetItem, error: targetError } = await supabase
      .from('published_items')
      .select('id, auto_tags, tags, category')
      .eq('id', itemId)
      .single();

    // If not found in published_items, try assets table
    if (targetError || !targetItem) {
      console.log('[similar-items] Not found in published_items, trying assets table');
      const { data: assetItem, error: assetError } = await supabase
        .from('assets')
        .select('id, auto_tags, tags, category')
        .eq('id', itemId)
        .single();

      if (assetError || !assetItem) {
        console.error('[similar-items] Target item not found in either table:', { targetError, assetError });
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }

      targetItem = assetItem;
    }

    const targetTags = targetItem.auto_tags || [];
    const targetUserTags = targetItem.tags || [];
    const targetCategory = targetItem.category;

    console.log('[similar-items] Target item:', {
      id: itemId,
      auto_tags: targetTags,
      tags: targetUserTags,
      category: targetCategory,
    });

    if (targetTags.length === 0) {
      // Fallback: if no auto_tags, return random items from same category
      const { data: fallbackItems } = await supabase
        .from('published_items')
        .select('id, title, image_id, auto_tags, tags, category')
        .eq('is_active', true)
        .neq('id', itemId)
        .eq('category', targetCategory || '')
        .limit(limit);

      return NextResponse.json({
        similar_items: fallbackItems || [],
        algorithm: 'category_fallback',
      });
    }

    // Find items with overlapping auto_tags using array overlap operator (&&)
    // PostgreSQL && operator returns true if arrays have any common elements
    const { data: similarItems, error: searchError } = await supabase
      .from('published_items')
      .select('id, title, image_id, auto_tags, tags, category')
      .eq('is_active', true)
      .neq('id', itemId) // Exclude the target item itself
      .filter('auto_tags', 'ov', targetTags) // ov = overlap operator
      .limit(limit * 3); // Get more candidates for ranking

    if (searchError) {
      console.error('[similar-items] Search error:', searchError);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    // Rank by number of overlapping tags (Jaccard similarity)
    const rankedItems = (similarItems || [])
      .map((item) => {
        const itemTags = item.auto_tags || [];
        const overlap = targetTags.filter((tag: string) => itemTags.includes(tag));
        const union = [...new Set([...targetTags, ...itemTags])];

        // Jaccard similarity: |A ∩ B| / |A ∪ B|
        const jaccardSimilarity = union.length > 0 ? overlap.length / union.length : 0;

        // Bonus for same category
        const categoryBonus = item.category === targetCategory ? 0.1 : 0;

        const score = jaccardSimilarity + categoryBonus;

        return {
          ...item,
          similarity_score: score,
          overlapping_tags: overlap,
        };
      })
      .filter((item) => item.similarity_score > 0.1) // Minimum 10% similarity
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    console.log('[similar-items] Found', rankedItems.length, 'similar items');

    return NextResponse.json({
      similar_items: rankedItems,
      algorithm: 'auto_tags_jaccard',
    });
  } catch (error) {
    console.error('[similar-items] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
