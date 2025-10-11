import React, { useState, useEffect } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { HamburgerMenu } from '../../components/mobile/HamburgerMenu';
import { GalleryViewMode } from '../../components/mobile/GalleryViewSwitcher';
import { MobileGallery } from '../../components/mobile/MobileGallery';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { Asset } from '../../lib/types';
import './MobileHomePage.css';

interface MobileGalleryPageProps {
  onNavigate?: (page: string) => void;
}

export function MobileGalleryPage({ onNavigate }: MobileGalleryPageProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [viewMode, setViewMode] = useState<GalleryViewMode>('poster');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // カタログデータを取得
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/catalog');
      if (response.ok) {
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          setAssets(data.images);
        } else {
          // Fallback: ダミーデータ
          setAssets(generateDummyAssets(30));
        }
      } else {
        setAssets(generateDummyAssets(30));
      }
    } catch (error) {
      console.error('Failed to load catalog:', error);
      setAssets(generateDummyAssets(30));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    if (isLoading) return;
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const moreAssets = generateDummyAssets(20);
      setAssets((prev) => [...prev, ...moreAssets]);
      setIsLoading(false);
    }, 1000);
  };

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset);
  };

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const handleTitleClick = () => {
    if (onNavigate) {
      onNavigate('home');
    }
  };

  const handleLike = () => {
    console.log('Liked:', selectedAsset?.id);
  };

  const handleSave = () => {
    console.log('Saved:', selectedAsset?.id);
  };

  const handlePurchase = () => {
    console.log('Purchase:', selectedAsset?.id);
    // TODO: Navigate to purchase page
  };

  // Get similar assets
  const getSimilarAssets = (asset: Asset) => {
    return assets
      .filter(a => a.id !== asset.id && a.tags.some(t => asset.tags.includes(t)))
      .slice(0, 6);
  };

  return (
    <>
      <MobileLayout
        showHeader={true}
        showBottomNav={true}
        onMenuClick={() => setIsMenuOpen(true)}
        onLogoClick={handleTitleClick}
      >
        <div className="gallery-page-content">
          <h1 className="gallery-title" onClick={handleTitleClick}>GALLERY</h1>
          <MobileGallery
            assets={assets}
            viewMode={viewMode}
            onAssetClick={handleAssetClick}
            onLoadMore={loadMore}
            isLoading={isLoading}
          />
        </div>
      </MobileLayout>

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />

      {selectedAsset && (
        <MobileDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onLike={handleLike}
          onSave={handleSave}
          onPurchase={handlePurchase}
          similarAssets={getSimilarAssets(selectedAsset)}
        />
      )}
    </>
  );
}

// ダミーデータ生成
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

  const tags = [
    'minimal', 'street', 'luxury', 'outdoor', 'workwear',
    'athleisure', 'retro', 'avantgarde', 'genderless'
  ];

  const creators = [
    'Kai Studio', 'Mori Atelier', 'DRA Lab',
    'OWM Creator', 'Atelier 37', 'Studio Form'
  ];

  return Array.from({ length: count }).map((_, i) => {
    const id = `asset-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
    const w = Math.random() < 0.6 ? 800 : 700;
    const h = w === 800 ? 800 : 1000;

    return {
      id,
      src: `https://picsum.photos/seed/${id}/${w}/${h}`,
      w,
      h,
      title: titles[i % titles.length],
      tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
      colors: ['black', 'white'],
      price: Math.floor(Math.random() * 30000) + 10000,
      creator: creators[i % creators.length],
      likes: Math.floor(Math.random() * 100),
    };
  });
}
