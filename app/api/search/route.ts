export const runtime = 'nodejs';
export const revalidate = 0;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q') ?? '';
  const tags = searchParams.get('tags') ?? '';
  const colors = searchParams.get('colors') ?? '';
  const priceMinParam = searchParams.get('price_min');
  const priceMaxParam = searchParams.get('price_max');
  const vibe = searchParams.get('vibe') ?? '';
  const userId = searchParams.get('user_id') ?? undefined;
  const sort = searchParams.get('sort') ?? 'relevance';
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const type = searchParams.get('type') ?? 'all';

  try {
    let results: any[] = [];
    let total = 0;

    const tagFilters = tags ? tags.split(',').filter(Boolean) : [];
    const colorFilters = colors ? colors.split(',').filter(Boolean) : [];
    const priceMin = priceMinParam ? parseFloat(priceMinParam) : null;
    const priceMax = priceMaxParam ? parseFloat(priceMaxParam) : null;

    if (type === 'published' || type === 'all') {
      const publishedResults = await searchPublishedItems({
        query,
        tagFilters,
        colorFilters,
        priceMin,
        priceMax,
        vibe,
        sort,
        limit,
        offset
      });
      results = [...results, ...publishedResults.items];
      total += publishedResults.count;
    }

    if (userId && (type === 'generated' || type === 'all')) {
      const generatedResults = await searchGeneratedItems({
        query,
        userId,
        tagFilters,
        colorFilters,
        vibe,
        sort,
        limit,
        offset
      });
      results = [...results, ...generatedResults.items];
      total += generatedResults.count;
    }

    if (type === 'all') {
      results = applySorting(results, sort);
      results = results.slice(offset, offset + limit);
    }

    let suggestions: string[] = [];
    if (query) {
      suggestions = await getSearchSuggestions(query);
    }

    return Response.json({
      success: true,
      results,
      total,
      suggestions,
      query,
      filters: {
        tags: tagFilters,
        colors: colorFilters,
        price_range: { min: priceMin, max: priceMax },
        vibe
      },
      sort,
      pagination: {
        limit,
        offset,
        has_more: total > offset + limit
      }
    });
  } catch (error: any) {
    console.error('[Search API] Error:', error);
    return Response.json(
      {
        error: 'Search failed',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function searchPublishedItems(params: {
  query: string;
  tagFilters: string[];
  colorFilters: string[];
  priceMin: number | null;
  priceMax: number | null;
  vibe: string;
  sort: string;
  limit: number;
  offset: number;
}) {
  let queryBuilder = supabase
    .from('published_items')
    .select('*', { count: 'exact' })
    .eq('is_public', true);

  if (params.query) {
    queryBuilder = queryBuilder.ilike('title', `%${params.query}%`);
  }

  if (params.tagFilters.length > 0) {
    queryBuilder = queryBuilder.contains('tags', params.tagFilters);
  }

  if (params.colorFilters.length > 0) {
    queryBuilder = queryBuilder.contains('colors', params.colorFilters);
  }

  if (params.priceMin !== null) {
    queryBuilder = queryBuilder.gte('price', params.priceMin);
  }

  if (params.priceMax !== null) {
    queryBuilder = queryBuilder.lte('price', params.priceMax);
  }

  if (params.vibe) {
    queryBuilder = queryBuilder.contains('tags', [params.vibe]);
  }

  switch (params.sort) {
    case 'price_low':
      queryBuilder = queryBuilder.order('price', { ascending: true });
      break;
    case 'price_high':
      queryBuilder = queryBuilder.order('price', { ascending: false });
      break;
    case 'likes':
      queryBuilder = queryBuilder.order('likes', { ascending: false });
      break;
    case 'newest':
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
      break;
    case 'oldest':
      queryBuilder = queryBuilder.order('created_at', { ascending: true });
      break;
    case 'relevance':
    default:
      queryBuilder = queryBuilder.order('likes', { ascending: false });
      break;
  }

  queryBuilder = queryBuilder.range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Search published items error:', error);
    return { items: [], count: 0 };
  }

  const items = (data || []).map((item) => ({
    ...item,
    type: 'published'
  }));

  return { items, count: count || 0 };
}

async function searchGeneratedItems(params: {
  query: string;
  userId: string;
  tagFilters: string[];
  colorFilters: string[];
  vibe: string;
  sort: string;
  limit: number;
  offset: number;
}) {
  let queryBuilder = supabase
    .from('generation_history')
    .select('*', { count: 'exact' })
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false });

  if (params.query) {
    queryBuilder = queryBuilder.ilike('prompt', `%${params.query}%`);
  }

  queryBuilder = queryBuilder.range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Search generated items error:', error);
    return { items: [], count: 0 };
  }

  let filteredItems = (data || []).filter((item) => {
    const genParams = item.generation_data?.parameters || {};

    if (params.tagFilters.length > 0) {
      const itemTags = genParams.tags || [];
      if (!params.tagFilters.some((tag) => itemTags.includes(tag))) {
        return false;
      }
    }

    if (params.colorFilters.length > 0) {
      const itemColors = genParams.colors || [];
      if (!params.colorFilters.some((color) => itemColors.includes(color))) {
        return false;
      }
    }

    if (params.vibe && genParams.vibe !== params.vibe) {
      return false;
    }

    return true;
  });

  const items = filteredItems.map((item) => ({
    ...item,
    type: 'generated',
    title: item.generation_data?.title || 'Generated Design',
    src: item.r2_url || item.images?.[0]?.url || '',
    tags: item.generation_data?.parameters?.tags || [],
    colors: item.generation_data?.parameters?.colors || [],
    likes: 0,
    views: 0,
    is_published: false
  }));

  return { items, count: count || 0 };
}

function applySorting(items: any[], sort: string) {
  const copy = [...items];
  switch (sort) {
    case 'price_low':
      return copy.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_high':
      return copy.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'likes':
      return copy.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case 'oldest':
      return copy.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case 'views':
      return copy.sort((a, b) => (b.views || 0) - (a.views || 0));
    case 'relevance':
    default:
      return copy.sort(
        (a, b) => (b.likes || 0) + (b.views || 0) * 0.1 - ((a.likes || 0) + (a.views || 0) * 0.1)
      );
  }
}

async function getSearchSuggestions(query: string): Promise<string[]> {
  try {
    const { data: tagData } = await supabase
      .from('published_items')
      .select('tags')
      .not('tags', 'is', null)
      .limit(100);

    const allTags: string[] = [];
    tagData?.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        allTags.push(...item.tags);
      }
    });

    const tagFreq: Record<string, number> = {};
    allTags.forEach((tag) => {
      if (tag.toLowerCase().includes(query.toLowerCase())) {
        tagFreq[tag] = (tagFreq[tag] || 0) + 1;
      }
    });

    return Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}
