import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import { MetaballsBreathing } from '../../../components/Urula/MetaballsBreathing';
import { DEFAULT_DNA } from '../../../types/dna';
import './MobileCreateTopPage.css';

interface MobileCreateTopPageProps {
  onNavigate?: (page: string) => void;
  onStartCreate?: () => void;
}

export function MobileCreateTopPage({ onNavigate, onStartCreate }: MobileCreateTopPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const handleStartCreate = () => {
    if (onStartCreate) {
      onStartCreate();
    }
  };

  return (
    <div className="mobile-create-top-page">
      {/* Header */}
      <header className="create-top-header">
        <button
          className="hamburger-btn"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="create-logo-btn" onClick={() => onNavigate?.('studio')}>OWM</button>
      </header>

      <div className="create-top-content">
        {/* メタボールエリア */}
        <div className="create-hero">
          <div className="create-hero__canvas">
            <MetaballsBreathing dna={DEFAULT_DNA} animated={true} />
          </div>
          <div className="create-hero__title">
            <h1 className="create-title">CREATE</h1>
          </div>
        </div>

        {/* 説明テキスト */}
        <p className="create-top-description">
          選んで、答えて、話しかけて、<br />
          あなただけのデザインをつくろう
        </p>

        {/* デザインを始めるボタン */}
        <button className="start-btn" onClick={handleStartCreate}>
          デザインを始める
        </button>

        {/* 使い方リンク */}
        <button className="how-to-btn" onClick={() => console.log('Navigate to how-to')}>
          使い方
        </button>
      </div>

      <MenuOverlay
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleMenuNavigate}
      />
    </div>
  );
}
