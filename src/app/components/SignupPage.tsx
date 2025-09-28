import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import './SignupPage.css'

export function SignupPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
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

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="signup-container">
      {/* Top white line */}
      <div className="top-line"></div>

      {/* Title on the left side */}
      <div className="brand-title">
        <div>CREATE</div>
        <div>NEW</div>
        <div>ACCOUNT</div>
      </div>

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

      {/* Center signup form */}
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
          CREATE ACCOUNT
        </button>
      </form>

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