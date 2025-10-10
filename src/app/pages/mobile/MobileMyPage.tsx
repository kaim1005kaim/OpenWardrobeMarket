import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { useAuth } from '../../lib/AuthContext';
import { Asset } from '../../lib/types';
import './MobileMyPage.css';

interface MobileMyPageProps {
  onNavigate?: (page: string) => void;
}

type TabType = 'publish' | 'drafts' | 'collections' | 'own';

export function MobileMyPage({ onNavigate }: MobileMyPageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('publish');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchAssets(activeTab);
  }, [activeTab]);

  const fetchAssets = async (tab: TabType) => {
    // TODO: Fetch from API based on tab
    setAssets(generateDummyAssets(12));
  };

  const handleTabChange = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
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

  return (
    <>
      <MobileLayout
        title="MY PAGE"
        showHeader={true}
        showBottomNav={true}
        onMenuClick={() => setIsMenuOpen(true)}
      >
        <div className="mypage-content">
          {/* Profile section */}
          <div className="profile-section">
            <div className="profile-avatar">
              <img
                src={user?.user_metadata?.avatar_url || 'https://via.placeholder.com/80/EEECE6/999?text=User'}
                alt="Profile"
              />
            </div>
            <h2 className="profile-name">
              {user?.user_metadata?.username || user?.email?.split('@')[0] || 'USER NAME'}
            </h2>
            <p className="profile-bio">
              プロフィール文章が表示されます。プロフィール文章が表示されます。
              プロフィール文章が表示されます。
            </p>
            <button className="edit-profile-btn" onClick={() => console.log('Edit profile')}>
              プロフィールを編集
            </button>
          </div>

          {/* Tabs */}
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
            {assets.length > 0 ? (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="asset-card"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="card-image">
                    <img src={asset.src} alt={asset.title} loading="lazy" />
                  </div>
                  <div className="card-overlay">
                    <span className="card-title">{asset.title}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>まだ{getTabLabel(activeTab)}がありません</p>
              </div>
            )}
          </div>
        </div>
      </MobileLayout>

      <BottomNavigation
        activeTab="mypage"
        onTabChange={handleTabChange}
      />

      <HamburgerMenu
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
