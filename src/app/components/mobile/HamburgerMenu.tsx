import React, { useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import './HamburgerMenu.css';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export function HamburgerMenu({ isOpen, onClose, onNavigate }: HamburgerMenuProps) {
  const { user, signOut } = useAuth();

  // Prevent body scroll when menu is open
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`menu-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Side Menu */}
      <div className={`hamburger-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="menu-user">
          {user ? (
            <>
              <div className="user-avatar">
                <img
                  src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                  alt="User"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/80/EEECE6/999?text=User';
                  }}
                />
              </div>
              <p className="user-name">
                {user.user_metadata?.username || user.email?.split('@')[0] || 'User'}
              </p>
              <p className="user-tagline">あなただけのデザインを完成させよう</p>
            </>
          ) : (
            <div className="user-guest">
              <p>ログインしてください</p>
            </div>
          )}
        </div>

        <nav className="menu-nav">
          <button className="nav-link" onClick={() => handleNavigate('home')}>
            <span className="icon">🏠</span>
            <span>HOME</span>
          </button>
          <button className="nav-link" onClick={() => handleNavigate('gallery')}>
            <span className="icon">🖼️</span>
            <span>GALLERY</span>
          </button>
          <button className="nav-link" onClick={() => handleNavigate('create')}>
            <span className="icon">✨</span>
            <span>CREATE</span>
          </button>
          <button className="nav-link" onClick={() => handleNavigate('mypage')}>
            <span className="icon">👤</span>
            <span>MY PAGE</span>
          </button>
        </nav>

        <div className="menu-divider"></div>

        <div className="menu-secondary">
          <button className="secondary-link" onClick={() => handleNavigate('faq')}>
            FAQ
          </button>
          <button className="secondary-link" onClick={() => handleNavigate('contact')}>
            CONTACT
          </button>
          <button className="secondary-link" onClick={() => handleNavigate('privacy')}>
            PRIVACY POLICY
          </button>
        </div>

        {user && (
          <div className="menu-footer">
            <button className="logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        )}
      </div>
    </>
  );
}
