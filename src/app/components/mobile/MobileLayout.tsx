import React, { ReactNode } from 'react';
import './MobileLayout.css';

interface MobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  onMenuClick?: () => void;
  onLogoClick?: () => void;
}

export function MobileLayout({
  children,
  showHeader = true,
  showBottomNav = true,
  onMenuClick,
  onLogoClick
}: MobileLayoutProps) {
  return (
    <div className="mobile-layout">
      {showHeader && (
        <header className="mobile-header">
          <button className="hamburger-btn" onClick={onMenuClick}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div
            className="owm-logo-header"
            onClick={onLogoClick}
            style={{ cursor: onLogoClick ? 'pointer' : 'default' }}
          >
            OWM
          </div>
        </header>
      )}

      <main className="mobile-content">
        {children}
      </main>

      {showBottomNav && <div className="bottom-nav-spacer"></div>}
    </div>
  );
}
