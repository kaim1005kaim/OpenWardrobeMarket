import React, { useEffect, useMemo, useState } from 'react';
import { Asset } from '../../lib/types';
import { useAuth } from '../../lib/AuthContext';
import './MobileDetailModal.css';
// Force rebuild for API endpoint deployment

interface MobileDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onPurchase?: () => void;
  onTogglePublish?: (assetId: string, isPublic: boolean) => Promise<void>;
  onDelete?: (assetId: string) => Promise<void>;
  onToggleFavorite?: (assetId: string, shouldLike: boolean) => Promise<void>;
  onPublishFromArchive?: (imageUrl: string, generationData?: any) => void;
  similarAssets?: Asset[]; // Optional: manual similar assets (fallback)
  isOwner?: boolean;
  isDraft?: boolean;
}

export function MobileDetailModal({
  asset,
  onClose,
  onPurchase,
  onTogglePublish,
  onDelete,
  onToggleFavorite,
  onPublishFromArchive,
  similarAssets = [],
  isOwner = false,
  isDraft = false
}: MobileDetailModalProps) {
  const { user } = useAuth();
  const initialPublic = useMemo(() => (asset.status ? asset.status === 'public' : !!asset.isPublic), [asset]);
  const initialLiked = useMemo(() => asset.isLiked ?? asset.liked ?? false, [asset]);

  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFavoriteProcessing, setIsFavoriteProcessing] = useState(false);
  const [aiSimilarAssets, setAiSimilarAssets] = useState<Asset[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);

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

  // Fetch AI-based similar items when modal opens
  // Try vector search first, fallback to tag-based search
  useEffect(() => {
    const fetchSimilarItems = async () => {
      if (!asset.id) return;

      setIsLoadingSimilar(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

        // Try vector-based search first (Phase 3 - highest accuracy)
        let response = await fetch(`${apiUrl}/api/vector-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemId: asset.id,
            limit: 6,
            mode: 'auto', // Auto-detect hybrid vs pure vector
            threshold: 0.6, // Lower threshold for more results
          }),
        });

        // Fallback to tag-based search if vector search fails
        if (!response.ok) {
          console.log('[MobileDetailModal] Vector search unavailable, falling back to tag search');
          response = await fetch(`${apiUrl}/api/similar-items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              itemId: asset.id,
              limit: 6,
            }),
          });
        }

        if (response.ok) {
          const data = await response.json();
          const items = data.similar_items || [];

          console.log('[MobileDetailModal] Algorithm:', data.algorithm);
          console.log('[MobileDetailModal] Similar items count:', items.length);
          console.log('[MobileDetailModal] Sample items:', items.slice(0, 3).map((i: any) => ({ id: i.id, title: i.title, image_id: i.image_id })));

          // Map API response to Asset format
          // Use custom domain for public access (pub-*.r2.dev returns 401)
          const publicBaseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL || 'https://assets.open-wardrobe-market.com';
          const mappedAssets: Asset[] = items.map((item: any) => {
            // Resolve image URL from image_id
            let imageUrl = '';
            if (item.image_id) {
              if (item.image_id.startsWith('http')) {
                // Already a full URL
                imageUrl = item.image_id;
              } else if (item.image_id.startsWith('catalog/') || item.image_id.startsWith('usergen/') || item.image_id.startsWith('posters/')) {
                // Construct URL from R2 base
                imageUrl = `${publicBaseUrl}/${item.image_id}`;
              } else {
                // Fallback: assume it's a relative R2 key
                imageUrl = `${publicBaseUrl}/${item.image_id}`;
              }
            }

            return {
              id: item.id,
              title: item.title || 'Untitled',
              src: imageUrl,
              tags: item.tags || [],
              category: item.category,
            };
          });

          setAiSimilarAssets(mappedAssets);
        } else {
          console.warn('[MobileDetailModal] Failed to load similar items');
        }
      } catch (error) {
        console.error('[MobileDetailModal] Error loading similar items:', error);
      } finally {
        setIsLoadingSimilar(false);
      }
    };

    fetchSimilarItems();
  }, [asset.id]);

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
              {isDraft && onPublishFromArchive ? (
                <button
                  className="detail-toggle-publish-btn"
                  onClick={() => {
                    onPublishFromArchive(asset.src, asset.generationData);
                    onClose();
                  }}
                >
                  編集して公開
                </button>
              ) : (
                <button
                  className="detail-toggle-publish-btn"
                  onClick={handleTogglePublish}
                  disabled={isPublishing || !onTogglePublish}
                >
                  {isPublic ? '非公開にする' : '公開する'}
                </button>
              )}
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

        {(aiSimilarAssets.length > 0 || similarAssets.length > 0 || isLoadingSimilar) && (
          <div className="detail-similar">
            <h3 className="detail-similar-title">SIMILAR DESIGNS</h3>
            {isLoadingSimilar ? (
              <div className="detail-similar-loading" style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <>
                <div className="detail-similar-masonry">
                  {/* Prioritize AI-based similar items, fallback to manual ones */}
                  {(aiSimilarAssets.length > 0 ? aiSimilarAssets : similarAssets).slice(0, 6).map((item, index) => (
                    <div
                      key={item.id}
                      className={`detail-similar-item detail-similar-item-${index + 1}`}
                    >
                      <img src={item.src} alt={item.title} />
                    </div>
                  ))}
                </div>
                {aiSimilarAssets.length > 6 && (
                  <button className="detail-similar-more">more</button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
