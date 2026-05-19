import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      navigate('/login?error=auth_failed')
      return
    }

    const verifier = sessionStorage.getItem('pkce_verifier')
    sessionStorage.removeItem('pkce_verifier')
    const redirectUri = import.meta.env.VITE_ZOHO_REDIRECT_URI || `${window.location.origin}/auth/callback`

    api.auth
      .exchangeToken(code, verifier, redirectUri)
      .then(({ user, access_token }) => {
        login(user, access_token)
        navigate('/dashboard')
      })
      .catch(() => navigate('/login?error=token_failed'))
  }, [])

  return (
    <div className="splash-screen">
      <img src="/logo.jpg" alt="Gen4" className="splash-logo" />
      <div className="splash-text">Signing you in…</div>
      <div className="splash-spinner"></div>
    </div>
  )
}
