import React, { useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';

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

      <style jsx>{`
        .menu-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
          z-index: 200;
        }

        .menu-backdrop.open {
          opacity: 1;
          visibility: visible;
        }

        .hamburger-menu {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          max-width: 80vw;
          background: #FFFFFF;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          z-index: 201;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .hamburger-menu.open {
          transform: translateX(0);
        }

        /* Header */
        .menu-header {
          display: flex;
          justify-content: flex-end;
          padding: 16px;
          border-bottom: 1px solid #E5E5E5;
        }

        .close-btn {
          width: 40px;
          height: 40px;
          background: none;
          border: none;
          font-size: 32px;
          line-height: 1;
          cursor: pointer;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* User Section */
        .menu-user {
          padding: 24px 20px;
          text-align: center;
          border-bottom: 1px solid #E5E5E5;
        }

        .user-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          margin: 0 auto 12px;
          background: #EEECE6;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-name {
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 16px;
          font-weight: 400;
          color: #000000;
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
        }

        .user-tagline {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 12px;
          color: #666666;
          margin: 0;
        }

        .user-guest {
          padding: 20px 0;
        }

        .user-guest p {
          font-family: "Noto Sans JP", sans-serif;
          font-size: 14px;
          color: #666666;
          margin: 0;
        }

        /* Navigation */
        .menu-nav {
          padding: 16px 0;
        }

        .nav-link {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 1.5px;
          color: #000000;
          text-align: left;
          transition: background 0.2s ease;
        }

        .nav-link:hover {
          background: #F5F5F5;
        }

        .nav-link .icon {
          font-size: 20px;
          width: 24px;
          text-align: center;
        }

        /* Divider */
        .menu-divider {
          height: 1px;
          background: #E5E5E5;
          margin: 8px 20px;
        }

        /* Secondary Links */
        .menu-secondary {
          padding: 16px 0;
        }

        .secondary-link {
          width: 100%;
          display: block;
          padding: 12px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: "Noto Sans JP", sans-serif;
          font-size: 12px;
          font-weight: 400;
          color: #666666;
          text-align: left;
          transition: color 0.2s ease;
        }

        .secondary-link:hover {
          color: #000000;
        }

        /* Footer */
        .menu-footer {
          margin-top: auto;
          padding: 20px;
          border-top: 1px solid #E5E5E5;
        }

        .logout-btn {
          width: 100%;
          padding: 14px;
          background: #000000;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: "Trajan Pro 3", "Cinzel", serif;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 2px;
          color: #FFFFFF;
          transition: background 0.2s ease;
        }

        .logout-btn:hover {
          background: #333333;
        }
      `}</style>
    </>
  );
}
