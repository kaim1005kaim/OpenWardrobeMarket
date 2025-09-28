import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import './LoginPage.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      navigate('/gallery')
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
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
    <div className="login-container">
      {/* Top white line */}
      <div className="top-line"></div>

      {/* Title on the left side */}
      <div className="brand-title">
        <div>OPEN</div>
        <div>WARDROBE</div>
        <div>MARKET</div>
      </div>

      {/* Center login form */}
      <form onSubmit={handleEmailLogin} className="login-form">
        <input
          type="email"
          placeholder="ID"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="login-input"
          style={{ textTransform: 'none' }}
          disabled={isLoading}
        />
        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-input"
          style={{ textTransform: 'none' }}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="login-submit-button"
          disabled={isLoading}
        >
          LOGIN
        </button>
      </form>

      {/* Bottom section */}
      <div className="bottom-section">
        <div className="bottom-line"></div>
        <div className="auth-buttons">
          <button
            onClick={handleGoogleLogin}
            className="auth-button"
            disabled={isLoading}
          >
            GOOGLE LOGIN
          </button>
          <button
            onClick={handleNewAccount}
            className="auth-button"
            disabled={isLoading}
          >
            NEW ACCOUNT
          </button>
        </div>
      </div>

    </div>
  )
}