import { useState } from 'react';
import { AuthProvider } from './lib/AuthContext';
import { MobileHomePage } from './pages/mobile/MobileHomePage';
import { MobileGalleryPage } from './pages/mobile/MobileGalleryPage';
import { MobileCreatePage } from './pages/mobile/MobileCreatePage';
import { MobileMyPage } from './pages/mobile/MobileMyPage';
import { LoginPage } from './components/LoginPage';

type MobilePage = 'login' | 'home' | 'gallery' | 'create' | 'mypage' | 'faq' | 'contact' | 'privacy';

export function MobileApp() {
  const [currentPage, setCurrentPage] = useState<MobilePage>('home');

  const handleNavigate = (page: string) => {
    setCurrentPage(page as MobilePage);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage />;

      case 'home':
        return <MobileHomePage onNavigate={handleNavigate} />;

      case 'gallery':
        return <MobileGalleryPage onNavigate={handleNavigate} />;

      case 'create':
        return <MobileCreatePage onNavigate={handleNavigate} />;

      case 'mypage':
        return <MobileMyPage onNavigate={handleNavigate} />;

      case 'faq':
      case 'contact':
      case 'privacy':
        return (
          <div style={{
            padding: '80px 20px',
            textAlign: 'center',
            fontFamily: 'Noto Sans CJK JP, sans-serif'
          }}>
            <h2>{currentPage.toUpperCase()} ページ</h2>
            <p style={{ color: '#666', marginTop: '16px' }}>準備中...</p>
            <button
              onClick={() => setCurrentPage('home')}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ホームに戻る
            </button>
          </div>
        );

      default:
        return <MobileHomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
      <div className="mobile-app">
        {renderPage()}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
            'Noto Sans CJK JP', 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: #FFFFFF;
        }

        .mobile-app {
          min-height: 100vh;
          background: #FFFFFF;
        }

        /* Figma Design Fonts */
        @import url('https://fonts.googleapis.com/css2?family=Trajan+Pro:wght@400;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Major+Mono+Display&display=swap');

        /* Import fonts */
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap');
      `}</style>
    </AuthProvider>
  );
}
