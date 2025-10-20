export const runtime = 'nodejs';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Vector similarity search using CLIP embeddings and cosine distance
 *
 * This endpoint provides three search modes:
 * 1. Pure vector search (embedding only)
 * 2. Hybrid search (vector + tags, weighted combination)
 * 3. Query by item ID (get embedding from existing item)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      itemId,
      embedding,
      tags,
      limit = 10,
      threshold = 0.7,
      mode = 'vector', // 'vector' | 'hybrid' | 'auto'
      vectorWeight = 0.7,
      tagWeight = 0.3,
    } = body;

    if (!itemId && !embedding) {
      return NextResponse.json(
        { error: 'Either itemId or embedding must be provided' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let queryEmbedding = embedding;
    let queryTags = tags || [];

    // If itemId is provided, fetch its embedding and tags
    if (itemId) {
      const { data: targetItem, error: fetchError } = await supabase
        .from('published_items')
        .select('embedding, auto_tags, tags')
        .eq('id', itemId)
        .single();

      if (fetchError || !targetItem) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }

      queryEmbedding = targetItem.embedding;
      queryTags = [...(targetItem.auto_tags || []), ...(targetItem.tags || [])];

      // If no embedding but has tags, return early to let frontend fallback to tag search
      if (!queryEmbedding && queryTags.length > 0) {
        console.log('[vector-search] No embedding but has tags, client should use tag search');
        return NextResponse.json(
          { error: 'No embedding available, use tag search', hasTags: true },
          { status: 400 }
        );
      }
    }

    if (!queryEmbedding) {
      return NextResponse.json(
        { error: 'No embedding available for search' },
        { status: 400 }
      );
    }

    console.log('[vector-search] Search params:', {
      mode,
      hasEmbedding: !!queryEmbedding,
      tagCount: queryTags.length,
      limit,
      threshold,
    });

    // Choose search strategy based on mode
    let results;

    if (mode === 'hybrid' || (mode === 'auto' && queryTags.length > 0)) {
      // Hybrid search: combine vector similarity and tag overlap
      const { data, error } = await supabase.rpc('match_similar_items_hybrid', {
        query_embedding: queryEmbedding,
        query_tags: queryTags,
        match_count: limit,
        vector_weight: vectorWeight,
        tag_weight: tagWeight,
      });

      if (error) {
        console.error('[vector-search] Hybrid search error:', error);
        throw error;
      }

      results = data || [];
      console.log('[vector-search] Hybrid search found', results.length, 'items');
    } else {
      // Pure vector search: cosine similarity only
      const { data, error } = await supabase.rpc('match_similar_items', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error('[vector-search] Vector search error:', error);
        throw error;
      }

      results = data || [];
      console.log('[vector-search] Vector search found', results.length, 'items');
    }

    // Exclude the query item itself if searching by itemId
    if (itemId) {
      results = results.filter((item: any) => item.id !== itemId);
    }

    return NextResponse.json({
      similar_items: results,
      algorithm: mode === 'hybrid' || (mode === 'auto' && queryTags.length > 0)
        ? 'vector_hybrid'
        : 'vector_cosine',
      params: {
        vector_weight: vectorWeight,
        tag_weight: tagWeight,
        threshold,
      },
    });
  } catch (error) {
    console.error('[vector-search] Error:', error);
    return NextResponse.json(
      {
        error: 'Vector search failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
