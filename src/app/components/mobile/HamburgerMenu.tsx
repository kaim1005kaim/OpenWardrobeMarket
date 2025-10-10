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

  // Inline styles for testing
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'all 0.3s ease',
    zIndex: 200,
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '280px',
    maxWidth: '80vw',
    background: '#FFFFFF',
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease',
    zIndex: 201,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '16px',
    borderBottom: '1px solid #E5E5E5',
  };

  const closeBtnStyle: React.CSSProperties = {
    width: '44px',
    height: '44px',
    background: 'none',
    border: 'none',
    fontSize: '32px',
    lineHeight: '1',
    cursor: 'pointer',
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const userSectionStyle: React.CSSProperties = {
    padding: '24px 20px',
    borderBottom: '1px solid #E5E5E5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  };

  const avatarStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#EEECE6',
  };

  const userNameStyle: React.CSSProperties = {
    fontFamily: '"Trajan Pro 3", "Cinzel", serif',
    fontSize: '16px',
    fontWeight: 400,
    color: '#000000',
    margin: 0,
    letterSpacing: '0.5px',
  };

  const taglineStyle: React.CSSProperties = {
    fontFamily: '"Noto Sans JP", sans-serif',
    fontSize: '12px',
    color: '#666666',
    margin: 0,
    textAlign: 'center',
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
  };

  const navLinkStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: '"Trajan Pro 3", "Cinzel", serif',
    fontSize: '13px',
    fontWeight: 400,
    letterSpacing: '1.5px',
    color: '#000000',
    textAlign: 'left',
    transition: 'background 0.2s ease',
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: '#E5E5E5',
    margin: '0 20px',
  };

  const secondaryStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
  };

  const secondaryLinkStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: '"Trajan Pro 3", "Cinzel", serif',
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '1px',
    color: '#666666',
    textAlign: 'left',
    transition: 'color 0.2s ease',
  };

  const footerStyle: React.CSSProperties = {
    marginTop: 'auto',
    padding: '20px',
    borderTop: '1px solid #E5E5E5',
  };

  const logoutBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    background: '#000000',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: '"Trajan Pro 3", "Cinzel", serif',
    fontSize: '13px',
    fontWeight: 400,
    letterSpacing: '2px',
    color: '#FFFFFF',
    transition: 'background 0.2s ease',
  };

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Side Menu */}
      <div style={menuStyle}>
        <div style={headerStyle}>
          <button style={closeBtnStyle} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={userSectionStyle}>
          {user ? (
            <>
              <div style={avatarStyle}>
                <img
                  src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                  alt="User"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/80/EEECE6/999?text=User';
                  }}
                />
              </div>
              <p style={userNameStyle}>
                {user.user_metadata?.username || user.email?.split('@')[0] || 'User'}
              </p>
              <p style={taglineStyle}>あなただけのデザインを完成させよう</p>
            </>
          ) : (
            <div>
              <p style={taglineStyle}>ログインしてください</p>
            </div>
          )}
        </div>

        <nav style={navStyle}>
          <button style={navLinkStyle} onClick={() => handleNavigate('home')}>
            <span style={{ fontSize: '18px' }}>🏠</span>
            <span>HOME</span>
          </button>
          <button style={navLinkStyle} onClick={() => handleNavigate('gallery')}>
            <span style={{ fontSize: '18px' }}>🖼️</span>
            <span>GALLERY</span>
          </button>
          <button style={navLinkStyle} onClick={() => handleNavigate('create')}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <span>CREATE</span>
          </button>
          <button style={navLinkStyle} onClick={() => handleNavigate('mypage')}>
            <span style={{ fontSize: '18px' }}>👤</span>
            <span>MY PAGE</span>
          </button>
        </nav>

        <div style={dividerStyle}></div>

        <div style={secondaryStyle}>
          <button style={secondaryLinkStyle} onClick={() => handleNavigate('faq')}>
            FAQ
          </button>
          <button style={secondaryLinkStyle} onClick={() => handleNavigate('contact')}>
            CONTACT
          </button>
          <button style={secondaryLinkStyle} onClick={() => handleNavigate('privacy')}>
            PRIVACY POLICY
          </button>
        </div>

        {user && (
          <div style={footerStyle}>
            <button style={logoutBtnStyle} onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        )}
      </div>
    </>
  );
}
