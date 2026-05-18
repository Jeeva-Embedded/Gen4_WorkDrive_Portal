import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zd_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zd_access_token')
    if (!token) { setLoading(false); return }
    api.auth.me()
      .then((data) => { setUser(data.user); localStorage.setItem('zd_user', JSON.stringify(data.user)) })
      .catch(() => { localStorage.removeItem('zd_access_token'); localStorage.removeItem('zd_user'); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback((userData, accessToken) => {
    localStorage.setItem('zd_access_token', accessToken)
    localStorage.setItem('zd_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('zd_access_token')
    localStorage.removeItem('zd_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
