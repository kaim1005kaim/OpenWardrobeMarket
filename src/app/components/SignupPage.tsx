import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import './SignupPage.css'

type AuthMode = 'signup' | 'magic-link'

export function SignupPage() {
  const [mode, setMode] = useState<AuthMode>('signup')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const navigate = useNavigate()

  const validateEmail = (email: string): boolean => {
    // より厳密なメールバリデーション
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

    // 一般的なテストメールを拒否
    const blockedPatterns = [
      'test@test',
      'example@example',
      'aaa@aaa',
      'admin@admin',
      'test@email'
    ]

    const emailLower = email.toLowerCase()

    // ブロックパターンチェック
    for (const pattern of blockedPatterns) {
      if (emailLower.includes(pattern)) {
        return false
      }
    }

    return emailRegex.test(email)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // メールアドレスの検証
    if (!validateEmail(email)) {
      setError('有効なメールアドレスを入力してください')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      // Create auth account with email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (authError) throw authError

      // Success - show success message immediately
      setSuccess(true)
      setIsLoading(false)

      // Create user profile via API endpoint (in background)
      if (authData.user) {
        // Create profile after showing success
        setTimeout(async () => {
          try {
            const response = await fetch('/api/create-user-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: authData.user.id,
                username: username,
                email: email
              })
            })

            const result = await response.json()
            if (result.warning) {
              console.warn('Profile creation warning:', result.warning)
            } else if (result.success) {
              console.log('Profile created successfully')
            }
          } catch (error) {
            console.error('Profile API error:', error)
            // Profile creation failed but auth succeeded
          }
        }, 1000)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create account')
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateEmail(email)) {
      setError('有効なメールアドレスを入力してください')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setMagicLinkSent(true)
      setIsLoading(false)
    } catch (error: any) {
      setError(error.message || 'メール送信に失敗しました')
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="signup-container">
      {/* Top white line */}
      <div className="top-line"></div>

      {/* Title on the left side */}
      <div className="brand-title">
        <div>{mode === 'signup' ? 'CREATE' : 'MAGIC'}</div>
        <div>{mode === 'signup' ? 'NEW' : 'LINK'}</div>
        <div>{mode === 'signup' ? 'ACCOUNT' : 'LOGIN'}</div>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => setMode('signup')}
          disabled={isLoading}
        >
          新規登録
        </button>
        <button
          className={`mode-btn ${mode === 'magic-link' ? 'active' : ''}`}
          onClick={() => setMode('magic-link')}
          disabled={isLoading}
        >
          マジックリンク
        </button>
      </div>

      {/* Magic Link Success Message Overlay */}
      {magicLinkSent && (
        <div className="success-overlay">
          <div className="success-modal">
            <div className="success-icon">✉</div>
            <h2 className="success-title">MAGIC LINK SENT</h2>
            <p className="success-message">
              ログインリンクをメールで送信しました！<br/>
              メールのリンクをクリックしてログインしてください。
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: '20px',
                padding: '10px 30px',
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                fontFamily: "'Cinzel', serif",
                fontSize: '12px',
                letterSpacing: '0.15em',
                cursor: 'pointer'
              }}
            >
              ログインページへ
            </button>
          </div>
        </div>
      )}

      {/* Success Message Overlay */}
      {success && (
        <div className="success-overlay">
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <h2 className="success-title">ACCOUNT CREATED</h2>
            <p className="success-message">
              アカウントが作成されました!<br/>
              ログインページからアクセスできます。
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: '20px',
                padding: '10px 30px',
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                fontFamily: "'Cinzel', serif",
                fontSize: '12px',
                letterSpacing: '0.15em',
                cursor: 'pointer'
              }}
            >
              ログインページへ
            </button>
          </div>
        </div>
      )}

      {/* Signup Form */}
      {mode === 'signup' && (
        <form onSubmit={handleSignup} className="signup-form">
          {error && (
            <div className="error-message">{error}</div>
          )}
          <input
            type="text"
            placeholder="USERNAME"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="signup-input"
            disabled={isLoading}
            required
          />
          <input
            type="email"
            placeholder="EMAIL ADDRESS"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="signup-input"
            disabled={isLoading}
            required
          />
          <input
            type="password"
            placeholder="PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="signup-input"
            disabled={isLoading}
            required
          />
          <input
            type="password"
            placeholder="CONFIRM PASSWORD"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="signup-input"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            className="signup-submit-button"
            disabled={isLoading}
          >
            {isLoading ? '登録中...' : 'CREATE ACCOUNT'}
          </button>
        </form>
      )}

      {/* Magic Link Form */}
      {mode === 'magic-link' && (
        <form onSubmit={handleMagicLink} className="signup-form">
          {error && (
            <div className="error-message">{error}</div>
          )}
          <p className="magic-link-description">
            パスワード不要でログインできるリンクをメールで送信します
          </p>
          <input
            type="email"
            placeholder="EMAIL ADDRESS"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="signup-input"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            className="signup-submit-button"
            disabled={isLoading}
          >
            {isLoading ? '送信中...' : 'SEND MAGIC LINK'}
          </button>
        </form>
      )}

      {/* Bottom section */}
      <div className="bottom-section">
        <div className="bottom-line"></div>
        <div className="auth-buttons">
          <button
            onClick={handleBack}
            className="auth-button"
            disabled={isLoading}
          >
            BACK TO LOGIN
          </button>
        </div>
      </div>
    </div>
  )
}