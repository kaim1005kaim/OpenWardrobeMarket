/**
 * WebView（アプリ内ブラウザ）を検出するユーティリティ
 * GoogleはWebViewからのOAuth認証を禁止しているため、検出が必要
 */

export function isWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;

  // iOS WebView (Safari UIがない)
  const isIOSWebView = (ua.includes('iPhone') || ua.includes('iPad')) &&
                       !ua.includes('Safari');

  // Android WebView
  const isAndroidWebView = ua.includes('wv');

  // LINE内ブラウザ
  const isLINE = ua.includes('Line');

  // Instagram内ブラウザ
  const isInstagram = ua.includes('Instagram');

  // Facebook内ブラウザ
  const isFacebook = ua.includes('FBAV') || ua.includes('FBAN');

  // Twitter (X) 内ブラウザ
  const isTwitter = ua.includes('Twitter');

  return isIOSWebView || isAndroidWebView || isLINE ||
         isInstagram || isFacebook || isTwitter;
}

export function getBrowserName(): string | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  const ua = navigator.userAgent;

  if (ua.includes('Line')) return 'LINE';
  if (ua.includes('Instagram')) return 'Instagram';
  if (ua.includes('FBAV') || ua.includes('FBAN')) return 'Facebook';
  if (ua.includes('Twitter')) return 'Twitter (X)';

  return null;
}

export function getExternalBrowserUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const currentUrl = window.location.href;

  // iOSの場合、Safari用のURLスキーム（そのまま返す）
  if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
    return currentUrl;
  }

  // Androidの場合、Chrome用のintent URLスキーム
  if (navigator.userAgent.includes('Android')) {
    const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`;
    return intentUrl;
  }

  return currentUrl;
}

export function copyUrlToClipboard(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return Promise.resolve(false);
  }

  const url = window.location.href;

  // Modern clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(url)
      .then(() => true)
      .catch(() => false);
  }

  // Fallback method
  try {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve(successful);
  } catch (err) {
    return Promise.resolve(false);
  }
}
