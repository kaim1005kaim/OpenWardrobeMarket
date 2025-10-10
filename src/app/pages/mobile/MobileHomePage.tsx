import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { BottomNavigation } from '../../components/mobile/BottomNavigation';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { Asset } from '../../lib/types';
import './MobileHomePage.css';

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
