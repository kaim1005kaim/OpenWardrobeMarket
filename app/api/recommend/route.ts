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
  const userId = searchParams.get('user_id');
  const type = searchParams.get('type') ?? 'personalized';
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);

  try {
    let recommendations: any[] = [];

    switch (type) {
      case 'personalized':
        if (!userId) {
          recommendations = await getTrendingItems(limit);
        } else {
          recommendations = await getPersonalizedRecommendations(userId, limit);
        }
        break;
      case 'trending':
        recommendations = await getTrendingItems(limit);
        break;
      case 'similar': {
        const itemId = searchParams.get('item_id');
        if (!itemId) {
          return Response.json(
            { error: 'item_id is required for similar recommendations' },
            { status: 400 }
          );
        }
        recommendations = await getSimilarItems(itemId, limit);
        break;
      }
      case 'new':
        recommendations = await getNewItems(limit);
        break;
      case 'category': {
        const categories = searchParams.get('categories');
        if (!categories) {
          return Response.json(
            { error: 'categories parameter is required' },
            { status: 400 }
          );
        }
        const categoryList = categories.split(',').filter(Boolean);
        recommendations = await getCategoryRecommendations(categoryList, limit);
        break;
      }
      default:
        return Response.json({ error: 'Invalid recommendation type' }, { status: 400 });
    }

    return Response.json({
      success: true,
      type,
      recommendations,
      total: recommendations.length
    });
  } catch (error: any) {
    console.error('[Recommend API] Error:', error);
    return Response.json(
      {
        error: 'Failed to get recommendations',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getPersonalizedRecommendations(userId: string, limit: number) {
  try {
    const { data: userHistory } = await supabase
      .from('generation_history')
      .select('generation_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const preferences = analyzeUserPreferences(userHistory || []);

    const { data: likedItems } = await supabase
      .from('published_items')
      .select('tags, colors')
      .gt('likes', 0)
      .limit(10);

    const combinedTags = [
      ...preferences.tags,
      ...(likedItems?.flatMap((item) => item.tags || []) || [])
    ].filter(Boolean);
    const combinedColors = [
      ...preferences.colors,
      ...(likedItems?.flatMap((item) => item.colors || []) || [])
    ].filter(Boolean);

    let query = supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .neq('user_id', userId)
      .order('likes', { ascending: false })
      .limit(limit);

    if (combinedTags.length > 0) {
      query = query.contains('tags', combinedTags.slice(0, 3));
    }

    const { data: recommendations } = await query;

    if (!recommendations || recommendations.length < limit) {
      const trending = await getTrendingItems(limit - (recommendations?.length || 0));
      return [...(recommendations || []), ...trending];
    }

    return recommendations || [];
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    return [];
  }
}

async function getTrendingItems(limit: number) {
  try {
    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .order('likes', { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error('Error getting trending items:', error);
    return [];
  }
}

async function getSimilarItems(itemId: string, limit: number) {
  try {
    const { data: referenceItem, error } = await supabase
      .from('published_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error || !referenceItem) {
      return [];
    }

    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .neq('id', itemId)
      .or(
        `tags.cs.{${(referenceItem.tags || []).join(',')}},colors.cs.{${(
          referenceItem.colors || []
        ).join(',')}}`
      )
      .order('likes', { ascending: false })
      .limit(limit);

    const scored = (data || []).map((item) => {
      let score = 0;

      const tagOverlap = (item.tags || []).filter((tag: string) =>
        (referenceItem.tags || []).includes(tag)
      ).length;
      score += tagOverlap * 2;

      const colorOverlap = (item.colors || []).filter((color: string) =>
        (referenceItem.colors || []).includes(color)
      ).length;
      score += colorOverlap;

      const priceDiff = Math.abs((item.price || 0) - (referenceItem.price || 0));
      if (priceDiff < 2000) score += 2;
      else if (priceDiff < 5000) score += 1;

      return { ...item, similarityScore: score };
    });

    scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    return scored.slice(0, limit);
  } catch (error) {
    console.error('Error getting similar items:', error);
    return [];
  }
}

async function getNewItems(limit: number) {
  try {
    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error('Error getting new items:', error);
    return [];
  }
}

async function getCategoryRecommendations(categories: string[], limit: number) {
  try {
    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_active', true)
      .contains('tags', categories)
      .order('likes', { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error('Error getting category recommendations:', error);
    return [];
  }
}

function analyzeUserPreferences(history: any[]) {
  const tagFrequency: Record<string, number> = {};
  const colorFrequency: Record<string, number> = {};
  const vibeFrequency: Record<string, number> = {};

  history.forEach((item) => {
    const params = item.generation_data?.parameters || {};

    if (params.tags) {
      params.tags.forEach((tag: string) => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    }

    if (params.colors) {
      params.colors.forEach((color: string) => {
        colorFrequency[color] = (colorFrequency[color] || 0) + 1;
      });
    }

    if (params.vibe) {
      vibeFrequency[params.vibe] = (vibeFrequency[params.vibe] || 0) + 1;
    }
  });

  const topTags = Object.entries(tagFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);

  const topColors = Object.entries(colorFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([color]) => color);

  const topVibes = Object.entries(vibeFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([vibe]) => vibe);

  return {
    tags: topTags,
    colors: topColors,
    vibes: topVibes
  };
}
