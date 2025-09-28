import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LoginPage } from './app/components/LoginPage.tsx'
import { GalleryPage } from './app/components/GalleryPage.tsx'
import { SignupPage } from './app/components/SignupPage.tsx'
import { AuthCallback } from './app/components/AuthCallback.tsx'
import { supabase } from './app/lib/supabase.ts'
import './styles/globals.css'

function AuthWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

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
    return <div>Loading...</div>
  }

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