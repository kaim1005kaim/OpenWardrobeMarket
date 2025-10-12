import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isWebView } from '../lib/utils/detectWebView'
import { WebViewWarning } from './mobile/WebViewWarning'
import './LoginPage.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showWebViewWarning, setShowWebViewWarning] = useState(false)
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
    } catch (error) {
      console.error('Login error:', error)
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

          {/* Login form */}
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="input-wrapper">
              <input
                type="email"
                placeholder="ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                disabled={isLoading}
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
              />
            </div>
          </form>

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