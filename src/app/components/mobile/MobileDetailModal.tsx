import React, { useEffect } from 'react';
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
  onPurchase,
  similarAssets = []
}: MobileDetailModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-backdrop" onClick={onClose} />

      <div className="detail-modal-container">
        {/* Header */}
        <div className="detail-modal-header">
          <button className="detail-close-btn" onClick={onClose}>
            ×
          </button>
          <button className="detail-bookmark-btn">
            ♡
          </button>
        </div>

        {/* Image */}
        <div className="detail-image">
          <img src={asset.src} alt={asset.title} />
        </div>

        {/* Info */}
        <div className="detail-info">
          <h2 className="detail-title">{asset.title}</h2>

          {asset.tags && asset.tags.length > 0 && (
            <div className="detail-tags">
              {asset.tags.map((tag, i) => (
                <span key={i} className="detail-tag">{tag}</span>
              ))}
            </div>
          )}

          <div className="detail-creator-price">
            <div className="detail-creator">
              <div className="detail-from">FROM</div>
              <div className="detail-creator-name">{asset.creator || 'FROM'}</div>
            </div>
            <div className="detail-price">¥{asset.price?.toLocaleString()}</div>
          </div>

          <button className="detail-buy-btn" onClick={onPurchase}>
            BUY
          </button>

          <div className="detail-description">
            <p>
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。
              コンセプト・説明文が入る想定です。コンセプト
            </p>
            <button className="detail-more-btn">...詳細を見る</button>
          </div>
        </div>

        {/* Similar */}
        {similarAssets.length > 0 && (
          <div className="detail-similar">
            <h3 className="detail-similar-title">SIMILAR DESIGNS</h3>
            <div className="detail-similar-masonry">
              {similarAssets.slice(0, 6).map((item, index) => (
                <div
                  key={item.id}
                  className={`detail-similar-item detail-similar-item-${index + 1}`}
                >
                  <img src={item.src} alt={item.title} />
                </div>
              ))}
            </div>
            <button className="detail-similar-more">more</button>
          </div>
        )}
      </div>
    </div>
  );
}
