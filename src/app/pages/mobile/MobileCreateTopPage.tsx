import React, { useState } from 'react';
import { MenuOverlay } from '../../components/mobile/MenuOverlay';
import MetaballsSoft from '../../../components/MetaballsSoft';
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
        <button className="create-logo-btn" onClick={() => onNavigate?.('home')}>OWM</button>
      </header>

      <div className="create-top-content">
        {/* メタボール（設問画面と同じ位置） */}
        <div style={{ position: 'relative', width: 'calc(100% + 40px)', height: '320px', marginTop: '0', marginBottom: '32px', marginLeft: '-20px', marginRight: '-20px' }}>
          <div style={{ position: 'absolute', top: '-60px', left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
            <MetaballsSoft animated={true} />
          </div>
          {/* CREATEタイトル（エフェクトの上に重ねる） */}
          <div style={{ position: 'absolute', top: '8px', left: '20px', right: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 70 }}>
            <h1 className="create-top-title">CREATE</h1>
            {/* 説明テキスト */}
            <p className="create-top-description">
              選んで、答えて、話しかけて、<br />
              あなただけのデザインをつくろう
            </p>
          </div>
        </div>

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
