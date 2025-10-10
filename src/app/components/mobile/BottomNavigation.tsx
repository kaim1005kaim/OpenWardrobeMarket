import React from 'react';

type TabType = 'home' | 'gallery' | 'create' | 'mypage';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = [
    { id: 'home' as TabType, label: 'HOME', icon: '🏠' },
    { id: 'gallery' as TabType, label: 'GALLERY', icon: '🖼️' },
    { id: 'create' as TabType, label: 'CREATE', icon: '✨' },
    { id: 'mypage' as TabType, label: 'MY PAGE', icon: '👤' }
  ];

  return (
    <>
      <nav className="bottom-navigation">
        <div className="nav-content">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="footer-info">
          <div className="footer-links">
            <a href="/faq">FAQ</a>
            <a href="/privacy">privacy policy</a>
            <a href="/contact">contact</a>
          </div>
          <div className="copyright">
            <p>OPEN WARDROBE MARKET</p>
            <p className="small">©︎ OPEN WARDROBE MARKET. All rights reserved.</p>
          </div>
        </div>
      </nav>

      <style jsx>{`
        .bottom-navigation {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #FFFFFF;
          border-top: 1px solid #E5E5E5;
          z-index: 100;
          padding-bottom: env(safe-area-inset-bottom);
        }

        .nav-content {
          display: flex;
          justify-content: space-around;
          align-items: center;
          height: 64px;
          padding: 0 8px;
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          transition: all 0.2s ease;
          color: #666666;
        }

        .nav-item.active {
          color: #000000;
        }

        .nav-icon {
          font-size: 20px;
          line-height: 1;
        }

        .nav-label {
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .footer-info {
          background: #F5F5F5;
          padding: 16px;
          font-size: 11px;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .footer-links a {
          color: #666666;
          text-decoration: none;
          font-family: 'Noto Sans CJK JP', sans-serif;
        }

        .footer-links a:hover {
          color: #000000;
        }

        .copyright {
          text-align: center;
          color: #666666;
        }

        .copyright p {
          margin: 4px 0;
          font-family: 'Montserrat', sans-serif;
          font-weight: 600;
          letter-spacing: 1px;
        }

        .copyright .small {
          font-size: 9px;
          font-weight: 400;
          opacity: 0.7;
        }

        /* Responsive */
        @media (min-width: 768px) {
          .bottom-navigation {
            max-width: 428px;
            left: 50%;
            transform: translateX(-50%);
          }
        }
      `}</style>
    </>
  );
}
