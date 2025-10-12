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

type TabType = 'publish' | 'drafts' | 'collections' | 'own';

interface GenerationHistory {
  id: string;
  user_id: string;
  image_url: string;
  preview_url: string | null;
  prompt: string | null;
  created_at: string;
  completion_status: string;
  is_public: boolean;
}

export function MobileMyPage({ onNavigate }: MobileMyPageProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'design' | 'setting'>('design');
  const [activeTab, setActiveTab] = useState<TabType>('own');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'own') {
      fetchGenerationHistory();
    } else {
      fetchAssets(activeTab);
    }
  }, [activeTab, user]);

  const fetchGenerationHistory = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('generation_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('completion_status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGenerationHistory(data || []);
    } catch (error) {
      console.error('Error fetching generation history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssets = async (tab: TabType) => {
    // TODO: Fetch from API based on tab
    setAssets(generateDummyAssets(12));
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const getSimilarAssets = (asset: Asset) => {
    return assets.filter(a => a.id !== asset.id).slice(0, 6);
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
                <button
                  className={`tab-btn ${activeTab === 'own' ? 'active' : ''}`}
                  onClick={() => setActiveTab('own')}
                >
                  Own
                </button>
              </div>

              {/* Grid */}
              <div className="assets-grid">
                {isLoading ? (
                  <div className="loading-message">読み込み中...</div>
                ) : activeTab === 'own' && generationHistory.length > 0 ? (
                  generationHistory.map((item) => (
                    <div
                      key={item.id}
                      className="asset-card"
                      onClick={() => {
                        // Convert generation history to Asset format for modal
                        const assetFromHistory: Asset = {
                          id: item.id,
                          src: item.image_url || item.preview_url || '',
                          title: item.prompt || 'Generated Design',
                          tags: ['Generated'],
                          type: 'generated',
                          price: 0,
                          likes: 0
                        };
                        setSelectedAsset(assetFromHistory);
                      }}
                    >
                      <div className="card-image">
                        <img
                          src={item.image_url || item.preview_url || 'https://via.placeholder.com/300?text=No+Image'}
                          alt={item.prompt || 'Generated Design'}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  ))
                ) : activeTab === 'own' && generationHistory.length === 0 ? (
                  <div className="empty-message">
                    <p>まだ作成したデザインがありません</p>
                    <button
                      className="create-btn"
                      onClick={() => onNavigate?.('create')}
                    >
                      デザインを作成する
                    </button>
                  </div>
                ) : assets.length > 0 ? (
                  assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="asset-card"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="card-image">
                        <img src={asset.src} alt={asset.title} loading="lazy" />
                        {Math.random() > 0.5 && (
                          <div className="sold-badge">SOLD</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>まだ{getTabLabel(activeTab)}がありません</p>
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
          similarAssets={getSimilarAssets(selectedAsset)}
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
    own: '自分用作品',
  };
  return labels[tab];
}

// Dummy data
function generateDummyAssets(count: number): Asset[] {
  return Array.from({ length: count }).map((_, i) => {
    const id = `mypage-${Date.now()}-${i}`;
    return {
      id,
      src: `https://picsum.photos/seed/${id}/600/800`,
      w: 600,
      h: 800,
      title: `Design ${i + 1}`,
      tags: ['minimal', 'street'],
      colors: ['black', 'white'],
      price: Math.floor(Math.random() * 30000) + 10000,
      creator: 'You',
      likes: Math.floor(Math.random() * 100),
    };
  });
}
