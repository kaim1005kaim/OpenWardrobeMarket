import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    q: query = '',
    tags = '',
    colors = '',
    price_min,
    price_max,
    vibe = '',
    user_id,
    sort = 'relevance',
    limit = 20,
    offset = 0,
    type = 'all'
  } = req.query;

  try {
    let results: any[] = [];
    let total = 0;

    // Parse filters
    const tagFilters = tags ? (tags as string).split(',').filter(Boolean) : [];
    const colorFilters = colors ? (colors as string).split(',').filter(Boolean) : [];
    const priceMin = price_min ? parseFloat(price_min as string) : null;
    const priceMax = price_max ? parseFloat(price_max as string) : null;

    // Search published items
    if (type === 'published' || type === 'all') {
      const publishedResults = await searchPublishedItems({
        query: query as string,
        tagFilters,
        colorFilters,
        priceMin,
        priceMax,
        vibe: vibe as string,
        sort: sort as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      results = [...results, ...publishedResults.items];
      total += publishedResults.count;
    }

    // Search user's generated items if user_id provided
    if (user_id && (type === 'generated' || type === 'all')) {
      const generatedResults = await searchGeneratedItems({
        query: query as string,
        userId: user_id as string,
        tagFilters,
        colorFilters,
        vibe: vibe as string,
        sort: sort as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      results = [...results, ...generatedResults.items];
      total += generatedResults.count;
    }

    // Apply sorting if mixed results
    if (type === 'all') {
      results = applySorting(results, sort as string);
      results = results.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));
    }

    // Get search suggestions if query is provided
    let suggestions: string[] = [];
    if (query) {
      suggestions = await getSearchSuggestions(query as string);
    }

    res.status(200).json({
      success: true,
      results,
      total,
      suggestions,
      query: query,
      filters: {
        tags: tagFilters,
        colors: colorFilters,
        price_range: { min: priceMin, max: priceMax },
        vibe: vibe
      },
      sort,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: total > parseInt(offset as string) + parseInt(limit as string)
      }
    });

  } catch (error) {
    console.error('[Search API] Error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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

  // Text search in title and description
  if (params.query) {
    queryBuilder = queryBuilder.or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%`);
  }

  // Tag filters
  if (params.tagFilters.length > 0) {
    queryBuilder = queryBuilder.overlaps('tags', params.tagFilters);
  }

  // Color filters
  if (params.colorFilters.length > 0) {
    queryBuilder = queryBuilder.overlaps('colors', params.colorFilters);
  }

  // Price range
  if (params.priceMin !== null) {
    queryBuilder = queryBuilder.gte('price', params.priceMin);
  }
  if (params.priceMax !== null) {
    queryBuilder = queryBuilder.lte('price', params.priceMax);
  }

  // Apply sorting
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
    case 'views':
      queryBuilder = queryBuilder.order('views', { ascending: false });
      break;
    case 'relevance':
    default:
      // For relevance, order by likes and views combined
      queryBuilder = queryBuilder.order('likes', { ascending: false }).order('views', { ascending: false });
      break;
  }

  // Pagination
  queryBuilder = queryBuilder.range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Search published items error:', error);
    return { items: [], count: 0 };
  }

  // Transform data for consistent format
  const items = (data || []).map(item => ({
    ...item,
    type: 'published',
    src: item.image_url,
    r2_url: item.image_url
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
    .eq('user_id', params.userId);

  // Text search in prompt and generation data
  if (params.query) {
    queryBuilder = queryBuilder.or(`prompt.ilike.%${params.query}%`);
  }

  // Apply sorting
  switch (params.sort) {
    case 'newest':
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
      break;
    case 'oldest':
      queryBuilder = queryBuilder.order('created_at', { ascending: true });
      break;
    case 'relevance':
    default:
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
      break;
  }

  // Pagination
  queryBuilder = queryBuilder.range(params.offset, params.offset + params.limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Search generated items error:', error);
    return { items: [], count: 0 };
  }

  // Filter by generation parameters if specified
  let filteredItems = data || [];

  if (params.tagFilters.length > 0 || params.colorFilters.length > 0 || params.vibe) {
    filteredItems = filteredItems.filter(item => {
      const genParams = item.generation_data?.parameters || {};
      
      // Check tag filters
      if (params.tagFilters.length > 0) {
        const itemTags = genParams.tags || [];
        if (!params.tagFilters.some(tag => itemTags.includes(tag))) {
          return false;
        }
      }

      // Check color filters
      if (params.colorFilters.length > 0) {
        const itemColors = genParams.colors || [];
        if (!params.colorFilters.some(color => itemColors.includes(color))) {
          return false;
        }
      }

      // Check vibe filter
      if (params.vibe && genParams.vibe !== params.vibe) {
        return false;
      }

      return true;
    });
  }

  // Transform data for consistent format
  const items = filteredItems.map(item => ({
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

  return { items, count: filteredItems.length };
}

function applySorting(items: any[], sort: string) {
  switch (sort) {
    case 'price_low':
      return items.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_high':
      return items.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'likes':
      return items.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    case 'newest':
      return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'oldest':
      return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case 'views':
      return items.sort((a, b) => (b.views || 0) - (a.views || 0));
    case 'relevance':
    default:
      return items.sort((a, b) => ((b.likes || 0) + (b.views || 0) * 0.1) - ((a.likes || 0) + (a.views || 0) * 0.1));
  }
}

async function getSearchSuggestions(query: string): Promise<string[]> {
  try {
    // Get popular tags that match the query
    const { data: tagData } = await supabase
      .from('published_items')
      .select('tags')
      .not('tags', 'is', null)
      .limit(100);

    const allTags: string[] = [];
    tagData?.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        allTags.push(...item.tags);
      }
    });

    // Count tag frequency and filter by query
    const tagFreq: { [key: string]: number } = {};
    allTags.forEach(tag => {
      if (tag.toLowerCase().includes(query.toLowerCase())) {
        tagFreq[tag] = (tagFreq[tag] || 0) + 1;
      }
    });

    // Return top suggestions
    return Object.entries(tagFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}