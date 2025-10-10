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

  return (
    <>
      <div className="hamburger-backdrop" onClick={onClose} />

      <div className="hamburger-menu">
        <button className="hamburger-close-btn" onClick={onClose}>
          ✕
        </button>

        <nav className="hamburger-nav">
          <button className="hamburger-nav-item" onClick={() => handleNavigate('home')}>
            HOME
          </button>
          <button className="hamburger-nav-item" onClick={() => handleNavigate('gallery')}>
            GALLERY
          </button>
          <button className="hamburger-nav-item" onClick={() => handleNavigate('create')}>
            CREATE
          </button>
          <button className="hamburger-nav-item" onClick={() => handleNavigate('mypage')}>
            MY PAGE
          </button>
        </nav>

        <div className="hamburger-secondary">
          <button className="hamburger-secondary-item" onClick={() => handleNavigate('faq')}>
            FAQ
          </button>
          <button className="hamburger-secondary-item" onClick={() => handleNavigate('privacy')}>
            PRIVACY POLICY
          </button>
          <button className="hamburger-secondary-item" onClick={() => handleNavigate('contact')}>
            CONTACT
          </button>
        </div>

        {user && (
          <div className="hamburger-footer">
            <div className="hamburger-username">
              {user.user_metadata?.username || user.email?.split('@')[0] || 'USER NAME'}
            </div>
            <button className="hamburger-logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        )}
      </div>
    </>
  );
}
