import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/?error=auth_failed')
        } else {
          // Successfully confirmed email and logged in
          navigate('/gallery?confirmed=true')
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        navigate('/')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: "'Cinzel', serif"
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', letterSpacing: '0.1em' }}>
          CONFIRMING EMAIL...
        </h2>
        <p style={{ opacity: 0.8 }}>Please wait while we verify your account</p>
      </div>
    </div>
  )
}