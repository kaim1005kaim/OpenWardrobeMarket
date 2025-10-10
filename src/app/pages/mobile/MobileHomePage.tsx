import React, { useState, useEffect } from 'react';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { SearchModal } from '../../components/mobile/SearchModal';
import { CardSwiper } from '../../components/mobile/CardSwiper';
import { Asset } from '../../lib/types';
import './MobileHomePage.css';

interface MobileHomePageProps {
  onNavigate?: (page: string) => void;
}

export function MobileHomePage({ onNavigate }: MobileHomePageProps) {
  const [recommendedAssets, setRecommendedAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewMode, setViewMode] = useState<'home' | 'gallery'>('home');

  useEffect(() => {
    fetchRecommended();
  }, []);

  const fetchRecommended = async () => {
    // TODO: Fetch from API
    setRecommendedAssets(generateDummyAssets(10));
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
      <div className="mobile-home-page">
        {/* Header */}
        <header className="mobile-home-header">
          <button
            className="hamburger-btn"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="owm-logo">OWM</div>
        </header>

        {/* Search bar */}
        <div className="search-container" onClick={() => setIsSearchOpen(true)}>
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            readOnly
          />
        </div>

        {/* RECOMMEND Title */}
        <h1 className="recommend-title">RECOMMEND</h1>

        {/* Card Swiper */}
        <div className="card-swiper-section">
          <CardSwiper
            assets={recommendedAssets}
            onCardClick={setSelectedAsset}
          />
        </div>

        {/* CTA Button */}
        <button
          className="cta-button"
          onClick={() => onNavigate?.('create')}
        >
          あなただけのデザインを完成させよう
        </button>

        {/* View Mode Toggle */}
        <button
          className="view-toggle-btn"
          onClick={() => setViewMode(viewMode === 'home' ? 'gallery' : 'home')}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="16" fill="white" fillOpacity="0.9"/>
            {viewMode === 'home' ? (
              <path d="M12 10H20M12 16H20M12 22H20" stroke="#1a3d3d" strokeWidth="2" strokeLinecap="round"/>
            ) : (
              <path d="M10 10H14V14H10V10ZM18 10H22V14H18V10ZM10 18H14V22H10V18ZM18 18H22V22H18V18Z" stroke="#1a3d3d" strokeWidth="2" strokeLinecap="round"/>
            )}
          </svg>
        </button>

        {/* Footer */}
        <footer className="mobile-home-footer">
          <div className="footer-logo">
            <svg width="40" height="60" viewBox="0 0 40 60" fill="none">
              <text x="20" y="30" fontFamily="Trajan Pro 3, Cinzel" fontSize="14" fill="white" textAnchor="middle">
                OI
              </text>
              <text x="20" y="50" fontFamily="'Courier New', monospace" fontSize="8" fill="white" textAnchor="middle" letterSpacing="1">
                OPEN WARDROBE MARKET
              </text>
              <text x="20" y="58" fontFamily="'Courier New', monospace" fontSize="6" fill="white" textAnchor="middle">
                FASHION POWERED BY OPEN DESIGN
              </text>
            </svg>
          </div>
        </footer>
      </div>

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSearch={(query) => console.log('Search:', query)}
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
    '2000s fullbody shot of colorful high street wear',
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
