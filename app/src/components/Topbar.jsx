import React, { useState, useEffect, useRef, useCallback } from 'react'
import { IconMenu2, IconBell, IconCheck, IconX, IconLock, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '../utils/roles'
import { api } from '../utils/api'

function NotificationPanel({ addToast, onClose }) {
  const [accessReqs, setAccessReqs] = useState([])
  const [deleteReqs, setDeleteReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})

  function load() {
    setLoading(true)
    Promise.all([
      api.workdrive.accessRequests().catch(() => ({ requests: [] })),
      api.workdrive.deleteRequests().catch(() => ({ requests: [] })),
    ]).then(([ar, dr]) => {
      setAccessReqs((ar.requests || []).filter(r => r.status === 'pending'))
      setDeleteReqs((dr.requests || []).filter(r => r.status === 'pending'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function reviewAccess(id, action) {
    setBusy(p => ({ ...p, [id]: true }))
    try {
      await api.workdrive.reviewAccessRequest(id, action)
      addToast(action === 'approve' ? 'Access approved' : 'Request rejected', 'success')
      setAccessReqs(p => p.filter(r => r.ROWID !== id))
    } catch (err) {
      addToast(err.message || 'Action failed', 'error')
    } finally {
      setBusy(p => ({ ...p, [id]: false }))
    }
  }

  async function reviewDelete(id, action) {
    setBusy(p => ({ ...p, [id]: true }))
    try {
      await api.workdrive.reviewDeleteRequest(id, action)
      addToast(action === 'approve' ? 'File deleted' : 'Request rejected', 'success')
      setDeleteReqs(p => p.filter(r => r.ROWID !== id))
    } catch (err) {
      addToast(err.message || 'Action failed', 'error')
    } finally {
      setBusy(p => ({ ...p, [id]: false }))
    }
  }

  const total = accessReqs.length + deleteReqs.length

  return (
    <div className="notif-panel">
      <div className="notif-header">
        <span className="notif-title">Pending Requests</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="icon-btn" title="Refresh" onClick={load} style={{ width: 26, height: 26 }}>
            <IconRefresh size={14} />
          </button>
          <button className="icon-btn" onClick={onClose} style={{ width: 26, height: 26 }}>
            <IconX size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : total === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          <IconBell size={28} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }} />
          No pending requests
        </div>
      ) : (
        <div className="notif-list">
          {/* Folder Access Requests */}
          {accessReqs.map(r => (
            <div key={r.ROWID} className="notif-item">
              <div className="notif-item-icon" style={{ background: '#e0e7ff' }}>
                <IconLock size={14} style={{ color: '#4f46e5' }} />
              </div>
              <div className="notif-item-body">
                <div className="notif-item-title">{r.requester_name || r.requester_email}</div>
                <div className="notif-item-sub">wants access to <strong>{r.folder_name}</strong></div>
                <div className="notif-item-time">{new Date(r.requested_at).toLocaleString()}</div>
                <div className="notif-item-actions">
                  <button
                    className="notif-btn notif-btn-approve"
                    disabled={busy[r.ROWID]}
                    onClick={() => reviewAccess(r.ROWID, 'approve')}
                  >
                    <IconCheck size={11} /> Approve
                  </button>
                  <button
                    className="notif-btn notif-btn-reject"
                    disabled={busy[r.ROWID]}
                    onClick={() => reviewAccess(r.ROWID, 'reject')}
                  >
                    <IconX size={11} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Delete Requests */}
          {deleteReqs.map(r => (
            <div key={r.ROWID} className="notif-item">
              <div className="notif-item-icon" style={{ background: '#fee2e2' }}>
                <IconTrash size={14} style={{ color: '#c0392b' }} />
              </div>
              <div className="notif-item-body">
                <div className="notif-item-title">{r.file_name}</div>
                <div className="notif-item-sub">delete request by <strong>{r.requested_by_name || r.requested_by_email}</strong></div>
                {r.folder_name && <div className="notif-item-sub" style={{ color: 'var(--muted)' }}>in {r.folder_name}</div>}
                <div className="notif-item-time">{new Date(r.requested_at).toLocaleString()}</div>
                <div className="notif-item-actions">
                  <button
                    className="notif-btn notif-btn-delete"
                    disabled={busy[r.ROWID]}
                    onClick={() => reviewDelete(r.ROWID, 'approve')}
                  >
                    <IconTrash size={11} /> Delete
                  </button>
                  <button
                    className="notif-btn notif-btn-reject"
                    disabled={busy[r.ROWID]}
                    onClick={() => reviewDelete(r.ROWID, 'reject')}
                  >
                    <IconX size={11} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Topbar({ onMenuClick, addToast }) {
  const { user } = useAuth()
  const role = user?.role || 'VIEWER'
  const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.VIEWER
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const [showNotif, setShowNotif] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const panelRef = useRef(null)

  const fetchCount = useCallback(() => {
    if (!isAdmin) return
    Promise.all([
      api.workdrive.accessRequests().catch(() => ({ requests: [] })),
      api.workdrive.deleteRequests().catch(() => ({ requests: [] })),
    ]).then(([ar, dr]) => {
      const count =
        (ar.requests || []).filter(r => r.status === 'pending').length +
        (dr.requests || []).filter(r => r.status === 'pending').length
      setPendingCount(count)
    })
  }, [isAdmin])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close panel when clicking outside
  useEffect(() => {
    if (!showNotif) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  return (
    <header className="topbar">
      <button className="icon-btn topbar-menu" onClick={onMenuClick}>
        <IconMenu2 size={20} />
      </button>
      <div className="topbar-brand">Gen4 WorkDrive Portal</div>
      <div className="topbar-right">

        {/* Notification Bell — admin only */}
        {isAdmin && (
          <div style={{ position: 'relative' }} ref={panelRef}>
            <button
              className="icon-btn notif-bell"
              onClick={() => { setShowNotif(v => !v); if (!showNotif) fetchCount() }}
              title="Pending requests"
            >
              <IconBell size={20} />
              {pendingCount > 0 && (
                <span className="notif-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
              )}
            </button>

            {showNotif && (
              <NotificationPanel
                addToast={addToast}
                onClose={() => { setShowNotif(false); fetchCount() }}
              />
            )}
          </div>
        )}

        <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}>
          {ROLE_LABELS[role]}
        </span>
        <div className="topbar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
      </div>
    </header>
  )
}
