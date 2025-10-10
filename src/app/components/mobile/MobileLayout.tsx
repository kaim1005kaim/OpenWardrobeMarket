import React, { ReactNode } from 'react';
import './MobileLayout.css';

interface MobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  title?: string;
  onMenuClick?: () => void;
}

export function MobileLayout({
  children,
  showHeader = true,
  showBottomNav = true,
  title = 'OWM',
  onMenuClick
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
          <h1 className="mobile-title">{title}</h1>
          <div className="header-spacer"></div>
        </header>
      )}

      <main className="mobile-content">
        {children}
      </main>

      {showBottomNav && <div className="bottom-nav-spacer"></div>}
    </div>
  );
}
