import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { UrulaProvider } from './lib/UrulaContext';
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
import { loadUrulaTextures } from '../lib/urula/loadTextures';
import './MobileApp.css';

type MobilePage = 'login' | 'studio' | 'showcase' | 'create' | 'createQuestions' | 'publishForm' | 'publishComplete' | 'archive' | 'faq' | 'contact' | 'privacy';

function MobileAppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<MobilePage>(() => {
    // Initialize from URL path
    const path = window.location.pathname.slice(1) || 'studio';
    const validPages: MobilePage[] = ['login', 'studio', 'showcase', 'create', 'createQuestions', 'publishForm', 'publishComplete', 'archive', 'faq', 'contact', 'privacy'];
    return validPages.includes(path as MobilePage) ? (path as MobilePage) : 'studio';
  });
  const [showWebViewWarning, setShowWebViewWarning] = useState(false);

  // 公開フロー用のstate
  const [publishImageUrl, setPublishImageUrl] = useState<string | null>(null);
  const [publishGenerationData, setPublishGenerationData] = useState<any>(null);

  // Function to start publish flow from ARCHIVE with existing image
  const handlePublishFromArchive = (imageUrl: string, generationData?: any) => {
    setPublishImageUrl(imageUrl);
    setPublishGenerationData(generationData || null);
    handleNavigate('publishForm');
  };

  // Initialize URL on first load
  useEffect(() => {
    // Set initial history state if not already set
    if (!window.history.state?.page) {
      window.history.replaceState({ page: currentPage }, '', `/${currentPage}`);
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const page = event.state?.page || 'studio';
      setCurrentPage(page as MobilePage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // WebView検出（未認証時のみ）
    if (!user && isWebView()) {
      setShowWebViewWarning(true);
    }
  }, [user]);

  // Preload Urula textures on app mount
  useEffect(() => {
    loadUrulaTextures().catch(err => {
      console.error('[MobileApp] Failed to preload textures:', err);
    });
  }, []);

  const handleNavigate = (page: string) => {
    const newPage = page as MobilePage;
    setCurrentPage(newPage);

    // Update URL and browser history
    const url = `/${page}`;
    window.history.pushState({ page: newPage }, '', url);
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

      case 'studio':
        return <MobileHomePage onNavigate={handleNavigate} />;

      case 'showcase':
        return <MobileGalleryPage onNavigate={handleNavigate} />;

      case 'create':
        // Redirect to createQuestions (unified page with start stage)
        setCurrentPage('createQuestions');
        return null;

      case 'createQuestions':
        return <MobileCreatePage
          onNavigate={handleNavigate}
          onStartPublish={(imageUrl, generationData) => {
            setPublishImageUrl(imageUrl);
            setPublishGenerationData(generationData);
            setCurrentPage('publishForm');
          }}
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

      case 'archive':
        return <MobileMyPage
          onNavigate={handleNavigate}
          onPublishFromArchive={handlePublishFromArchive}
        />;

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
              onClick={() => setCurrentPage('studio')}
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
      <UrulaProvider>
        <MobileAppContent />
      </UrulaProvider>
    </AuthProvider>
  );
}
