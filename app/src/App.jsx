import React, { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import AuthCallback from './components/AuthCallback'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './components/Dashboard'
import Documents from './components/Documents'
import UploadPage from './components/UploadPage'
import WorkDriveFiles from './components/WorkDriveFiles'
import UserManagement from './components/UserManagement'
import DeleteRequests from './components/DeleteRequests'
import { ROLES } from './utils/roles'

function Toast({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onRemove(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), [])

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} addToast={addToast} />
      <div className="main-area">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard addToast={addToast} />} />
            <Route path="/documents/*" element={<Documents addToast={addToast} />} />
            <Route path="/upload" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR]}>
                <UploadPage addToast={addToast} />
              </ProtectedRoute>
            } />
            <Route path="/workdrive" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR]}>
                <WorkDriveFiles addToast={addToast} />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
                <UserManagement addToast={addToast} />
              </ProtectedRoute>
            } />
            <Route path="/delete-requests" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
                <DeleteRequests addToast={addToast} />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </div>
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">G4</div>
        <div className="splash-text">Gen4 WorkDrive Portal</div>
        <div className="splash-spinner"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/*" element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
