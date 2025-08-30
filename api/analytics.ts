import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, type = 'overview' } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    let analytics: any = {};

    switch (type) {
      case 'overview':
        // ユーザーの全体的な統計
        analytics = await getOverviewAnalytics(user_id as string);
        break;
      
      case 'generation-history':
        // 生成履歴の分析
        analytics = await getGenerationAnalytics(user_id as string);
        break;
      
      case 'style-trends':
        // スタイルトレンド分析
        analytics = await getStyleTrends(user_id as string);
        break;
      
      case 'engagement':
        // エンゲージメント分析
        analytics = await getEngagementAnalytics(user_id as string);
        break;
      
      case 'marketplace':
        // マーケットプレイスでのパフォーマンス
        analytics = await getMarketplaceAnalytics(user_id as string);
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid analytics type' });
    }

    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function getOverviewAnalytics(userId: string) {
  // 生成総数
  const { count: totalGenerations } = await supabase
    .from('generation_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // 公開アイテム数
  const { count: publishedItems } = await supabase
    .from('published_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // 総いいね数
  const { data: likesData } = await supabase
    .from('published_items')
    .select('likes')
    .eq('user_id', userId);
  
  const totalLikes = likesData?.reduce((sum, item) => sum + (item.likes || 0), 0) || 0;

  // 総ビュー数
  const { data: viewsData } = await supabase
    .from('published_items')
    .select('views')
    .eq('user_id', userId);
  
  const totalViews = viewsData?.reduce((sum, item) => sum + (item.views || 0), 0) || 0;

  // コレクション数
  const { count: collectionsCount } = await supabase
    .from('collections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return {
    totalGenerations: totalGenerations || 0,
    publishedItems: publishedItems || 0,
    totalLikes: totalLikes,
    totalViews: totalViews,
    collectionsCount: collectionsCount || 0,
    averageLikesPerItem: publishedItems ? (totalLikes / publishedItems).toFixed(1) : 0,
    averageViewsPerItem: publishedItems ? (totalViews / publishedItems).toFixed(1) : 0
  };
}

async function getGenerationAnalytics(userId: string) {
  // 過去30日間の生成履歴
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentGenerations } = await supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  // 日別の生成数を集計
  const dailyGenerations: { [key: string]: number } = {};
  recentGenerations?.forEach(gen => {
    const date = new Date(gen.created_at).toLocaleDateString('ja-JP');
    dailyGenerations[date] = (dailyGenerations[date] || 0) + 1;
  });

  // 最も使用されたパラメータを分析
  const vibeFrequency: { [key: string]: number } = {};
  const paletteFrequency: { [key: string]: number } = {};
  const silhouetteFrequency: { [key: string]: number } = {};

  recentGenerations?.forEach(gen => {
    const params = gen.generation_data?.parameters || {};
    if (params.vibe) vibeFrequency[params.vibe] = (vibeFrequency[params.vibe] || 0) + 1;
    if (params.palette) paletteFrequency[params.palette] = (paletteFrequency[params.palette] || 0) + 1;
    if (params.silhouette) silhouetteFrequency[params.silhouette] = (silhouetteFrequency[params.silhouette] || 0) + 1;
  });

  // 頻度順にソート
  const sortByFrequency = (obj: { [key: string]: number }) => 
    Object.entries(obj)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => ({ name: key, count }));

  return {
    totalRecent: recentGenerations?.length || 0,
    dailyAverage: ((recentGenerations?.length || 0) / 30).toFixed(1),
    dailyChart: Object.entries(dailyGenerations).map(([date, count]) => ({ date, count })),
    topVibes: sortByFrequency(vibeFrequency),
    topPalettes: sortByFrequency(paletteFrequency),
    topSilhouettes: sortByFrequency(silhouetteFrequency),
    generationTimes: analyzeGenerationTimes(recentGenerations || [])
  };
}

async function getStyleTrends(userId: string) {
  // ユーザーのスタイル傾向と全体のトレンドを比較
  const { data: userStyles } = await supabase
    .from('generation_history')
    .select('generation_data')
    .eq('user_id', userId);

  const { data: globalStyles } = await supabase
    .from('generation_history')
    .select('generation_data')
    .limit(1000); // 最新1000件でトレンド分析

  // スタイル分析
  const userStyleMap = analyzeStyles(userStyles || []);
  const globalStyleMap = analyzeStyles(globalStyles || []);

  // トレンドスコア計算
  const trendingStyles = calculateTrendingScore(userStyleMap, globalStyleMap);

  return {
    userPreferences: userStyleMap,
    globalTrends: globalStyleMap,
    trendingStyles: trendingStyles,
    uniquenessScore: calculateUniquenessScore(userStyleMap, globalStyleMap)
  };
}

async function getEngagementAnalytics(userId: string) {
  // エンゲージメント率の計算
  const { data: publishedItems } = await supabase
    .from('published_items')
    .select('id, title, likes, views, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!publishedItems || publishedItems.length === 0) {
    return { message: 'No published items yet' };
  }

  // エンゲージメント率 = (いいね数 / ビュー数) * 100
  const itemsWithEngagement = publishedItems.map(item => ({
    ...item,
    engagementRate: item.views > 0 ? ((item.likes / item.views) * 100).toFixed(1) : 0
  }));

  // 時間帯別のパフォーマンス分析
  const performanceByTime = analyzePerformanceByTime(publishedItems);

  return {
    items: itemsWithEngagement.slice(0, 10), // 最新10件
    averageEngagementRate: calculateAverageEngagement(itemsWithEngagement),
    bestPerformingItem: itemsWithEngagement.sort((a, b) => b.likes - a.likes)[0],
    performanceByTime: performanceByTime,
    growthRate: calculateGrowthRate(publishedItems)
  };
}

async function getMarketplaceAnalytics(userId: string) {
  // マーケットプレイスでのパフォーマンス
  const { data: items } = await supabase
    .from('published_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_public', true);

  if (!items || items.length === 0) {
    return { message: 'No marketplace items yet' };
  }

  // カテゴリ別のパフォーマンス
  const categoryPerformance: { [key: string]: { count: number; totalLikes: number; totalViews: number } } = {};
  
  items.forEach(item => {
    const tags = item.tags || [];
    tags.forEach((tag: string) => {
      if (!categoryPerformance[tag]) {
        categoryPerformance[tag] = { count: 0, totalLikes: 0, totalViews: 0 };
      }
      categoryPerformance[tag].count++;
      categoryPerformance[tag].totalLikes += item.likes || 0;
      categoryPerformance[tag].totalViews += item.views || 0;
    });
  });

  // 価格帯別のパフォーマンス
  const priceRangePerformance = analyzePricePerformance(items);

  return {
    totalMarketplaceItems: items.length,
    categoryPerformance: Object.entries(categoryPerformance)
      .map(([category, stats]) => ({
        category,
        ...stats,
        averageLikes: (stats.totalLikes / stats.count).toFixed(1),
        averageViews: (stats.totalViews / stats.count).toFixed(1)
      }))
      .sort((a, b) => b.totalLikes - a.totalLikes),
    priceRangePerformance: priceRangePerformance,
    competitivenessScore: calculateCompetitivenessScore(items)
  };
}

// ヘルパー関数
function analyzeGenerationTimes(generations: any[]) {
  const hourCounts: { [key: number]: number } = {};
  
  generations.forEach(gen => {
    const hour = new Date(gen.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0];

  return {
    peakHour: peakHour ? `${peakHour[0]}:00` : 'N/A',
    hourlyDistribution: hourCounts
  };
}

function analyzeStyles(items: any[]) {
  const styleMap: { [key: string]: number } = {};
  
  items.forEach(item => {
    const params = item.generation_data?.parameters || {};
    const style = `${params.vibe || 'unknown'}-${params.palette || 'unknown'}`;
    styleMap[style] = (styleMap[style] || 0) + 1;
  });
  
  return styleMap;
}

function calculateTrendingScore(userStyles: any, globalStyles: any) {
  const trending = [];
  
  for (const [style, userCount] of Object.entries(userStyles)) {
    const globalCount = globalStyles[style] || 0;
    const trendScore = globalCount > 0 ? (userCount as number) / globalCount : 0;
    trending.push({ style, score: trendScore, userCount, globalCount });
  }
  
  return trending.sort((a, b) => b.score - a.score).slice(0, 5);
}

function calculateUniquenessScore(userStyles: any, globalStyles: any) {
  const userStyleCount = Object.keys(userStyles).length;
  const uniqueStyles = Object.keys(userStyles).filter(style => !globalStyles[style]).length;
  
  return {
    score: userStyleCount > 0 ? (uniqueStyles / userStyleCount * 100).toFixed(1) : 0,
    uniqueStyles: uniqueStyles,
    totalStyles: userStyleCount
  };
}

function analyzePerformanceByTime(items: any[]) {
  const dayPerformance: { [key: string]: { count: number; totalLikes: number } } = {};
  
  items.forEach(item => {
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
  const total = items.reduce((sum, item) => sum + parseFloat(item.engagementRate), 0);
  return (total / items.length).toFixed(1);
}

function calculateGrowthRate(items: any[]) {
  if (items.length < 2) return { rate: 0, trend: 'stable' };
  
  const sortedItems = items.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const firstHalf = sortedItems.slice(0, Math.floor(items.length / 2));
  const secondHalf = sortedItems.slice(Math.floor(items.length / 2));
  
  const firstHalfLikes = firstHalf.reduce((sum, item) => sum + (item.likes || 0), 0);
  const secondHalfLikes = secondHalf.reduce((sum, item) => sum + (item.likes || 0), 0);
  
  const growthRate = firstHalfLikes > 0 
    ? ((secondHalfLikes - firstHalfLikes) / firstHalfLikes * 100).toFixed(1)
    : 0;
  
  return {
    rate: growthRate,
    trend: parseFloat(growthRate as string) > 0 ? 'growing' : parseFloat(growthRate as string) < 0 ? 'declining' : 'stable'
  };
}

function analyzePricePerformance(items: any[]) {
  const priceRanges = {
    '0-5000': { count: 0, totalLikes: 0 },
    '5000-10000': { count: 0, totalLikes: 0 },
    '10000-20000': { count: 0, totalLikes: 0 },
    '20000+': { count: 0, totalLikes: 0 }
  };
  
  items.forEach(item => {
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
  // 競争力スコア: いいね数、ビュー数、価格のバランスを評価
  const avgLikes = items.reduce((sum, item) => sum + (item.likes || 0), 0) / items.length;
  const avgViews = items.reduce((sum, item) => sum + (item.views || 0), 0) / items.length;
  const avgPrice = items.reduce((sum, item) => sum + (item.price || 0), 0) / items.length;
  
  // 仮想的な業界平均値と比較
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