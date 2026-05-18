import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  IconLayoutDashboard, IconFiles, IconUpload,
  IconFolder, IconUsers, IconX, IconLogout,
  IconTrash, IconChevronDown, IconChevronRight,
} from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/roles'
import { api } from '../utils/api'

export default function Sidebar({ open, onClose, addToast }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [foldersOpen, setFoldersOpen] = useState(true)
  const role = user?.role || ROLES.VIEWER

  useEffect(() => {
    api.workdrive.folders()
      .then((d) => setFolders(d.folders || []))
      .catch(() => {})
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">G4</div>
            <div>
              <div className="sidebar-name">Gen4 <span>Manufacturing</span></div>
              <div className="sidebar-tag">Embracing Industry 4.0</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconLayoutDashboard size={17} /><span>Dashboard</span>
          </NavLink>
          <NavLink to="/documents" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconFiles size={17} /><span>All Documents</span>
          </NavLink>

          {(role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.EDITOR) && (
            <NavLink to="/upload" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <IconUpload size={17} /><span>Upload File</span>
            </NavLink>
          )}

          {(role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.EDITOR) && (
            <NavLink to="/workdrive" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <IconFolder size={17} /><span>WorkDrive Files</span>
            </NavLink>
          )}

          {(role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) && (
            <NavLink to="/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <IconUsers size={17} /><span>User Management</span>
              <span className="sidebar-badge">{role === ROLES.SUPER_ADMIN ? 'Super' : 'Admin'}</span>
            </NavLink>
          )}

          {(role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) && (
            <NavLink to="/delete-requests" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <IconTrash size={17} /><span>Delete Requests</span>
            </NavLink>
          )}

          {/* WorkDrive folders as category nav */}
          {folders.length > 0 && (
            <>
              <button className="sidebar-section-toggle" onClick={() => setFoldersOpen((v) => !v)}>
                <span className="sidebar-section-label" style={{ marginBottom: 0 }}>Workspaces</span>
                {foldersOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
              </button>
              {foldersOpen && folders.map((f) => (
                <button
                  key={f.id}
                  className="sidebar-sub-btn"
                  onClick={() => {
                    navigate(`/documents/${encodeURIComponent(f.name.toLowerCase().replace(/\s+/g, '-'))}`)
                    onClose()
                  }}
                >
                  <IconFolder size={13} style={{ opacity: 0.7 }} />
                  <span>{f.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">{user?.role || 'Viewer'}</div>
            </div>
          </div>
          <button className="icon-btn" title="Logout" onClick={handleLogout}>
            <IconLogout size={16} />
          </button>
        </div>
      </aside>
    </>
  )
}
