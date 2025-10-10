import React from 'react';
import './BottomNavigation.css';

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
    </>
  );
}
