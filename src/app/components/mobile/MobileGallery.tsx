import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../../lib/types';
import { GalleryViewMode } from './GalleryViewSwitcher';
import { posterTemplates as legacyPosterTemplates, brandNames, colors } from '../../lib/designTokens';
import { posterTemplates, getRandomTemplate } from '../../lib/posterTemplates';
import { PosterCard } from '../PosterCard';
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

          // Calculate actual aspect ratio from template frameSize
          const templateAspectRatio = template.frameSize.height / template.frameSize.width;

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

          // Poster mode - use PosterCard with template frames
          return (
            <div
              key={asset.id}
              className={`gallery-card poster`}
              style={{ aspectRatio: `1 / ${templateAspectRatio}` }}
            >
              <PosterCard
                userImageUrl={asset.src}
                template={template}
                onClick={() => onAssetClick(asset)}
                className="poster-card-wrapper"
              />
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
