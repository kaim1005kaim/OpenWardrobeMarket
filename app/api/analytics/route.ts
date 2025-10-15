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
  const type = searchParams.get('type') ?? 'overview';

  if (!userId) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    let analytics: any = {};

    switch (type) {
      case 'overview':
        analytics = await getOverviewAnalytics(userId);
        break;
      case 'generation-history':
        analytics = await getGenerationAnalytics(userId);
        break;
      case 'style-trends':
        analytics = await getStyleTrends(userId);
        break;
      case 'engagement':
        analytics = await getEngagementAnalytics(userId);
        break;
      case 'marketplace':
        analytics = await getMarketplaceAnalytics(userId);
        break;
      default:
        return Response.json({ error: 'Invalid analytics type' }, { status: 400 });
    }

    return Response.json({ success: true, data: analytics });
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return Response.json(
      {
        error: 'Failed to fetch analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getOverviewAnalytics(userId: string) {
  const { count: totalGenerations } = await supabase
    .from('generation_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: publishedItems } = await supabase
    .from('published_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: likesData } = await supabase
    .from('published_items')
    .select('likes')
    .eq('user_id', userId);

  const totalLikes = likesData?.reduce((sum, item) => sum + (item.likes || 0), 0) || 0;

  const { data: viewsData } = await supabase
    .from('published_items')
    .select('views')
    .eq('user_id', userId);

  const totalViews = viewsData?.reduce((sum, item) => sum + (item.views || 0), 0) || 0;

  const { count: collectionsCount } = await supabase
    .from('collections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return {
    totalGenerations: totalGenerations || 0,
    publishedItems: publishedItems || 0,
    totalLikes,
    totalViews,
    collectionsCount: collectionsCount || 0,
    averageLikesPerItem: publishedItems ? (totalLikes / publishedItems).toFixed(1) : 0,
    averageViewsPerItem: publishedItems ? (totalViews / publishedItems).toFixed(1) : 0
  };
}

async function getGenerationAnalytics(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentGenerations } = await supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  const dailyGenerations: Record<string, number> = {};
  recentGenerations?.forEach((gen) => {
    const date = new Date(gen.created_at).toLocaleDateString('ja-JP');
    dailyGenerations[date] = (dailyGenerations[date] || 0) + 1;
  });

  const vibeFrequency: Record<string, number> = {};
  const colorPalette: Record<string, number> = {};

  recentGenerations?.forEach((gen) => {
    const params = gen.generation_data?.parameters || {};
    if (params.vibe) {
      vibeFrequency[params.vibe] = (vibeFrequency[params.vibe] || 0) + 1;
    }
    if (params.palette) {
      colorPalette[params.palette] = (colorPalette[params.palette] || 0) + 1;
    }
  });

  return {
    recentGenerations: recentGenerations || [],
    dailyGenerations,
    vibeFrequency,
    colorPalette
  };
}

async function getStyleTrends(userId: string) {
  const { data: userItems } = await supabase
    .from('generation_history')
    .select('generation_data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: globalItems } = await supabase
    .from('generation_history')
    .select('generation_data, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const userStyles = analyzeStyles(userItems || []);
  const globalStyles = analyzeStyles(globalItems || []);

  return {
    userStyleProfile: userStyles,
    trendingStyles: calculateTrendingScore(userStyles, globalStyles),
    uniquenessScore: calculateUniquenessScore(userStyles, globalStyles)
  };
}

async function getEngagementAnalytics(userId: string) {
  const { data: publishedItems } = await supabase
    .from('published_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!publishedItems || publishedItems.length === 0) {
    return {
      performanceByDay: {},
      averageEngagement: 0,
      growthRate: { rate: 0, trend: 'stable' }
    };
  }

  return {
    performanceByDay: analyzePerformanceByTime(publishedItems),
    averageEngagement: calculateAverageEngagement(publishedItems),
    growthRate: calculateGrowthRate(publishedItems)
  };
}

async function getMarketplaceAnalytics(userId: string) {
  const { data: publishedItems } = await supabase
    .from('published_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!publishedItems || publishedItems.length === 0) {
    return {
      pricePerformance: [],
      topSellingStyles: [],
      competitivenessScore: {},
      revenueProjection: { expected: 0, potential: 0 }
    };
  }

  return {
    pricePerformance: analyzePricePerformance(publishedItems),
    topSellingStyles: publishedItems
      .map((item) => ({
        title: item.title,
        tags: item.tags,
        price: item.price,
        likes: item.likes || 0,
        engagementRate: item.engagement_rate || 0
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5),
    competitivenessScore: calculateCompetitivenessScore(publishedItems),
    revenueProjection: {
      expected: publishedItems.reduce((sum, item) => sum + (item.price || 0), 0),
      potential:
        publishedItems.reduce((sum, item) => sum + (item.price || 0), 0) *
        (1 + Math.random() * 0.2)
    }
  };
}

function analyzeStyles(items: any[]) {
  const styleMap: Record<string, number> = {};

  items.forEach((item) => {
    const params = item.generation_data?.parameters || {};
    const style = `${params.vibe || 'unknown'}-${params.palette || 'unknown'}`;
    styleMap[style] = (styleMap[style] || 0) + 1;
  });

  return styleMap;
}

function calculateTrendingScore(userStyles: any, globalStyles: any) {
  const trending: Array<{ style: string; score: number; userCount: number; globalCount: number }> = [];

  for (const [style, userCount] of Object.entries(userStyles)) {
    const globalCount = globalStyles[style] || 0;
    const trendScore = globalCount > 0 ? (userCount as number) / globalCount : 0;
    trending.push({ style, score: trendScore, userCount: userCount as number, globalCount });
  }

  return trending.sort((a, b) => b.score - a.score).slice(0, 5);
}

function calculateUniquenessScore(userStyles: any, globalStyles: any) {
  const userStyleCount = Object.keys(userStyles).length;
  const uniqueStyles = Object.keys(userStyles).filter((style) => !globalStyles[style]).length;

  return {
    score: userStyleCount > 0 ? ((uniqueStyles / userStyleCount) * 100).toFixed(1) : 0,
    uniqueStyles,
    totalStyles: userStyleCount
  };
}

function analyzePerformanceByTime(items: any[]) {
  const dayPerformance: Record<
    string,
    { count: number; totalLikes: number }
  > = {};

  items.forEach((item) => {
    const day = new Date(item.created_at).toLocaleDateString('ja-JP', { weekday: 'short' });
    if (!dayPerformance[day]) {
      dayPerformance[day] = { count: 0, totalLikes: 0 };
    }
    dayPerformance[day].count++;
    dayPerformance[day].totalLikes += item.likes || 0;
  });

  return dayPerformance;
}

function calculateAverageEngagement(items: any[]) {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => {
    const value = Number(item.engagementRate ?? item.engagement_rate ?? 0);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  return (total / items.length).toFixed(1);
}

function calculateGrowthRate(items: any[]) {
  if (items.length < 2) return { rate: 0, trend: 'stable' };

  const sortedItems = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const mid = Math.floor(sortedItems.length / 2);
  const firstHalf = sortedItems.slice(0, mid);
  const secondHalf = sortedItems.slice(mid);

  const firstHalfLikes = firstHalf.reduce((sum, item) => sum + (item.likes || 0), 0);
  const secondHalfLikes = secondHalf.reduce((sum, item) => sum + (item.likes || 0), 0);

  const growthRate =
    firstHalfLikes > 0
      ? (((secondHalfLikes - firstHalfLikes) / firstHalfLikes) * 100).toFixed(1)
      : 0;

  const numericGrowth = parseFloat(growthRate as string);

  return {
    rate: growthRate,
    trend: numericGrowth > 0 ? 'growing' : numericGrowth < 0 ? 'declining' : 'stable'
  };
}

function analyzePricePerformance(items: any[]) {
  const priceRanges: Record<
    string,
    { count: number; totalLikes: number }
  > = {
    '0-5000': { count: 0, totalLikes: 0 },
    '5000-10000': { count: 0, totalLikes: 0 },
    '10000-20000': { count: 0, totalLikes: 0 },
    '20000+': { count: 0, totalLikes: 0 }
  };

  items.forEach((item) => {
    const price = item.price || 0;
    let range = '0-5000';

    if (price >= 20000) range = '20000+';
    else if (price >= 10000) range = '10000-20000';
    else if (price >= 5000) range = '5000-10000';

    priceRanges[range].count++;
    priceRanges[range].totalLikes += item.likes || 0;
  });

  return Object.entries(priceRanges).map(([range, stats]) => ({
    range,
    ...stats,
    averageLikes: stats.count > 0 ? (stats.totalLikes / stats.count).toFixed(1) : 0
  }));
}

function calculateCompetitivenessScore(items: any[]) {
  if (items.length === 0) {
    return { overall: 0, likes: 0, views: 0, pricing: 0 };
  }

  const avgLikes = items.reduce((sum, item) => sum + (item.likes || 0), 0) / items.length;
  const avgViews = items.reduce((sum, item) => sum + (item.views || 0), 0) / items.length;
  const avgPrice = items.reduce((sum, item) => sum + (item.price || 0), 0) / items.length;

  const industryAvgLikes = 10;
  const industryAvgViews = 100;
  const industryAvgPrice = 10000;

  const likesScore = Math.min((avgLikes / industryAvgLikes) * 100, 100);
  const viewsScore = Math.min((avgViews / industryAvgViews) * 100, 100);
  const priceScore = avgPrice > 0 ? Math.min((industryAvgPrice / avgPrice) * 100, 100) : 0;

  return {
    overall: ((likesScore + viewsScore + priceScore) / 3).toFixed(1),
    likes: likesScore.toFixed(1),
    views: viewsScore.toFixed(1),
    pricing: priceScore.toFixed(1)
  };
}
