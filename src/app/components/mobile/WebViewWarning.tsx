import React from 'react';
import { getBrowserName, getExternalBrowserUrl, copyUrlToClipboard } from '../../lib/utils/detectWebView';
import './WebViewWarning.css';

interface WebViewWarningProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebViewWarning({ isOpen, onClose }: WebViewWarningProps) {
  const [copySuccess, setCopySuccess] = React.useState(false);
  const browserName = getBrowserName();
  const externalUrl = getExternalBrowserUrl();

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    const success = await copyUrlToClipboard();
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleOpenInSafari = () => {
    // iOSの場合、Safariで開く
    window.location.href = externalUrl;
  };

  const isIOS = typeof navigator !== 'undefined' &&
                (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'));

  return (
    <div className="webview-warning-overlay">
      <div className="webview-warning-modal">
        <button className="webview-warning-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="webview-warning-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="webview-warning-title">外部ブラウザで開いてください</h2>

        {browserName && (
          <p className="webview-warning-browser">
            現在、{browserName}の内蔵ブラウザで開いています
          </p>
        )}

        <p className="webview-warning-description">
          Googleのセキュリティポリシーにより、アプリ内ブラウザからのログインはできません。
          下記の手順で外部ブラウザ（Safari、Chrome等）で開いてください。
        </p>

        <div className="webview-warning-steps">
          <div className="webview-warning-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <p className="step-title">URLをコピー</p>
              <p className="step-description">下のボタンでURLをコピーしてください</p>
            </div>
          </div>

          <div className="webview-warning-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <p className="step-title">ブラウザで開く</p>
              <p className="step-description">Safari、Chrome等のブラウザを起動してURLを貼り付けてください</p>
            </div>
          </div>
        </div>

        <div className="webview-warning-actions">
          <button
            className="webview-warning-btn webview-warning-btn-primary"
            onClick={handleCopyUrl}
          >
            {copySuccess ? '✓ コピーしました' : 'URLをコピー'}
          </button>

          {isIOS && (
            <button
              className="webview-warning-btn webview-warning-btn-secondary"
              onClick={handleOpenInSafari}
            >
              Safariで開く
            </button>
          )}
        </div>

        <p className="webview-warning-footer">
          ご不便をおかけして申し訳ございません
        </p>
      </div>
    </div>
  );
}
