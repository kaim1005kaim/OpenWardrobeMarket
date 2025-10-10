import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LoginPage } from './app/components/LoginPage.tsx'
import { GalleryPage } from './app/components/GalleryPage.tsx'
import { SignupPage } from './app/components/SignupPage.tsx'
import { AuthCallback } from './app/pages/auth/callback.tsx'
import { MobileApp } from './app/MobileApp.tsx'
import { supabase } from './app/lib/supabase.ts'
import './styles/globals.css'

// デバイス判定フック
function useDeviceType() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      // 画面幅とタッチデバイスで判定
      const width = window.innerWidth
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      setIsMobile(width < 768 || hasTouch)
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  return isMobile
}

function AuthWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const isMobile = useDeviceType()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isAuthenticated === null) {
    return <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '14px',
      color: '#666'
    }}>Loading...</div>
  }

  // モバイル版を表示
  if (isMobile) {
    return <MobileApp />
  }

  // PC版を表示（既存のルーティング）
  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/gallery" /> : <LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/gallery" element={isAuthenticated ? <GalleryPage /> : <Navigate to="/" />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthWrapper />
    </BrowserRouter>
  </React.StrictMode>,
)