import React, { useState, useEffect, useCallback } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { CardSwiper } from '../../components/mobile/CardSwiper';
import { Asset, AssetStatus } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchAssets as fetchAssetsFromApi,
  updateAssetStatus,
  deleteAsset,
  toggleLike
} from '../../lib/api/assets';
import './MobileHomePage.css';

interface MobileHomePageProps {
  onNavigate?: (page: string) => void;
}

export function MobileHomePage({ onNavigate }: MobileHomePageProps) {
  const { user } = useAuth();
  const [recommendedAssets, setRecommendedAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRecommended();
  }, []);

  const mapApiAsset = useCallback(
    (asset: Asset): Asset => ({
      ...asset,
      src: asset.rawUrl ?? asset.finalUrl ?? asset.src,
      isPublic: asset.status === 'public',
      liked: asset.isLiked ?? asset.liked,
      creator: asset.creator || (asset.userId === user?.id ? 'You' : 'OWM Creator')
    }),
    [user?.id]
  );

  const fetchRecommended = useCallback(async () => {
    setIsLoading(true);
    try {
      const { assets } = await fetchAssetsFromApi({
        scope: 'mine',
        kind: 'raw',
        limit: 20
      });

      if (assets.length > 0) {
        setRecommendedAssets(assets.map(mapApiAsset));
        return;
      }

      // fallback to public assets if user has none
      const { assets: publicAssets } = await fetchAssetsFromApi({
        scope: 'public',
        kind: 'final',
        limit: 20
      });

      setRecommendedAssets(publicAssets.map(mapApiAsset));
    } catch (error) {
      console.error('[MobileHomePage] Failed to load recommended assets:', error);
      setRecommendedAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapApiAsset]);

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

  const handleToggleFavorite = useCallback(
    async (assetId: string, shouldLike: boolean) => {
      try {
        await toggleLike(assetId, shouldLike);
        setRecommendedAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  liked: shouldLike,
                  isLiked: shouldLike,
                  likes: Math.max(0, (asset.likes || 0) + (shouldLike ? 1 : -1))
                }
              : asset
          )
        );

        setSelectedAsset((prev) =>
          prev && prev.id === assetId
            ? {
                ...prev,
                liked: shouldLike,
                isLiked: shouldLike,
                likes: Math.max(0, (prev.likes || 0) + (shouldLike ? 1 : -1))
              }
            : prev
        );
      } catch (error) {
        console.error('[MobileHomePage] toggle favorite failed:', error);
        throw error;
      }
    },
    []
  );

  const handleTogglePublish = useCallback(
    async (assetId: string, nextStatus: AssetStatus) => {
      try {
        const updated = await updateAssetStatus(assetId, nextStatus);
        const mapped = mapApiAsset(updated);

        setRecommendedAssets((prev) =>
          prev.map((asset) => (asset.id === assetId ? mapped : asset))
        );

        setSelectedAsset((prev) => (prev && prev.id === assetId ? mapped : prev));
      } catch (error) {
        console.error('[MobileHomePage] toggle publish failed:', error);
        throw error;
      }
    },
    [mapApiAsset]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      try {
        await deleteAsset(assetId);
        setRecommendedAssets((prev) => prev.filter((asset) => asset.id !== assetId));
        setSelectedAsset((prev) => (prev && prev.id === assetId ? null : prev));
      } catch (error) {
        console.error('[MobileHomePage] delete asset failed:', error);
        throw error;
      }
    },
    []
  );

  return (
    <>
      <div className="mobile-home-page">
        {/* Header */}
        <header className="mobile-home-header">
          {!isMenuOpen && (
            <button
              className="hamburger-btn"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12H21M3 6H21M3 18H21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <div className="owm-logo">OWM</div>
        </header>

        {/* Spacer to maintain layout consistency */}
        <div className="home-spacer" aria-hidden="true" />

        {/* RECOMMEND Title */}
        <h1 className="recommend-title">RECOMMEND</h1>

        {/* Card Swiper */}
        <div className="card-swiper-section">
          {recommendedAssets.length > 0 ? (
            <CardSwiper
              assets={recommendedAssets}
              onCardClick={setSelectedAsset}
              autoAdvanceInterval={recommendedAssets.length > 1 ? 3600 : undefined}
              onIndexChange={setActiveIndex}
            />
          ) : (
            <div className="home-empty-state">
              まだ提案はありません
            </div>
          )}
          {isLoading && recommendedAssets.length === 0 && (
            <div className="home-loading-indicator">
              Loading...
            </div>
          )}
        </div>

        {/* CTA Button */}
        <button
          className="cta-button"
          onClick={() => onNavigate?.('create')}
        >
          あなただけのデザインを完成させよう
        </button>

        {/* Gallery Layout Link */}
        <button
          className="gallery-layout-link"
          onClick={() => onNavigate?.('gallery')}
        >
          ギャラリーレイアウトを見る
        </button>

        {/* Footer */}
        <footer className="mobile-home-footer">
          <div className="footer-links">
            <a href="#" className="footer-link">F.A.Q.</a>
            <a href="#" className="footer-link">PRIVACY POLICY</a>
            <a href="#" className="footer-link">CONTACT</a>
          </div>

          <div className="footer-logo">
            <img src="/logo.png" alt="OWM Logo" className="footer-logo-image" />
            <div className="footer-logo-text">
              <p className="footer-brand">OPEN WARDROBE MARKET</p>
              <p className="footer-tagline">DESIGN, GENERATE, AND PUBLISH YOUR ORIGINAL FASHION</p>
              <p className="footer-tagline">FASHION POWERED BY OPEN DESIGN</p>
            </div>
          </div>

          <div className="footer-copyright">
            <p>©︎2025 OPEN WARDROBE MARKET. ALL RIGHTS RESERVED.</p>
          </div>
        </footer>
      </div>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />

      {selectedAsset && (
        <MobileDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onPurchase={() => console.log('Purchase')}
          onTogglePublish={(assetId, isPublic) =>
            handleTogglePublish(assetId, isPublic ? 'public' : 'private')
          }
          onDelete={async (assetId) => {
            await handleDeleteAsset(assetId);
          }}
          onToggleFavorite={async (assetId, shouldLike) => {
            await handleToggleFavorite(assetId, shouldLike);
          }}
          similarAssets={getSimilarAssets(selectedAsset)}
          isOwner={selectedAsset.userId === user?.id}
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
      status: 'public',
      isPublic: true,
      userId: null
    };
  });
}
