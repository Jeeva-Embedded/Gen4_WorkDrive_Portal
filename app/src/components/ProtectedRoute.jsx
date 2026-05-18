import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0 && !roles.includes(user?.role)) {
    return (
      <div className="access-denied">
        <div className="access-denied-icon">🔒</div>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        <p>Your current role: <strong>{user?.role || 'VIEWER'}</strong></p>
        <p>Contact an Admin to request access.</p>
      </div>
    )
  }

  return children
}
