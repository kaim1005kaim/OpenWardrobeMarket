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
  const navigate = useNavigate()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
      // Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          }
        }
      })

      if (authError) throw authError

      // Create user profile via API endpoint
      if (authData.user) {
        // Small delay to ensure auth user is created in database
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
        }, 500)
      }

      // Success - redirect to login
      navigate('/')
    } catch (error: any) {
      setError(error.message || 'Failed to create account')
    } finally {
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