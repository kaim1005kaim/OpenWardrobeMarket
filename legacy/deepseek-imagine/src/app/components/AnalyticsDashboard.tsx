import { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface AnalyticsData {
  overview?: {
    totalGenerations: number;
    publishedItems: number;
    totalLikes: number;
    totalViews: number;
    collectionsCount: number;
    averageLikesPerItem: string;
    averageViewsPerItem: string;
  };
  generationHistory?: {
    totalRecent: number;
    dailyAverage: string;
    dailyChart: { date: string; count: number }[];
    topVibes: { name: string; count: number }[];
    topPalettes: { name: string; count: number }[];
    topSilhouettes: { name: string; count: number }[];
  };
  engagement?: {
    items: any[];
    averageEngagementRate: string;
    bestPerformingItem: any;
    growthRate: { rate: string; trend: string };
  };
  marketplace?: {
    totalMarketplaceItems: number;
    categoryPerformance: any[];
    competitivenessScore: {
      overall: string;
      likes: string;
      views: string;
      pricing: string;
    };
  };
}

interface AnalyticsDashboardProps {
  userId: string;
}

export function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'generation-history' | 'engagement' | 'marketplace'>('overview');
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (type: string) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics?user_id=${userId}&type=${type}`);
      const result = await response.json();

      if (result.success) {
        setData(prev => ({ ...prev, [type.replace('-', '')]: result.data }));
      } else {
        setError(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('[Analytics] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(activeTab);
  }, [activeTab, userId]);

  const tabs = [
    { key: 'overview', label: '概要', icon: Icons.BarChart },
    { key: 'generation-history', label: '生成履歴', icon: Icons.TrendingUp },
    { key: 'engagement', label: 'エンゲージメント', icon: Icons.Heart },
    { key: 'marketplace', label: 'マーケット', icon: Icons.ShoppingBag }
  ];

  if (!userId) {
    return (
      <div className="card p-8 text-center">
        <Icons.Lock className="mx-auto mb-4 text-ink-400" size={48} />
        <h3 className="text-lg font-semibold text-ink-900 mb-2">ログインが必要です</h3>
        <p className="text-ink-600">分析データを表示するにはログインしてください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink-900 mb-2">分析ダッシュボード</h2>
        <p className="text-ink-600">あなたの活動データとインサイトを確認しましょう</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-ink-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-accent shadow-sm'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-ink-600">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              データを読み込んでいます...
            </div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center">
            <Icons.AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">エラーが発生しました</h3>
            <p className="text-ink-600 mb-4">{error}</p>
            <button
              onClick={() => fetchAnalytics(activeTab)}
              className="btn bg-accent text-white border-accent"
            >
              再試行
            </button>
          </div>
        ) : (
          <div>
            {activeTab === 'overview' && <OverviewTab data={data.overview} />}
            {activeTab === 'generation-history' && <GenerationHistoryTab data={data.generationHistory} />}
            {activeTab === 'engagement' && <EngagementTab data={data.engagement} />}
            {activeTab === 'marketplace' && <MarketplaceTab data={data.marketplace} />}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data?: AnalyticsData['overview'] }) {
  if (!data) return <div>データがありません</div>;

  const stats = [
    { label: '総生成数', value: data.totalGenerations, icon: Icons.Sparkles, color: 'text-purple-600' },
    { label: '公開アイテム', value: data.publishedItems, icon: Icons.Eye, color: 'text-blue-600' },
    { label: '総いいね数', value: data.totalLikes, icon: Icons.Heart, color: 'text-red-500' },
    { label: '総ビュー数', value: data.totalViews, icon: Icons.TrendingUp, color: 'text-green-600' },
    { label: 'コレクション', value: data.collectionsCount, icon: Icons.Folder, color: 'text-amber-600' }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-ink-50 mb-3 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-ink-900">{stat.value.toLocaleString()}</div>
            <div className="text-sm text-ink-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">平均パフォーマンス</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-ink-600">アイテムあたりの平均いいね数</span>
              <span className="font-semibold text-ink-900">{data.averageLikesPerItem}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-600">アイテムあたりの平均ビュー数</span>
              <span className="font-semibold text-ink-900">{data.averageViewsPerItem}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">活動サマリー</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Icons.CheckCircle className="text-green-500" size={20} />
              <span className="text-ink-700">
                {data.publishedItems > 0 ? 'マーケットプレイスで活動中' : 'まだ公開アイテムがありません'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Icons.Sparkles className="text-purple-500" size={20} />
              <span className="text-ink-700">
                {data.totalGenerations > 5 ? 'アクティブなクリエイター' : '生成を始めたばかり'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Icons.TrendingUp className="text-blue-500" size={20} />
              <span className="text-ink-700">
                エンゲージメント率: {data.totalViews > 0 ? ((data.totalLikes / data.totalViews) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerationHistoryTab({ data }: { data?: AnalyticsData['generationHistory'] }) {
  if (!data) return <div>データがありません</div>;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-ink-900">{data.totalRecent}</div>
          <div className="text-sm text-ink-600">過去30日の生成数</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-ink-900">{data.dailyAverage}</div>
          <div className="text-sm text-ink-600">1日あたりの平均</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{data.dailyChart?.length || 0}</div>
          <div className="text-sm text-ink-600">アクティブな日数</div>
        </div>
      </div>

      {/* Top Preferences */}
      <div className="grid md:grid-cols-3 gap-6">
        <PreferenceCard title="よく使う雰囲気" items={data.topVibes} />
        <PreferenceCard title="よく使うシルエット" items={data.topSilhouettes} />
        <PreferenceCard title="よく使うカラー" items={data.topPalettes} />
      </div>
    </div>
  );
}

function PreferenceCard({ title, items }: { title: string; items: { name: string; count: number }[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-ink-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {items && items.length > 0 ? (
          items.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  index === 0 ? 'bg-yellow-400' :
                  index === 1 ? 'bg-gray-400' :
                  index === 2 ? 'bg-amber-600' : 'bg-ink-300'
                }`}></div>
                <span className="text-ink-700">{item.name}</span>
              </div>
              <span className="font-semibold text-ink-900">{item.count}</span>
            </div>
          ))
        ) : (
          <p className="text-ink-500 text-sm">データがありません</p>
        )}
      </div>
    </div>
  );
}

function EngagementTab({ data }: { data?: AnalyticsData['engagement'] }) {
  if (!data) return <div>データがありません</div>;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'growing': return <Icons.TrendingUp className="text-green-500" size={16} />;
      case 'declining': return <Icons.TrendingDown className="text-red-500" size={16} />;
      default: return <Icons.Minus className="text-ink-400" size={16} />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'growing': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-ink-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-ink-900">{data.averageEngagementRate}%</div>
          <div className="text-sm text-ink-600">平均エンゲージメント率</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            {getTrendIcon(data.growthRate.trend)}
            <div className={`text-2xl font-bold ${getTrendColor(data.growthRate.trend)}`}>
              {data.growthRate.rate}%
            </div>
          </div>
          <div className="text-sm text-ink-600">成長率</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-ink-900">{data.bestPerformingItem?.likes || 0}</div>
          <div className="text-sm text-ink-600">最高いいね数</div>
        </div>
      </div>

      {/* Best Performing Item */}
      {data.bestPerformingItem && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">🏆 ベストパフォーマンス</h3>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h4 className="font-medium text-ink-900 mb-2">{data.bestPerformingItem.title}</h4>
              <div className="flex items-center gap-4 text-sm text-ink-600">
                <div className="flex items-center gap-1">
                  <Icons.Heart size={14} />
                  {data.bestPerformingItem.likes} いいね
                </div>
                <div className="flex items-center gap-1">
                  <Icons.Eye size={14} />
                  {data.bestPerformingItem.views} ビュー
                </div>
                <div>
                  エンゲージメント率: {data.bestPerformingItem.engagementRate}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Items Performance */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-ink-900 mb-4">最近のアイテム</h3>
        <div className="space-y-4">
          {data.items && data.items.length > 0 ? (
            data.items.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-ink-900 mb-1">{item.title}</div>
                  <div className="text-sm text-ink-600">
                    {new Date(item.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-ink-600">
                    <Icons.Heart size={14} />
                    {item.likes}
                  </div>
                  <div className="flex items-center gap-1 text-ink-600">
                    <Icons.Eye size={14} />
                    {item.views}
                  </div>
                  <div className="text-accent font-medium">
                    {item.engagementRate}%
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-ink-500 text-center py-8">まだ公開アイテムがありません</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketplaceTab({ data }: { data?: AnalyticsData['marketplace'] }) {
  if (!data) return <div>データがありません</div>;

  const getScoreColor = (score: string) => {
    const num = parseFloat(score);
    if (num >= 80) return 'text-green-600';
    if (num >= 60) return 'text-amber-600';
    return 'text-red-600';
  };


  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-ink-900 mb-4">マーケットプレイス概要</h3>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent mb-2">{data.totalMarketplaceItems}</div>
          <div className="text-ink-600">公開中のアイテム数</div>
        </div>
      </div>

      {/* Competitiveness Score */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-ink-900 mb-4">競争力スコア</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(data.competitivenessScore.overall)}`}>
              {data.competitivenessScore.overall}
            </div>
            <div className="text-sm text-ink-600">総合</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(data.competitivenessScore.likes)}`}>
              {data.competitivenessScore.likes}
            </div>
            <div className="text-sm text-ink-600">いいね</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(data.competitivenessScore.views)}`}>
              {data.competitivenessScore.views}
            </div>
            <div className="text-sm text-ink-600">ビュー</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(data.competitivenessScore.pricing)}`}>
              {data.competitivenessScore.pricing}
            </div>
            <div className="text-sm text-ink-600">価格</div>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-ink-900 mb-4">カテゴリ別パフォーマンス</h3>
        <div className="space-y-3">
          {data.categoryPerformance && data.categoryPerformance.length > 0 ? (
            data.categoryPerformance.slice(0, 5).map((category: any) => (
              <div key={category.category} className="flex items-center justify-between p-3 bg-ink-50 rounded-lg">
                <div>
                  <div className="font-medium text-ink-900">{category.category}</div>
                  <div className="text-sm text-ink-600">{category.count} アイテム</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-ink-900">
                    平均 {category.averageLikes} いいね
                  </div>
                  <div className="text-sm text-ink-600">
                    {category.averageViews} ビュー
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-ink-500 text-center py-4">カテゴリデータがありません</p>
          )}
        </div>
      </div>
    </div>
  );
}