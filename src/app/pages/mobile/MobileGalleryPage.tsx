import React, { useState, useEffect, useCallback } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { GalleryViewMode } from '../../components/mobile/GalleryViewSwitcher';
import { MobileGallery } from '../../components/mobile/MobileGallery';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { SearchModal } from '../../components/mobile/SearchModal';
import { SearchTrigger } from '../../components/mobile/SearchTrigger';
import { Asset, AssetStatus } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchAssets as fetchAssetsFromApi,
  updateAssetStatus,
  deleteAsset,
  toggleLike
} from '../../lib/api/assets';
import './MobileHomePage.css';

interface MobileGalleryPageProps {
  onNavigate?: (page: string) => void;
}

export function MobileGalleryPage({ onNavigate }: MobileGalleryPageProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [viewMode, setViewMode] = useState<GalleryViewMode>('poster');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // カタログデータを取得
  useEffect(() => {
    fetchInitialAssets();
  }, []);

  const mapApiAsset = useCallback(
    (asset: Asset): Asset => ({
      ...asset,
      src: asset.finalUrl ?? asset.src,
      finalUrl: asset.finalUrl ?? asset.src,
      rawUrl: asset.rawUrl,
      isPublic: asset.status === 'public',
      liked: asset.isLiked ?? asset.liked,
      creator: asset.creator || (asset.userId === user?.id ? 'You' : asset.creator || 'OWM Creator')
    }),
    [user?.id]
  );

  const fetchInitialAssets = useCallback(async () => {
    setCursor(null);
    setHasMore(true);
    setAssets([]);
    await fetchMore(true);
  }, []);

  const fetchMore = useCallback(
    async (reset = false) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const { assets: fetched, cursor: nextCursor } = await fetchAssetsFromApi({
          scope: 'public',
          kind: 'final',
          limit: 24,
          cursor: reset ? null : cursor
        });

        if (fetched.length > 0) {
          const mapped = fetched
            .map(mapApiAsset)
            .filter((asset) => !(asset.finalKey && asset.finalKey.toLowerCase().includes('catalog/01.png')));
          setAssets((prev) => (reset ? mapped : [...prev, ...mapped]));
          setCursor(nextCursor);
          setHasMore(Boolean(nextCursor));
          return;
        }

        if (!reset) {
          setHasMore(false);
          return;
        }

        // fallback to catalog samples
        const catalogResponse = await fetch('/api/catalog');
        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json();
          if (Array.isArray(catalogData.images) && catalogData.images.length) {
            const catalogItems: Asset[] = catalogData.images.map((item: any) => ({
              ...item,
              creator: 'OWM',
              status: 'public',
              isPublic: true,
              userId: null
            }));
            setAssets(catalogItems);
            setHasMore(false);
            return;
          }
        }

        setAssets([]);
        setHasMore(false);
      } catch (error) {
        console.error('[MobileGalleryPage] Failed to fetch assets:', error);
        if (reset) {
          setAssets([]);
          setHasMore(false);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [cursor, isLoading, mapApiAsset]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    fetchMore(false);
  }, [fetchMore, hasMore, isLoading]);

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

  const handleToggleFavorite = useCallback(
    async (assetId: string, shouldLike: boolean) => {
      await toggleLike(assetId, shouldLike);
      setAssets((prev) =>
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
    },
    []
  );

  const handleTogglePublish = useCallback(
    async (assetId: string, nextStatus: AssetStatus) => {
      const updated = await updateAssetStatus(assetId, nextStatus);
      const mapped = mapApiAsset(updated);
      setAssets((prev) => prev.map((asset) => (asset.id === assetId ? mapped : asset)));
      setSelectedAsset((prev) => (prev && prev.id === assetId ? mapped : prev));
    },
    [mapApiAsset]
  );

  const handleDelete = useCallback(
    async (assetId: string) => {
      await deleteAsset(assetId);
      setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      setSelectedAsset((prev) => (prev && prev.id === assetId ? null : prev));
    },
    []
  );

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
        isMenuOpen={isMenuOpen}
      >
        <div className="gallery-page-content">
          <SearchTrigger
            tone="dark"
            placeholder="Search"
            className="gallery-search-trigger"
            showLabel={false}
            onClick={() => setIsSearchOpen(true)}
          />
          <h1 className="gallery-title" onClick={handleTitleClick}>GALLERY</h1>
          <MobileGallery
            assets={assets}
            viewMode={viewMode}
            onAssetClick={handleAssetClick}
            onLoadMore={hasMore ? loadMore : undefined}
            isLoading={isLoading}
          />
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
          onPurchase={() => console.log('Purchase:', selectedAsset?.id)}
          onTogglePublish={(assetId, makePublic) =>
            handleTogglePublish(assetId, makePublic ? 'public' : 'private')
          }
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          similarAssets={getSimilarAssets(selectedAsset)}
          isOwner={selectedAsset.userId === user?.id}
        />
      )}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSearch={(query) => {
          console.log('Search:', query);
          setIsSearchOpen(false);
        }}
      />
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
      status: 'public',
      isPublic: true,
      userId: null
    };
  });
}
