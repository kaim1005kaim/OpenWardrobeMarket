import React, { useEffect, useMemo, useState } from 'react';
import { Asset } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import './MobileDetailModal.css';

interface MobileDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onPurchase?: () => void;
  onTogglePublish?: (assetId: string, isPublic: boolean) => Promise<void>;
  onDelete?: (assetId: string) => Promise<void>;
  onToggleFavorite?: (assetId: string, shouldLike: boolean) => Promise<void>;
  similarAssets?: Asset[];
  isOwner?: boolean;
}

export function MobileDetailModal({
  asset,
  onClose,
  onPurchase,
  onTogglePublish,
  onDelete,
  onToggleFavorite,
  similarAssets = [],
  isOwner = false
}: MobileDetailModalProps) {
  const { user } = useAuth();
  const initialPublic = useMemo(() => (asset.status ? asset.status === 'public' : !!asset.isPublic), [asset]);
  const initialLiked = useMemo(() => asset.isLiked ?? asset.liked ?? false, [asset]);

  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFavoriteProcessing, setIsFavoriteProcessing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setIsPublic(asset.status ? asset.status === 'public' : !!asset.isPublic);
    setIsLiked(asset.isLiked ?? asset.liked ?? false);
  }, [asset]);

  const handleTogglePublish = async () => {
    if (!onTogglePublish) return;
    try {
      setIsPublishing(true);
      const next = !isPublic;
      await onTogglePublish(asset.id, next);
      setIsPublic(next);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm('本当に削除しますか？')) return;
    await onDelete(asset.id);
    onClose();
  };

  const handleToggleFavorite = async () => {
    if (!onToggleFavorite) return;
    try {
      setIsFavoriteProcessing(true);
      const next = !isLiked;
      await onToggleFavorite(asset.id, next);
      setIsLiked(next);
    } finally {
      setIsFavoriteProcessing(false);
    }
  };

  const priceDisplay = asset.price != null ? `¥${Number(asset.price).toLocaleString()}` : '—';
  const baseLikes = asset.likes ?? 0;
  const likesDelta = (isLiked ? 1 : 0) - (initialLiked ? 1 : 0);
  const totalLikes = Math.max(0, baseLikes + likesDelta);

  return (
    <div className="detail-modal-overlay">
      <div className="detail-modal-backdrop" onClick={onClose} />

      <div className="detail-modal-container">
        <div className="detail-modal-header">
          <button className="detail-close-btn" onClick={onClose}>
            ×
          </button>
          <button
            className={`detail-bookmark-btn ${isLiked ? 'active' : ''}`}
            onClick={handleToggleFavorite}
            disabled={isFavoriteProcessing || !onToggleFavorite}
            aria-pressed={isLiked}
          >
            {isLiked ? '♥' : '♡'}
          </button>
        </div>

        <div className="detail-image">
          <img src={asset.src} alt={asset.title} />
        </div>

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
              <div className="detail-creator-name">{asset.creator || 'JOHN DEANNA'}</div>
            </div>
            <div className="detail-price">{priceDisplay}</div>
          </div>

          {isOwner ? (
            <div className="detail-owner-actions">
              <button
                className="detail-toggle-publish-btn"
                onClick={handleTogglePublish}
                disabled={isPublishing || !onTogglePublish}
              >
                {isPublic ? '非公開にする' : '公開する'}
              </button>
              <button className="detail-delete-btn" onClick={handleDelete}>
                削除
              </button>
            </div>
          ) : (
            <button className="detail-buy-btn" onClick={onPurchase}>
              BUY
            </button>
          )}

          {onToggleFavorite && (
            <div className="detail-likes">
              <span>{totalLikes}</span> likes
            </div>
          )}

          <div className="detail-description">
            <p>
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。
              コンセプト・説明文が入る想定です。コンセプト・説明文が入る想定です。
              コンセプト・説明文が入る想定です。コンセプト
            </p>
            <button className="detail-more-btn">...詳細を見る</button>
          </div>
        </div>

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
