import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { useAuth } from '../../lib/AuthContext';
import { Asset } from '../../lib/types';

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

      <style jsx>{`
        .mypage-content {
          background: #FFFFFF;
        }

        /* Profile section */
        .profile-section {
          padding: 32px 20px;
          text-align: center;
          border-bottom: 1px solid #E5E5E5;
        }

        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          margin: 0 auto 16px;
          background: #EEECE6;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-name {
          font-family: 'Montserrat', sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #000000;
          margin: 0 0 12px 0;
        }

        .profile-bio {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #666666;
          margin: 0 0 16px 0;
          max-width: 300px;
          margin-left: auto;
          margin-right: auto;
        }

        .edit-profile-btn {
          padding: 10px 24px;
          background: #FFFFFF;
          border: 2px solid #E5E5E5;
          border-radius: 8px;
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #000000;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .edit-profile-btn:active {
          background: #F5F5F5;
        }

        /* Tabs */
        .tabs-container {
          display: flex;
          background: #FFFFFF;
          border-bottom: 1px solid #E5E5E5;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tab-btn {
          flex: 1;
          min-width: 80px;
          padding: 16px 12px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 1px;
          color: #666666;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tab-btn.active {
          color: #000000;
          border-bottom-color: #000000;
        }

        /* Grid */
        .assets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 4px;
          min-height: 300px;
        }

        .asset-card {
          aspect-ratio: 3 / 4;
          position: relative;
          background: #EEECE6;
          overflow: hidden;
          cursor: pointer;
        }

        .card-image {
          width: 100%;
          height: 100%;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.2s ease;
        }

        .asset-card:active .card-image img {
          transform: scale(1.05);
        }

        .card-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .asset-card:hover .card-overlay {
          opacity: 1;
        }

        .card-title {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: #FFFFFF;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Empty state */
        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .empty-state p {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 14px;
          color: #666666;
          margin: 0;
        }
      `}</style>
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
