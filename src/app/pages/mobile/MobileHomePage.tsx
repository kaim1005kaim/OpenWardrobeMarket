import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { Asset } from '../../lib/types';

interface MobileHomePageProps {
  onNavigate?: (page: string) => void;
}

export function MobileHomePage({ onNavigate }: MobileHomePageProps) {
  const [recommendedAssets, setRecommendedAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchRecommended();
  }, []);

  const fetchRecommended = async () => {
    // TODO: Fetch from API
    setRecommendedAssets(generateDummyAssets(10));
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
    return recommendedAssets
      .filter(a => a.id !== asset.id)
      .slice(0, 6);
  };

  return (
    <>
      <MobileLayout
        title="OWM"
        showHeader={true}
        showBottomNav={true}
        onMenuClick={() => setIsMenuOpen(true)}
      >
        <div className="home-content">
          {/* Hero section */}
          <section className="hero-section">
            <div className="hero-image">
              <img
                src="https://picsum.photos/seed/hero/800/600"
                alt="Featured"
              />
            </div>
            <div className="hero-overlay">
              <h2 className="hero-title">あなただけのデザインを<br />完成させよう</h2>
              <button className="cta-btn" onClick={() => onNavigate?.('create')}>
                デザインを作成
              </button>
            </div>
          </section>

          {/* Recommended section */}
          <section className="recommend-section">
            <h3 className="section-title">recommend</h3>
            <div className="recommend-grid">
              {recommendedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="recommend-card"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="card-image">
                    <img src={asset.src} alt={asset.title} loading="lazy" />
                  </div>
                  <div className="card-info">
                    <p className="card-title">{asset.title}</p>
                    <p className="card-creator">{asset.creator}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </MobileLayout>

      <BottomNavigation
        activeTab="home"
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
        .home-content {
          background: #FFFFFF;
        }

        /* Hero section */
        .hero-section {
          position: relative;
          height: 400px;
          overflow: hidden;
        }

        .hero-image {
          width: 100%;
          height: 100%;
          background: #EEECE6;
        }

        .hero-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .hero-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 32px 20px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
        }

        .hero-title {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.5;
          color: #FFFFFF;
          margin: 0 0 16px 0;
        }

        .cta-btn {
          padding: 14px 32px;
          background: #FFFFFF;
          border: none;
          border-radius: 8px;
          font-family: "Noto Sans JP", sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #000000;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cta-btn:active {
          background: #F5F5F5;
          transform: scale(0.98);
        }

        /* Recommend section */
        .recommend-section {
          padding: 24px 16px;
        }

        .section-title {
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 2px;
          color: #666666;
          margin: 0 0 16px 0;
          text-transform: lowercase;
        }

        .recommend-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .recommend-card {
          background: #FFFFFF;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .recommend-card:active {
          transform: scale(0.98);
        }

        .card-image {
          width: 100%;
          aspect-ratio: 3 / 4;
          background: #EEECE6;
          overflow: hidden;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-info {
          padding: 12px;
        }

        .card-title {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #000000;
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-creator {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 11px;
          color: #666666;
          margin: 0;
        }
      `}</style>
    </>
  );
}

// Dummy data generator
function generateDummyAssets(count: number): Asset[] {
  const titles = [
    'Urban minimal set',
    'Soft tailoring',
    'Street classic remix',
    'Elegant monochrome',
    'Outdoor light shell',
    'Clean utility',
    'Luxe drape',
  ];

  const creators = [
    'Kai Studio',
    'Mori Atelier',
    'DRA Lab',
    'OWM Creator',
    'Atelier 37',
    'Studio Form'
  ];

  return Array.from({ length: count }).map((_, i) => {
    const id = `home-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id,
      src: `https://picsum.photos/seed/${id}/700/1000`,
      w: 700,
      h: 1000,
      title: titles[i % titles.length],
      tags: ['minimal', 'street'],
      colors: ['black', 'white'],
      price: Math.floor(Math.random() * 30000) + 10000,
      creator: creators[i % creators.length],
      likes: Math.floor(Math.random() * 100),
    };
  });
}
