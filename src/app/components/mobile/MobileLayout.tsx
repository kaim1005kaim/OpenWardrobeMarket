import React, { ReactNode } from 'react';

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

      <style jsx>{`
        .mobile-layout {
          width: 100%;
          min-height: 100vh;
          background: #EEECE6;
          position: relative;
        }

        /* Header */
        .mobile-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #EEECE6;
          border-bottom: 1px solid #E5E5E5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 100;
        }

        .hamburger-btn {
          width: 44px;
          height: 44px;
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 0;
        }

        .hamburger-btn span {
          width: 24px;
          height: 2px;
          background: #000000;
          display: block;
          transition: all 0.3s ease;
        }

        .mobile-title {
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-weight: 400;
          font-size: 18px;
          letter-spacing: 2px;
          color: #000000;
          margin: 0;
        }

        .header-spacer {
          width: 40px;
        }

        /* Content */
        .mobile-content {
          padding-top: 60px;
          padding-bottom: 80px;
          min-height: calc(100vh - 140px);
        }

        .bottom-nav-spacer {
          height: 80px;
        }

        /* Responsive */
        @media (min-width: 768px) {
          .mobile-layout {
            max-width: 428px;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </div>
  );
}
