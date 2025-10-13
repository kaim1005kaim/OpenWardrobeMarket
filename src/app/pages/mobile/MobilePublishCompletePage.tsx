import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import './MobilePublishCompletePage.css';

interface MobilePublishCompletePageProps {
  onNavigate?: (page: string) => void;
  imageUrl: string;
}

export function MobilePublishCompletePage({ onNavigate, imageUrl }: MobilePublishCompletePageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <div className="mobile-publish-complete-page">
      {/* Header */}
      <header className="complete-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="logo-btn" onClick={() => onNavigate?.('home')}>OWM</button>
      </header>

      <div className="complete-content">
        <h1 className="complete-title">COMPLETE</h1>

        {/* プレビュー画像 */}
        <div className="complete-image-container">
          <img src={imageUrl} alt="公開された画像" />
        </div>

        {/* メッセージ */}
        <p className="complete-message">デザインが公開されました</p>

        {/* ボタン */}
        <div className="complete-buttons">
          <button
            className="view-gallery-btn"
            onClick={() => onNavigate?.('gallery')}
          >
            公開ページを見る
          </button>
          <button
            className="create-new-btn"
            onClick={() => onNavigate?.('create')}
          >
            次の新しいデザインをつくる
          </button>
        </div>
      </div>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
    </div>
  );
}
