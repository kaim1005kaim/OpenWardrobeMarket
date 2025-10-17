import React from 'react';
import { COPY } from '../../../constants/copy';
import './BottomNavigation.css';

type TabType = 'studio' | 'showcase' | 'create' | 'archive';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = [
    { id: 'studio' as TabType, label: COPY.nav.STUDIO, icon: '🏠' },
    { id: 'showcase' as TabType, label: COPY.nav.SHOWCASE, icon: '🖼️' },
    { id: 'create' as TabType, label: COPY.nav.CREATE, icon: '✨' },
    { id: 'archive' as TabType, label: COPY.nav.ARCHIVE, icon: '👤' }
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
            <a href="/faq">{COPY.footer.faq}</a>
            <a href="/privacy">{COPY.footer.privacy}</a>
            <a href="/contact">{COPY.footer.contact}</a>
          </div>
          <div className="copyright">
            <p>{COPY.footer.brand}</p>
            <p className="small">{COPY.footer.copyright}</p>
          </div>
        </div>
      </nav>
    </>
  );
}
