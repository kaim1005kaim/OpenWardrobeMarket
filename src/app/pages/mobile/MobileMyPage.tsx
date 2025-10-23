import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MobileDetailModal } from '../../components/mobile/MobileDetailModal';
import { MetaballsBreathing } from '../../../components/Urula/MetaballsBreathing';
import { DEFAULT_DNA } from '../../../types/dna';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { Asset, AssetStatus } from '../../lib/types';
import {
  fetchAssets as fetchAssetsFromApi,
  updateAssetStatus,
  deleteAsset,
  toggleLike
} from '../../lib/api/assets';
import { COPY } from '../../../constants/copy';
import './MobileMyPage.css';

interface MobileMyPageProps {
  onNavigate?: (page: string) => void;
  onPublishFromArchive?: (imageUrl: string, generationData?: any) => void;
}

type TabType = 'publish' | 'drafts' | 'collections';

export function MobileMyPage({ onNavigate, onPublishFromArchive }: MobileMyPageProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'design' | 'setting'>('design');
  const [activeTab, setActiveTab] = useState<TabType>('publish');
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [collectionAssets, setCollectionAssets] = useState<Asset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current) return;
      const targetNode = event.target as Node;
      if (
        accountMenuRef.current.contains(targetNode) ||
        accountTriggerRef.current?.contains(targetNode)
      ) {
        return;
      }
      if (!accountMenuRef.current.contains(targetNode)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAccountMenu]);

  const mapAsset = useCallback(
    (asset: Asset): Asset => ({
      ...asset,
      src: asset.finalUrl ?? asset.rawUrl ?? asset.src,
      isPublic: asset.status === 'public',
      liked: asset.isLiked ?? asset.liked,
      creator: asset.creator || (asset.userId === user?.id ? 'You' : asset.creator || 'OWM Creator')
    }),
    [user?.id]
  );

  const fetchMyAssets = useCallback(async () => {
    if (!user) {
      setMyAssets([]);
      return;
    }

    setIsLoadingAssets(true);
    try {
      const { assets } = await fetchAssetsFromApi({ scope: 'mine', kind: 'raw', limit: 80 });
      setMyAssets(assets.map(mapAsset));
    } catch (error) {
      console.error('[MobileMyPage] Failed to load assets:', error);
      setMyAssets([]);
    } finally {
      setIsLoadingAssets(false);
    }
  }, [mapAsset, user]);

  const fetchCollectionAssets = useCallback(async () => {
    if (!user) {
      setCollectionAssets([]);
      return;
    }

    setIsLoadingCollections(true);
    try {
      const { assets } = await fetchAssetsFromApi({ scope: 'liked', kind: 'final', limit: 80 });
      setCollectionAssets(assets.map(mapAsset));
    } catch (error) {
      console.error('[MobileMyPage] Failed to load liked assets:', error);
      setCollectionAssets([]);
    } finally {
      setIsLoadingCollections(false);
    }
  }, [mapAsset, user]);

  useEffect(() => {
    if (!user) {
      setMyAssets([]);
      setCollectionAssets([]);
      return;
    }
    fetchMyAssets();
  }, [user, fetchMyAssets]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'publish' || activeTab === 'drafts') {
      fetchMyAssets();
    }
  }, [activeTab, user, fetchMyAssets]);

  useEffect(() => {
    if (activeTab === 'collections' && user) {
      fetchCollectionAssets();
    }
  }, [activeTab, user, fetchCollectionAssets]);

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const navigateToAuth = async (mode: 'signup' | 'login') => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Failed to sign out before switching account:', error);
    }

    if (typeof window !== 'undefined') {
      if (mode === 'signup') {
        window.localStorage.setItem('owm-login-mode', 'signup');
      } else {
        window.localStorage.removeItem('owm-login-mode');
      }
    }

    setShowAccountMenu(false);
    onNavigate?.('login');
  };

  const getSimilarAssets = (asset: Asset) => {
    return myAssets.filter((a) => a.id !== asset.id).slice(0, 6);
  };

  const displayedAssets = useMemo(() => {
    if (activeTab === 'publish') {
      return myAssets.filter((asset) => asset.status === 'public');
    }
    if (activeTab === 'drafts') {
      return myAssets.filter((asset) => asset.status !== 'public');
    }
    return collectionAssets;
  }, [activeTab, myAssets, collectionAssets]);

  const isCurrentTabLoading = activeTab === 'collections' ? isLoadingCollections : isLoadingAssets;

  const handleTogglePublish = async (assetId: string, makePublic: boolean) => {
    // Optimistically update UI
    const nextStatus: AssetStatus = makePublic ? 'public' : 'private';
    const optimisticUpdate = (prev: Asset[]) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, status: nextStatus, isPublic: makePublic } : asset
      );

    setMyAssets(optimisticUpdate);
    setCollectionAssets(optimisticUpdate);
    if (selectedAsset?.id === assetId) {
      setSelectedAsset({ ...selectedAsset, status: nextStatus, isPublic: makePublic });
    }

    try {
      const updated = await updateAssetStatus(assetId, nextStatus);
      const mapped = mapAsset(updated);

      setMyAssets((prev) => prev.map((asset) => (asset.id === assetId ? mapped : asset)));
      setCollectionAssets((prev) =>
        prev.map((asset) => (asset.id === assetId ? mapped : asset))
      );
      setSelectedAsset((prev) => (prev && prev.id === assetId ? mapped : prev));

      // Show success message
      const message = makePublic ? COPY.status.publishSuccess : COPY.status.unpublishSuccess;
      showToast(message);

      // Refresh assets after a short delay to get updated state
      setTimeout(() => {
        fetchMyAssets();
      }, 500);
    } catch (error) {
      console.error('[MobileMyPage] Error toggling publish:', error);

      // Revert optimistic update
      fetchMyAssets();

      alert(COPY.errors.updateFailed);
    }
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeInUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOutDown 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };

  const handleDelete = async (assetId: string) => {
    try {
      await deleteAsset(assetId);
      setMyAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      setCollectionAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      setSelectedAsset((prev) => (prev && prev.id === assetId ? null : prev));
    } catch (error) {
      console.error('[MobileMyPage] Error deleting asset:', error);
      alert(COPY.errors.deleteFailed);
    }
  };

  const handleToggleFavorite = async (assetId: string, shouldLike: boolean) => {
    try {
      await toggleLike(assetId, shouldLike);

      setMyAssets((prev) =>
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

      setCollectionAssets((prev) => {
        if (shouldLike) {
          // Ensure liked asset is present
          const exists = prev.some((asset) => asset.id === assetId);
          if (exists) {
            return prev.map((asset) =>
              asset.id === assetId
                ? {
                    ...asset,
                    liked: true,
                    isLiked: true,
                    likes: Math.max(0, (asset.likes || 0) + 1)
                  }
                : asset
            );
          }
          return prev;
        }
        return prev.filter((asset) => asset.id !== assetId);
      });

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

      if (!shouldLike && activeTab === 'collections') {
        setCollectionAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      }
      if (shouldLike && activeTab === 'collections') {
        fetchCollectionAssets();
      }
    } catch (error) {
      console.error('[MobileMyPage] Error toggling favorite:', error);
      alert(COPY.errors.like);
    }
  };

  return (
    <>
      <MobileLayout
        showHeader={false}
        showBottomNav={false}
        onMenuClick={() => setIsMenuOpen(true)}
      >
        <div className="mypage-content">
          {/* Header with Menu */}
          <div className="mypage-header">
            <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="header-actions">
              <button className="header-text-btn" onClick={() => onNavigate?.('studio')}>OWM</button>
            </div>
          </div>

          {/* Title with Profile */}
          <div className="title-section">
            <h1 className="page-title">{COPY.mypage.title}</h1>
            <div className="profile-avatar-circle">
              <MetaballsBreathing dna={DEFAULT_DNA} animated={true} />
            </div>
          </div>

          {/* Profile Info */}
          <div className="profile-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
              <img
                src={user?.user_metadata?.avatar_url || 'https://via.placeholder.com/32/EEECE6/999?text=U'}
                alt="User"
                style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
              />
              <button
                className="profile-name-btn"
                onClick={() => setShowAccountMenu((prev) => !prev)}
                aria-expanded={showAccountMenu}
                ref={accountTriggerRef}
                style={{ margin: 0, padding: 0, lineHeight: 1 }}
              >
                {user?.user_metadata?.username || user?.email?.split('@')[0] || 'JOHN DEANNA'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 9 12 12 9" />
                </svg>
              </button>
            </div>
            {showAccountMenu && (
              <div className="account-menu" ref={accountMenuRef}>
                <div className="account-menu-item active">
                  <div className="account-menu-label">
                    <span className="name">
                      {user?.user_metadata?.username || user?.email?.split('@')[0] || 'Current User'}
                    </span>
                    <span className="email">{user?.email}</span>
                  </div>
                  <span className="badge">使用中</span>
                </div>
                <button
                  className="account-menu-item add"
                  onClick={() => navigateToAuth('signup')}
                >
                  <span className="icon">＋</span>
                  <span>アカウントを追加</span>
                </button>
                <button
                  className="account-menu-item add"
                  onClick={() => navigateToAuth('login')}
                >
                  <span className="icon">⇆</span>
                  <span>アカウントを切り替える</span>
                </button>
              </div>
            )}
            <div className="profile-rating">
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star">★</span>
              <span className="star empty">☆</span>
            </div>
            <div className="profile-badge">SUBSCRIBED</div>
            <p className={`profile-bio ${isBioExpanded ? 'expanded' : 'collapsed'}`}>
              プロフィール文章が表示されます。プロフィール文章が表示されます。プロフィール文章が表示されます。プロフィール文章が表示されます。
            </p>
            <button className="more-btn" onClick={() => setIsBioExpanded((prev) => !prev)}>
              {isBioExpanded ? 'close' : 'more'}
            </button>
          </div>

          {/* Section Tabs */}
          <div className="section-tabs">
            <button
              className={`section-tab ${activeSection === 'design' ? 'active' : ''}`}
              onClick={() => setActiveSection('design')}
            >
              DESIGN
            </button>
            <button
              className={`section-tab ${activeSection === 'setting' ? 'active' : ''}`}
              onClick={() => setActiveSection('setting')}
            >
              SETTING
            </button>
          </div>

          {activeSection === 'design' && (
            <>
              {/* Sub Tabs */}
              <div className="tabs-container">
                <button
                  className={`tab-btn ${activeTab === 'publish' ? 'active' : ''}`}
                  onClick={() => setActiveTab('publish')}
                >
                  Publish
                </button>
                <button
                  className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('drafts')}
                >
                  Drafts
                </button>
                <button
                  className={`tab-btn ${activeTab === 'collections' ? 'active' : ''}`}
                  onClick={() => setActiveTab('collections')}
                >
                  Collections
                </button>
              </div>

              {/* Grid */}
              <div className="assets-grid">
                {isCurrentTabLoading ? (
                  <div className="loading-message">読み込み中...</div>
                ) : displayedAssets.length > 0 ? (
                  displayedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="asset-card"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="card-image">
                        <img src={asset.src} alt={asset.title} loading="lazy" />
                        {activeTab === 'publish' && asset.price && (
                          <div className="price-badge">¥{asset.price.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>まだ{getTabLabel(activeTab)}がありません</p>
                  </div>
                )}
              </div>

              {/* Create Button */}
              <div className="create-button-container">
                <button className="create-design-btn" onClick={() => onNavigate?.('create')}>
                  あなただけのデザインを完成させよう
                </button>
              </div>
            </>
          )}

          {activeSection === 'setting' && (
            <div className="setting-content">
              <p>設定画面（実装予定）</p>
            </div>
          )}
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
          onPurchase={() => console.log('Purchase')}
          onTogglePublish={handleTogglePublish}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onPublishFromArchive={onPublishFromArchive}
          similarAssets={getSimilarAssets(selectedAsset)}
          isOwner={selectedAsset.userId === user?.id}
          isDraft={activeTab === 'drafts'}
        />
      )}
    </>
  );
}

function getTabLabel(tab: TabType): string {
  const labels: Record<TabType, string> = {
    publish: '公開作品',
    drafts: '下書き',
    collections: 'コレクション',
  };
  return labels[tab];
}
