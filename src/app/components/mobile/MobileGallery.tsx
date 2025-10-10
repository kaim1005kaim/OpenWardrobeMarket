import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../../lib/types';
import { GalleryViewMode } from './GalleryViewSwitcher';
import { posterTemplates, brandNames, colors } from '../../lib/designTokens';

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

      <style jsx>{`
        .mobile-gallery {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          padding: 8px;
          background: #FFFFFF;
        }

        /* Clean Mode */
        .gallery-card.clean {
          background: #FFFFFF;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .gallery-card.clean:active {
          transform: scale(0.98);
        }

        .gallery-card.clean.square .image-wrapper {
          aspect-ratio: 1 / 1;
        }

        .gallery-card.clean.portrait .image-wrapper {
          aspect-ratio: 3 / 4;
        }

        .image-wrapper {
          width: 100%;
          overflow: hidden;
          background: #EEECE6;
        }

        .image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .card-info {
          padding: 8px;
          background: #FFFFFF;
        }

        .card-title {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #000000;
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-price {
          font-family: 'Montserrat', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: #666666;
          margin: 0;
        }

        /* Poster Mode */
        .gallery-card.poster {
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease;
          padding: 12px;
          display: flex;
          flex-direction: column;
        }

        .gallery-card.poster:active {
          transform: scale(0.98);
        }

        .gallery-card.poster.square {
          min-height: 280px;
        }

        .gallery-card.poster.portrait {
          min-height: 380px;
        }

        .poster-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .poster-brand {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .poster-number {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 600;
        }

        .poster-image {
          flex: 1;
          border-radius: 6px;
          overflow: hidden;
          background: #000000;
          margin-bottom: 8px;
        }

        .poster-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .poster-footer {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .poster-title {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .poster-meta {
          display: flex;
          justify-content: space-between;
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 9px;
          font-weight: 500;
          opacity: 0.8;
        }

        /* Loading */
        .load-more-trigger {
          padding: 20px;
          display: flex;
          justify-content: center;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #E5E5E5;
          border-top-color: #000000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
