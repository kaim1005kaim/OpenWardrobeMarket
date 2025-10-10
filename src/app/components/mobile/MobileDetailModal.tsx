import React, { useEffect, useRef, useState } from 'react';
import { Asset } from '../../lib/types';

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

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 300;
        }

        .detail-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #FFFFFF;
          z-index: 301;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Swipe indicator */
        .swipe-indicator {
          position: sticky;
          top: 0;
          padding: 12px 0;
          display: flex;
          justify-content: center;
          background: #FFFFFF;
          z-index: 10;
        }

        .indicator-bar {
          width: 40px;
          height: 4px;
          background: #CCCCCC;
          border-radius: 2px;
        }

        /* Close button */
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        /* Main image */
        .modal-image {
          width: 100%;
          aspect-ratio: 3 / 4;
          background: #F5F5F5;
          overflow: hidden;
        }

        .modal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Content */
        .modal-content {
          padding: 20px;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
        }

        .asset-title {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #000000;
          margin: 0;
          flex: 1;
        }

        .asset-price {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #000000;
        }

        /* Creator info */
        .creator-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #E5E5E5;
        }

        .from-label {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 11px;
          color: #666666;
          text-transform: lowercase;
        }

        .creator-name {
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 14px;
          font-weight: 400;
          color: #000000;
          letter-spacing: 1.5px;
        }

        /* Tags */
        .tags-section {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .tag {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 12px;
          color: #666666;
          background: #F5F5F5;
          padding: 6px 12px;
          border-radius: 16px;
        }

        /* Description */
        .description {
          margin-bottom: 24px;
        }

        .description p {
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 13px;
          line-height: 1.7;
          color: #333333;
          margin: 0;
        }

        /* Action buttons */
        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 32px;
        }

        .action-btn {
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-family: 'Noto Sans CJK JP', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .action-btn.primary {
          grid-column: 1 / -1;
          background: #000000;
          color: #FFFFFF;
        }

        .action-btn.primary:active {
          background: #333333;
        }

        .action-btn.secondary {
          background: #F5F5F5;
          color: #000000;
        }

        .action-btn.secondary:active {
          background: #E5E5E5;
        }

        .action-btn .icon {
          font-size: 18px;
        }

        /* Similar section */
        .similar-section {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #E5E5E5;
        }

        .section-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #000000;
          margin: 0 0 16px 0;
        }

        .similar-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .similar-card {
          aspect-ratio: 3 / 4;
          background: #F5F5F5;
          border-radius: 6px;
          overflow: hidden;
        }

        .similar-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .more-btn {
          width: 100%;
          padding: 12px;
          background: #FFFFFF;
          border: 2px solid #E5E5E5;
          border-radius: 8px;
          font-family: 'Montserrat', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #666666;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .more-btn:active {
          background: #F5F5F5;
        }

        /* Responsive */
        @media (min-width: 768px) {
          .detail-modal {
            max-width: 428px;
            left: 50%;
            transform: translateX(-50%);
          }
        }
      `}</style>
    </>
  );
}
