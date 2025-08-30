import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, type = 'personalized', limit = 20 } = req.query;

  try {
    let recommendations: any[] = [];

    switch (type) {
      case 'personalized':
        if (!user_id) {
          // Return trending items for non-logged-in users
          recommendations = await getTrendingItems(parseInt(limit as string));
        } else {
          // Get personalized recommendations based on user history
          recommendations = await getPersonalizedRecommendations(user_id as string, parseInt(limit as string));
        }
        break;

      case 'trending':
        // Get current trending items
        recommendations = await getTrendingItems(parseInt(limit as string));
        break;

      case 'similar':
        // Get similar items based on a specific item
        const { item_id } = req.query;
        if (!item_id) {
          return res.status(400).json({ error: 'item_id is required for similar recommendations' });
        }
        recommendations = await getSimilarItems(item_id as string, parseInt(limit as string));
        break;

      case 'new':
        // Get newest items
        recommendations = await getNewItems(parseInt(limit as string));
        break;

      case 'category':
        // Get items from specific categories
        const { categories } = req.query;
        if (!categories) {
          return res.status(400).json({ error: 'categories parameter is required' });
        }
        const categoryList = (categories as string).split(',');
        recommendations = await getCategoryRecommendations(categoryList, parseInt(limit as string));
        break;

      default:
        return res.status(400).json({ error: 'Invalid recommendation type' });
    }

    res.status(200).json({
      success: true,
      type,
      recommendations,
      total: recommendations.length
    });

  } catch (error) {
    console.error('[Recommend API] Error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function getPersonalizedRecommendations(userId: string, limit: number) {
  try {
    // Get user's generation history to understand preferences
    const { data: userHistory } = await supabase
      .from('generation_history')
      .select('generation_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Extract user preferences
    const preferences = analyzeUserPreferences(userHistory || []);

    // Get user's liked items
    const { data: likedItems } = await supabase
      .from('published_items')
      .select('tags, colors')
      .gt('likes', 0)
      .limit(10);

    // Combine preferences
    const combinedTags = [...preferences.tags, ...(likedItems?.flatMap(item => item.tags) || [])];
    const combinedColors = [...preferences.colors, ...(likedItems?.flatMap(item => item.colors) || [])];

    // Find items matching user preferences
    let query = supabase
      .from('published_items')
      .select('*')
      .eq('is_public', true)
      .neq('user_id', userId) // Don't recommend user's own items
      .order('likes', { ascending: false })
      .limit(limit);

    // Filter by tags if available
    if (combinedTags.length > 0) {
      query = query.contains('tags', combinedTags.slice(0, 3));
    }

    const { data: recommendations } = await query;

    // If not enough recommendations, fill with trending
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
    // Get items with most likes in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_public', true)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('likes', { ascending: false })
      .order('views', { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error('Error getting trending items:', error);
    return [];
  }
}

async function getSimilarItems(itemId: string, limit: number) {
  try {
    // Get the reference item
    const { data: referenceItem } = await supabase
      .from('published_items')
      .select('tags, colors, price')
      .eq('id', itemId)
      .single();

    if (!referenceItem) {
      return [];
    }

    // Find items with similar tags and colors
    const { data } = await supabase
      .from('published_items')
      .select('*')
      .eq('is_public', true)
      .neq('id', itemId)
      .or(`tags.cs.{${referenceItem.tags.join(',')}},colors.cs.{${referenceItem.colors.join(',')}}`)
      .order('likes', { ascending: false })
      .limit(limit);

    // Sort by similarity score
    const scored = (data || []).map(item => {
      let score = 0;
      
      // Tag similarity
      const tagOverlap = item.tags.filter((tag: string) => referenceItem.tags.includes(tag)).length;
      score += tagOverlap * 2;
      
      // Color similarity
      const colorOverlap = item.colors.filter((color: string) => referenceItem.colors.includes(color)).length;
      score += colorOverlap;
      
      // Price similarity
      const priceDiff = Math.abs(item.price - referenceItem.price);
      if (priceDiff < 2000) score += 2;
      else if (priceDiff < 5000) score += 1;
      
      return { ...item, similarityScore: score };
    });

    // Sort by similarity score
    scored.sort((a, b) => b.similarityScore - a.similarityScore);

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
      .eq('is_public', true)
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
      .eq('is_public', true)
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
  const tagFrequency: { [key: string]: number } = {};
  const colorFrequency: { [key: string]: number } = {};
  const vibeFrequency: { [key: string]: number } = {};

  history.forEach(item => {
    const params = item.generation_data?.parameters || {};
    
    // Count tags
    if (params.tags) {
      params.tags.forEach((tag: string) => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    }
    
    // Count colors
    if (params.colors) {
      params.colors.forEach((color: string) => {
        colorFrequency[color] = (colorFrequency[color] || 0) + 1;
      });
    }
    
    // Count vibes
    if (params.vibe) {
      vibeFrequency[params.vibe] = (vibeFrequency[params.vibe] || 0) + 1;
    }
  });

  // Get top preferences
  const topTags = Object.entries(tagFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);

  const topColors = Object.entries(colorFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([color]) => color);

  const topVibes = Object.entries(vibeFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([vibe]) => vibe);

  return {
    tags: topTags,
    colors: topColors,
    vibes: topVibes
  };
}