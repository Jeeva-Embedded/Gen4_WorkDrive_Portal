import React, { useState, useEffect } from 'react'

const CLIENT_ID = import.meta.env.VITE_ZOHO_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_ZOHO_REDIRECT_URI || `${window.location.origin}/auth/callback`

async function generatePKCE() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return { verifier, challenge }
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [serverWaking, setServerWaking] = useState(false)

  useEffect(() => {
    let timer
    let attempts = 0

    function ping() {
      fetch('/api/health')
        .then((r) => { if (r.ok) setServerWaking(false) })
        .catch(() => {
          attempts++
          if (attempts === 1) setServerWaking(true)
          if (attempts < 10) timer = setTimeout(ping, 3000)
        })
    }

    timer = setTimeout(ping, 2500)
    return () => clearTimeout(timer)
  }, [])

  async function handleLogin() {
    setLoading(true)
    const { verifier, challenge } = await generatePKCE()
    sessionStorage.setItem('pkce_verifier', verifier)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'WorkDrive.files.ALL,WorkDrive.workspace.ALL,WorkDrive.team.ALL,AaaServer.profile.READ,email',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })

    window.location.href = `https://accounts.zoho.in/oauth/v2/auth?${params}`
  }

  return (
    <div className="login-page">
      {serverWaking && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: '#d97706', color: '#fff', padding: '10px 16px',
          textAlign: 'center', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span className="btn-spinner" style={{ borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff', width: 14, height: 14 }}></span>
          Server is waking up — this takes 10–20 seconds on first visit…
        </div>
      )}
      <div className="login-bg">
        <div className="login-bg-grid"></div>
        <div className="login-bg-glow"></div>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">G4</div>
          <div className="login-logo-text">
            <div className="login-brand">Gen4 <span>Manufacturing</span></div>
            <div className="login-tagline">Embracing Industry 4.0</div>
          </div>
        </div>

        <div className="login-divider"></div>

        <h1 className="login-title">WorkDrive Portal</h1>
        <p className="login-desc">Sign in with your Zoho account to access company documents and files.</p>

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <span className="btn-spinner"></span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#E42527"/>
              <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">Z</text>
            </svg>
          )}
          {loading ? 'Redirecting to Zoho…' : 'Continue with Zoho'}
        </button>

        <p className="login-roles-note" style={{ marginTop: 20, color: '#8a99a8', fontSize: 13 }}>Your access level is assigned by an Admin after first login.</p>
      </div>
    </div>
  )
}
