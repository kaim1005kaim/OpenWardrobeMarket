import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../../lib/types';
import { GalleryViewMode } from './GalleryViewSwitcher';
import { posterTemplates, brandNames, colors } from '../../lib/designTokens';
import './MobileGallery.css';

interface MobileGalleryProps {
  assets: Asset[];
  viewMode: GalleryViewMode;
  onAssetClick: (asset: Asset) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

export function MobileGallery({
  assets,
  viewMode,
  onAssetClick,
  onLoadMore,
  isLoading = false
}: MobileGalleryProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 無限スクロール
  useEffect(() => {
    if (!onLoadMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, isLoading]);

  // アスペクト比を決定（正方形60%、縦長40%）
  const getAspectRatio = (index: number) => {
    const seed = index * 2654435761 % 2147483647;
    const random = seed / 2147483647;
    return random < 0.6 ? 'square' : 'portrait';
  };

  return (
    <>
      <div className={`mobile-gallery ${viewMode}`}>
        {assets.map((asset, index) => {
          const template = posterTemplates[index % posterTemplates.length];
          const aspectRatio = getAspectRatio(index);

          if (viewMode === 'clean') {
            return (
              <div
                key={asset.id}
                className={`gallery-card clean ${aspectRatio}`}
                onClick={() => onAssetClick(asset)}
              >
                <div className="image-wrapper">
                  <img
                    src={asset.src}
                    alt={asset.title}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/400x600/EEECE6/999?text=Fashion';
                    }}
                  />
                </div>
                <div className="card-info">
                  <p className="card-title">{asset.title}</p>
                  <p className="card-price">¥{asset.price?.toLocaleString()}</p>
                </div>
              </div>
            );
          }

          // Poster mode
          const brand = brandNames[index % brandNames.length];

          return (
            <div
              key={asset.id}
              className={`gallery-card poster ${aspectRatio}`}
              style={{ backgroundColor: template.bgColor }}
              onClick={() => onAssetClick(asset)}
            >
              <div className="poster-header">
                <span className="poster-brand" style={{ color: template.textColor }}>
                  {brand}
                </span>
                <span className="poster-number" style={{ color: template.textColor }}>
                  {String(index + 1).padStart(3, '0')}
                </span>
              </div>
              <div className="poster-image">
                <img
                  src={asset.src}
                  alt={asset.title}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/400x600/333/999?text=Fashion';
                  }}
                />
              </div>
              <div className="poster-footer">
                <div className="poster-title" style={{ color: template.textColor }}>
                  {asset.title}
                </div>
                <div className="poster-meta" style={{ color: template.textColor }}>
                  <span>{asset.creator || 'Studio'}</span>
                  <span>¥{asset.price?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="load-more-trigger">
        {isLoading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </>
  );
}
