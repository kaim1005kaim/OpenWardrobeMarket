import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isWebView } from '../lib/utils/detectWebView'
import { WebViewWarning } from './mobile/WebViewWarning'
import './LoginPage.css'

type PageMode = 'login' | 'signup'
type AuthMode = 'password' | 'magic-link'

export function LoginPage() {
  const [pageMode, setPageMode] = useState<PageMode>('login')
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showWebViewWarning, setShowWebViewWarning] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // WebView検出
    if (isWebView()) {
      setShowWebViewWarning(true)
    }

    if (typeof window !== 'undefined') {
      const storedMode = window.localStorage.getItem('owm-login-mode')
      if (storedMode === 'signup') {
        setPageMode('signup')
        window.localStorage.removeItem('owm-login-mode')
      }
    }
  }, [])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      setShowWelcome(true)
      setTimeout(() => {
        navigate('/gallery')
      }, 1500)
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setMagicLinkSent(true)
    } catch (error: any) {
      console.error('Magic link error:', error)
      setError(error.message || 'メール送信に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    // WebView検出時はモーダルを表示
    if (isWebView()) {
      setShowWebViewWarning(true)
      return
    }

    setIsLoading(true)
    try {
      // Use current origin for development, fixed apex domain for production
      const isDevelopment = window.location.hostname === 'localhost'
      const appOrigin = isDevelopment
        ? window.location.origin
        : (import.meta.env.VITE_PUBLIC_APP_URL || 'https://open-wardrobe-market.com')
      const redirectUrl = isDevelopment
        ? appOrigin
        : appOrigin.replace(/^https?:\/\/www\./, 'https://')

      console.log('[LoginPage] Google OAuth redirect config:', {
        isDevelopment,
        hostname: window.location.hostname,
        origin: window.location.origin,
        appOrigin,
        redirectUrl,
        finalRedirectTo: `${redirectUrl}/auth/callback`
      })

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectUrl}/auth/callback`,
          queryParams: { prompt: 'select_account' }
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Google login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error

      // サインアップ後、自動ログインされたセッションをクリア
      if (data.session) {
        await supabase.auth.signOut()
      }

      alert('確認メールを送信しました。メールのリンクをクリックして登録を完了してください。')
      setPageMode('login')
      setAuthMode('password')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Signup error:', error)
      setError(error.message || '登録に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewAccount = () => {
    setPageMode('signup')
    setAuthMode('password')
    setError(null)
  }

  const handleBackToLogin = () => {
    setPageMode('login')
    setAuthMode('password')
    setError(null)
  }

  return (
    <>
      <div className="login-container">
        {/* Center content */}
        <div className="login-content">
          {/* Title */}
          <div className="brand-title">
            <div>OPEN</div>
            <div>WARDROBE</div>
            <div>MARKET</div>
          </div>

          {/* Mode Toggle - Only show in signup mode */}
          {pageMode === 'signup' && (
            <div className="login-mode-toggle">
              <button
                className={`login-mode-btn ${authMode === 'password' ? 'active' : ''}`}
                onClick={() => setAuthMode('password')}
                disabled={isLoading}
              >
                パスワード
              </button>
              <button
                className={`login-mode-btn ${authMode === 'magic-link' ? 'active' : ''}`}
                onClick={() => setAuthMode('magic-link')}
                disabled={isLoading}
              >
                マジックリンク
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="login-error-message">{error}</div>
          )}

          {/* Magic Link Success Message */}
          {magicLinkSent && (
            <div className="login-success-message">
              ログインリンクをメールで送信しました！<br/>
              メールを確認してください。
            </div>
          )}

          {/* Login Mode Forms */}
          {pageMode === 'login' && (
            <form onSubmit={handleEmailLogin} className="login-form">
              <div className="input-wrapper">
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="input-wrapper">
                <input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? 'ログイン中...' : 'LOGIN'}
              </button>
            </form>
          )}

          {/* Signup Mode - Password */}
          {pageMode === 'signup' && authMode === 'password' && (
            <form onSubmit={handleSignup} className="login-form">
              <div className="input-wrapper">
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="input-wrapper">
                <input
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="input-wrapper">
                <input
                  type="password"
                  placeholder="CONFIRM PASSWORD"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? '登録中...' : 'SIGN UP'}
              </button>
            </form>
          )}

          {/* Signup Mode - Magic Link */}
          {pageMode === 'signup' && authMode === 'magic-link' && (
            <form onSubmit={handleMagicLink} className="login-form">
              <p className="magic-link-info">
                パスワード不要でログインできるリンクを送信します
              </p>
              <div className="input-wrapper">
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="login-input"
                  disabled={isLoading}
                  required
                />
              </div>
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? '送信中...' : 'SEND MAGIC LINK'}
              </button>
            </form>
          )}

          {/* Bottom section */}
          <div className="auth-actions">
            {pageMode === 'login' && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  className="auth-link"
                  disabled={isLoading}
                >
                  GOOGLE LOGIN
                </button>
                <button
                  onClick={handleNewAccount}
                  className="auth-link"
                  disabled={isLoading}
                >
                  NEW ACCOUNT
                </button>
              </>
            )}
            {pageMode === 'signup' && (
              <button
                onClick={handleBackToLogin}
                className="auth-link"
                disabled={isLoading}
              >
                BACK TO LOGIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WebView Warning Modal */}
      <WebViewWarning
        isOpen={showWebViewWarning}
        onClose={() => setShowWebViewWarning(false)}
      />
    </>
  )
}
