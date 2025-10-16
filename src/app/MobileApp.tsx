import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { MobileHomePage } from './pages/mobile/MobileHomePage';
import { MobileGalleryPage } from './pages/mobile/MobileGalleryPage';
import { MobileCreateTopPage } from './pages/mobile/MobileCreateTopPage';
import { MobileCreatePage } from './pages/mobile/MobileCreatePage';
import { MobilePublishFormPage, type PublishData } from './pages/mobile/MobilePublishFormPage';
import { MobilePublishCompletePage } from './pages/mobile/MobilePublishCompletePage';
import { MobileMyPage } from './pages/mobile/MobileMyPage';
import { LoginPage } from './components/LoginPage';
import { WebViewWarning } from './components/mobile/WebViewWarning';
import { isWebView } from './lib/utils/detectWebView';
import './MobileApp.css';

type MobilePage = 'login' | 'home' | 'gallery' | 'create' | 'createQuestions' | 'publishForm' | 'publishComplete' | 'mypage' | 'faq' | 'contact' | 'privacy';

function MobileAppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<MobilePage>('home');
  const [showWebViewWarning, setShowWebViewWarning] = useState(false);

  // 公開フロー用のstate
  const [publishImageUrl, setPublishImageUrl] = useState<string | null>(null);
  const [publishGenerationData, setPublishGenerationData] = useState<any>(null);

  useEffect(() => {
    // WebView検出（未認証時のみ）
    if (!user && isWebView()) {
      setShowWebViewWarning(true);
    }
  }, [user]);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as MobilePage);
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '14px',
        color: '#666',
        background: '#EEECE6'
      }}>
        Loading...
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage />;

      case 'home':
        return <MobileHomePage onNavigate={handleNavigate} />;

      case 'gallery':
        return <MobileGalleryPage onNavigate={handleNavigate} />;

      case 'create':
        return <MobileCreateTopPage onNavigate={handleNavigate} onStartCreate={() => setCurrentPage('createQuestions')} />;

      case 'createQuestions':
        return <MobileCreatePage
          onNavigate={handleNavigate}
        />;

      case 'publishForm':
        if (!publishImageUrl) return <MobileHomePage onNavigate={handleNavigate} />;
        return <MobilePublishFormPage
          imageUrl={publishImageUrl}
          generationData={publishGenerationData}
          onNavigate={handleNavigate}
          onPublish={(data) => {
            console.log('[MobileApp] Publishing with data:', data);
            // ここでポスター合成とSupabase保存を行う（実装は後で）
            setCurrentPage('publishComplete');
          }}
        />;

      case 'publishComplete':
        if (!publishImageUrl) return <MobileHomePage onNavigate={handleNavigate} />;
        return <MobilePublishCompletePage
          imageUrl={publishImageUrl}
          onNavigate={handleNavigate}
        />;

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
    <>
      <div className="mobile-app">
        {renderPage()}
      </div>

      {/* WebView Warning Modal */}
      <WebViewWarning
        isOpen={showWebViewWarning}
        onClose={() => setShowWebViewWarning(false)}
      />
    </>
  );
}

export function MobileApp() {
  return (
    <AuthProvider>
      <MobileAppContent />
    </AuthProvider>
  );
}
