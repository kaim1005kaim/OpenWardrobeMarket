import React, { useEffect, useRef, useState } from 'react';
import { Asset } from '../../lib/types';
import './MobileDetailModal.css';

interface MobileDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onPurchase?: () => void;
  similarAssets?: Asset[];
}

export function MobileDetailModal({
  asset,
  onClose,
  onLike,
  onSave,
  onPurchase,
  similarAssets = []
}: MobileDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Body scroll prevention
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 150) {
      onClose();
    } else {
      setCurrentY(0);
    }
    setIsDragging(false);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div
        ref={modalRef}
        className="detail-modal"
        style={{
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header icons */}
        <div className="modal-header">
          <button className="header-icon expand-icon" aria-label="Expand">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M14 6L18 2M18 2H14M18 2V6M6 14L2 18M2 18H6M2 18V14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="header-icon bookmark-icon" aria-label="Bookmark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 2H15V18L10 14L5 18V2Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Main image */}
        <div className="modal-image">
          <img src={asset.src} alt={asset.title} />
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Title */}
          <h2 className="asset-title">{asset.title}</h2>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="tags-section">
              {asset.tags.map((tag, i) => (
                <span key={i} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Creator and Price */}
          <div className="creator-price-row">
            <div className="creator-info">
              <span className="from-label">FROM</span>
              <span className="creator-name">{asset.creator || 'JOHN DEANNA'}</span>
            </div>
            <div className="asset-price">¥{asset.price?.toLocaleString()}</div>
          </div>

          {/* Buy button */}
          <button className="buy-button" onClick={onPurchase}>
            BUY
          </button>

          {/* Description */}
          <div className="description">
            <p>
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。コンセプト
            </p>
            <button className="more-text-btn">...詳細を見る</button>
          </div>

          {/* Similar designs */}
          {similarAssets.length > 0 && (
            <div className="similar-section">
              <h3 className="section-title">SIMILAR DESIGNS</h3>
              <div className="similar-grid">
                {similarAssets.slice(0, 6).map((similar) => (
                  <div key={similar.id} className="similar-card">
                    <img src={similar.src} alt={similar.title} />
                  </div>
                ))}
              </div>
              <button className="more-btn">more</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
