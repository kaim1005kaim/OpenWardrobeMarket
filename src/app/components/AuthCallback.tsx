import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URLからコードを取得
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')

        if (!code) {
          console.log('No auth code found, checking existing session...')
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('Existing session found, redirecting...')
            navigate('/')
            return
          }
          console.error('No auth code and no existing session')
          navigate('/')
          return
        }

        // exchangeCodeForSessionを呼び出す
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.error('Auth callback error:', error)
          // PKCEエラーの場合、既存のセッションをチェック
          if (error.message?.includes('code verifier')) {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              console.log('Session exists despite PKCE error, redirecting...')
              navigate('/')
              return
            }
          }
          navigate('/')
          return
        }

        console.log('Authentication successful')
        navigate('/')
      } catch (error) {
        console.error('Auth callback exception:', error)
        navigate('/')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">認証中...</p>
      </div>
    </div>
  )
}