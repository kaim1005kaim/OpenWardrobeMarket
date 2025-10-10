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
        {/* Swipe indicator */}
        <div className="swipe-indicator">
          <div className="indicator-bar"></div>
        </div>

        {/* Close button */}
        <button className="close-btn" onClick={onClose}>×</button>

        {/* Main image */}
        <div className="modal-image">
          <img src={asset.src} alt={asset.title} />
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Title and price */}
          <div className="content-header">
            <h2 className="asset-title">{asset.title}</h2>
            <div className="asset-price">¥{asset.price?.toLocaleString()}</div>
          </div>

          {/* Creator info */}
          <div className="creator-info">
            <span className="from-label">from</span>
            <span className="creator-name">{asset.creator || 'CREATOR'}</span>
          </div>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="tags-section">
              {asset.tags.map((tag, i) => (
                <span key={i} className="tag">#{tag}</span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="description">
            <p>
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。
              コンセプト・説明文が入る想定です。
            </p>
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            <button className="action-btn secondary" onClick={onLike}>
              <span className="icon">♥</span>
              <span>いいね</span>
            </button>
            <button className="action-btn secondary" onClick={onSave}>
              <span className="icon">📌</span>
              <span>保存</span>
            </button>
            <button className="action-btn primary" onClick={onPurchase}>
              購入する
            </button>
          </div>

          {/* Similar designs */}
          {similarAssets.length > 0 && (
            <div className="similar-section">
              <h3 className="section-title">Similar designs</h3>
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
