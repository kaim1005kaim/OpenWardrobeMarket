import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { Asset } from '../../lib/types';
import './MobileMyPage.css';

interface MobileMyPageProps {
  onNavigate?: (page: string) => void;
}

type TabType = 'publish' | 'drafts' | 'collections';

export function MobileMyPage({ onNavigate }: MobileMyPageProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'design' | 'setting'>('design');
  const [activeTab, setActiveTab] = useState<TabType>('publish');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAssets(activeTab);
  }, [activeTab, user]);

  const fetchAssets = async (tab: TabType) => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (tab === 'publish') {
        // 公開済みアイテムを取得
        const { data, error } = await supabase
          .from('published_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const publishedAssets: Asset[] = (data || []).map((item: any) => ({
          id: item.id,
          src: item.poster_url || item.original_url,
          title: item.title,
          tags: item.tags || [],
          price: item.price,
          likes: item.likes || 0,
          w: 800,
          h: 1168,
          isPublic: true,
        }));

        setAssets(publishedAssets);
      } else if (tab === 'drafts') {
        // ドラフト（未公開の生成画像）を取得
        const { data, error } = await supabase
          .from('generation_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('completion_status', 'completed')
          .eq('is_public', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const draftAssets: Asset[] = (data || []).map((item: any) => ({
          id: item.id,
          src: item.image_url || item.preview_url || '',
          title: item.prompt || 'Generated Design',
          tags: ['Generated'],
          type: 'generated' as const,
          price: 0,
          likes: 0,
          w: 800,
          h: 1168,
          isPublic: false,
        }));

        setAssets(draftAssets);
      } else if (tab === 'collections') {
        // お気に入りアイテムを取得
        const { data, error } = await supabase
          .from('likes')
          .select(`
            *,
            published_items!inner(*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const collectionAssets: Asset[] = (data || []).map((item: any) => ({
          id: item.published_items.id,
          src: item.published_items.poster_url || item.published_items.original_url,
          title: item.published_items.title,
          tags: item.published_items.tags || [],
          price: item.published_items.price,
          likes: item.published_items.likes || 0,
          w: 800,
          h: 1168,
        }));

        setAssets(collectionAssets);
      }
    } catch (error) {
      console.error(`Error fetching ${tab} assets:`, error);
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const getSimilarAssets = (asset: Asset) => {
    return assets.filter(a => a.id !== asset.id).slice(0, 6);
  };

  const handleTogglePublish = async (assetId: string, isPublic: boolean) => {
    if (!user) return;

    try {
      if (isPublic) {
        // 公開する：generation_historyからデータを取得してpublished_itemsに登録
        const { data: historyData, error: historyError } = await supabase
          .from('generation_history')
          .select('*')
          .eq('id', assetId)
          .eq('user_id', user.id)
          .single();

        if (historyError) throw historyError;

        // published_itemsに登録（公開フォームをスキップする簡易版）
        const { error: publishError } = await supabase
          .from('published_items')
          .insert({
            user_id: user.id,
            title: historyData.prompt || 'Generated Design',
            description: '',
            poster_url: historyData.image_url,
            original_url: historyData.image_url,
            price: 36323, // デフォルト価格
            tags: ['Generated'],
            category: 'minimal',
            sale_type: 'buyout',
            is_active: true,
          });

        if (publishError) throw publishError;

        // generation_historyのis_publicを更新
        const { error: updateError } = await supabase
          .from('generation_history')
          .update({ is_public: true })
          .eq('id', assetId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        alert('ギャラリーに公開しました');
      } else {
        // 非公開にする：generation_historyのis_publicをfalseに
        const { error } = await supabase
          .from('generation_history')
          .update({ is_public: false })
          .eq('id', assetId)
          .eq('user_id', user.id);

        if (error) throw error;

        // published_itemsから削除
        const { error: deleteError } = await supabase
          .from('published_items')
          .delete()
          .eq('user_id', user.id)
          .eq('original_url', (await supabase
            .from('generation_history')
            .select('image_url')
            .eq('id', assetId)
            .single()).data?.image_url);

        if (deleteError) console.warn('Failed to delete from published_items:', deleteError);

        alert('非公開にしました（Draftsに移動）');
      }

      // アセットリストを再取得
      await fetchAssets(activeTab);
    } catch (error) {
      console.error('Error toggling publish:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!user) return;

    try {
      // generation_historyから削除
      const { error } = await supabase
        .from('generation_history')
        .delete()
        .eq('id', assetId)
        .eq('user_id', user.id);

      if (error) throw error;

      // アセットリストを再取得
      await fetchAssets(activeTab);

      alert('削除しました');
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <>
      <MobileLayout
        showHeader={false}
        showBottomNav={false}
        onMenuClick={() => setIsMenuOpen(true)}
      >
        <div className="mypage-content">
          {/* Header with Menu */}
          <div className="mypage-header">
            <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="header-actions">
              <button className="header-text-btn" onClick={() => onNavigate?.('home')}>OWM</button>
            </div>
          </div>

          {/* Title with Profile */}
          <div className="title-section">
            <h1 className="page-title">MY PAGE</h1>
            <div className="profile-avatar-circle">
              <img
                src={user?.user_metadata?.avatar_url || 'https://via.placeholder.com/120/EEECE6/999?text=User'}
                alt="Profile"
              />
            </div>
          </div>

          {/* Profile Info */}
          <div className="profile-info">
            <button className="profile-name-btn">
              {user?.user_metadata?.username || user?.email?.split('@')[0] || 'JOHN DEANNA'}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 9 12 12 9" />
              </svg>
            </button>
            <div className="profile-rating">
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star empty">☆</span>
            </div>
            <div className="profile-badge">SUBSCRIBED</div>
            <p className="profile-bio">
              プロフィール文章が表示されます。プロフィール文章が表示されます。プロフィール文章が表示されます。プロフィール文章が表示されます。
            </p>
            <button className="more-btn">more</button>
          </div>

          {/* Section Tabs */}
          <div className="section-tabs">
            <button
              className={`section-tab ${activeSection === 'design' ? 'active' : ''}`}
              onClick={() => setActiveSection('design')}
            >
              DESIGN
            </button>
            <button
              className={`section-tab ${activeSection === 'setting' ? 'active' : ''}`}
              onClick={() => setActiveSection('setting')}
            >
              SETTING
            </button>
          </div>

          {activeSection === 'design' && (
            <>
              {/* Sub Tabs */}
              <div className="tabs-container">
                <button
                  className={`tab-btn ${activeTab === 'publish' ? 'active' : ''}`}
                  onClick={() => setActiveTab('publish')}
                >
                  Publish
                </button>
                <button
                  className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('drafts')}
                >
                  Drafts
                </button>
                <button
                  className={`tab-btn ${activeTab === 'collections' ? 'active' : ''}`}
                  onClick={() => setActiveTab('collections')}
                >
                  Collections
                </button>
              </div>

              {/* Grid */}
              <div className="assets-grid">
                {isLoading ? (
                  <div className="loading-message">読み込み中...</div>
                ) : assets.length > 0 ? (
                  assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="asset-card"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="card-image">
                        <img src={asset.src} alt={asset.title} loading="lazy" />
                        {activeTab === 'publish' && asset.price && (
                          <div className="price-badge">¥{asset.price.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>まだ{getTabLabel(activeTab)}がありません</p>
                    {activeTab === 'drafts' && (
                      <button
                        className="create-btn"
                        onClick={() => onNavigate?.('create')}
                      >
                        デザインを作成する
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Create Button */}
              <div className="create-button-container">
                <button className="create-design-btn" onClick={() => onNavigate?.('create')}>
                  あなただけのデザインを完成させよう
                </button>
              </div>
            </>
          )}

          {activeSection === 'setting' && (
            <div className="setting-content">
              <p>設定画面（実装予定）</p>
            </div>
          )}
        </div>
      </MobileLayout>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />

      {selectedAsset && (
        <MobileDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onLike={() => console.log('Liked')}
          onSave={() => console.log('Saved')}
          onPurchase={() => console.log('Purchase')}
          onTogglePublish={handleTogglePublish}
          onDelete={handleDelete}
          similarAssets={getSimilarAssets(selectedAsset)}
          isOwner={true} // MyPage内なので全て自分の画像
        />
      )}
    </>
  );
}

function getTabLabel(tab: TabType): string {
  const labels: Record<TabType, string> = {
    publish: '公開作品',
    drafts: '下書き',
    collections: 'コレクション',
  };
  return labels[tab];
}
