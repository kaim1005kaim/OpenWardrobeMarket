import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../lib/AuthContext';
import './MenuOverlay.css';

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export function MenuOverlay({ isOpen, onClose, onNavigate }: MenuOverlayProps) {
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  if (!isOpen) return null;

  const menuContent = (
    <div className="menu-overlay-container">
      <div className="menu-overlay-backdrop" onClick={onClose} />

      <div className="menu-overlay-content">
        <button className="menu-close-button" onClick={onClose} aria-label="Close menu">
          ✕
        </button>

        <nav className="menu-nav-main">
          <button onClick={() => handleNavigate('home')}>TOP</button>
          <button onClick={() => handleNavigate('gallery')}>GALLERY</button>
          <button onClick={() => handleNavigate('create')}>CREATE</button>
          <button onClick={() => handleNavigate('mypage')}>MY PAGE</button>
        </nav>

        <div className="menu-nav-secondary">
          <button onClick={() => handleNavigate('faq')}>FAQ</button>
          <button onClick={() => handleNavigate('privacy')}>PRIVACY POLICY</button>
          <button onClick={() => handleNavigate('contact')}>CONTACT</button>
        </div>

        {user && (
          <div className="menu-footer-section">
            <div className="menu-username">
              {user.user_metadata?.username || user.email?.split('@')[0] || 'USER NAME'}
            </div>
            <button className="menu-logout-button" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}
