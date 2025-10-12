import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isWebView } from '../lib/utils/detectWebView'
import { WebViewWarning } from './mobile/WebViewWarning'
import './LoginPage.css'

type LoginMode = 'password' | 'magic-link'

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Google login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewAccount = () => {
    navigate('/signup')
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

          {/* Mode Toggle */}
          <div className="login-mode-toggle">
            <button
              className={`login-mode-btn ${mode === 'password' ? 'active' : ''}`}
              onClick={() => setMode('password')}
              disabled={isLoading}
            >
              パスワード
            </button>
            <button
              className={`login-mode-btn ${mode === 'magic-link' ? 'active' : ''}`}
              onClick={() => setMode('magic-link')}
              disabled={isLoading}
            >
              マジックリンク
            </button>
          </div>

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

          {/* Password Login form */}
          {mode === 'password' && (
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

          {/* Magic Link form */}
          {mode === 'magic-link' && (
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
            <button
              onClick={handleGoogleLogin}
              className="auth-link"
              disabled={isLoading}
            >
              Google Login
            </button>
            <button
              onClick={handleNewAccount}
              className="auth-link"
              disabled={isLoading}
            >
              new account
            </button>
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