import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconFiles, IconDownload, IconUsers, IconFolder, IconFile, IconX, IconMail, IconShield } from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/roles'

const ROLE_BADGE = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#9d174d', bg: '#fdf2f8' },
  ADMIN:       { label: 'Admin',       color: '#1d4ed8', bg: '#eff6ff' },
  EDITOR:      { label: 'Editor',      color: '#b45309', bg: '#fffbeb' },
  VIEWER:      { label: 'Viewer',      color: '#15803d', bg: '#f0fdf4' },
}

function StatCard({ icon, label, value, color, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

const FOLDER_COLORS = ['#f59e0b','#3b82f6','#8b5cf6','#059669','#ec4899','#0891b2','#d97706','#6366f1','#ef4444','#14b8a6','#f97316','#8b5cf6']

export default function Dashboard({ addToast }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role || 'VIEWER'

  const [folders, setFolders] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)
  const [totalDownloads, setTotalDownloads] = useState(null)
  const [showTeamModal, setShowTeamModal] = useState(false)

  useEffect(() => {
    Promise.all([
      api.workdrive.folders().catch(() => ({ folders: [] })),
      api.users.list().catch(() => ({ users: [] })),
      api.documents.list().catch(() => ({ documents: [] })),
    ]).then(([foldersRes, usersRes, docsRes]) => {
      const fols = foldersRes.folders || []
      setFolders(fols)
      setUsers(usersRes.users || [])

      const total = fols.reduce((a, f) => a + (parseInt(f.files_count) || 0), 0)
      setTotalFiles(total)

      const dlTotal = (docsRes.documents || []).reduce((a, d) => a + (parseInt(d.downloads) || 0), 0)
      setTotalDownloads(dlTotal)

      if (fols.length > 0) {
        setFilesLoading(true)
        api.workdrive.files(fols[0].id)
          .then((r) => setRecentFiles((r.items || []).slice(0, 8)))
          .catch(() => {})
          .finally(() => setFilesLoading(false))
      }
    }).finally(() => setLoading(false))
  }, [])

  const isAdmin = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-row">
        <StatCard icon={<IconFiles size={20} color="#fff" />} label="Total Files" value={loading ? '…' : totalFiles.toLocaleString()} color="#4f46e5" />
        <StatCard icon={<IconFolder size={20} color="#fff" />} label="Workspaces" value={loading ? '…' : folders.length} color="#0891b2" />
        <StatCard icon={<IconDownload size={20} color="#fff" />} label="Total Downloads" value={loading ? '…' : (totalDownloads ?? '—')} color="#d97706" />
        <StatCard
          icon={<IconUsers size={20} color="#fff" />}
          label="Team Members"
          value={loading ? '…' : (users.length > 0 ? users.length : (isAdmin ? 0 : '—'))}
          color="#059669"
          onClick={isAdmin && users.length > 0 ? () => setShowTeamModal(true) : undefined}
        />
      </div>

      <h2 className="section-title">Workspaces</h2>
      {loading ? <div className="loading-state">Loading…</div> : (
        <div className="cat-grid">
          {folders.map((f, i) => (
            <div key={f.id} className="cat-card" onClick={() => navigate(`/documents/${encodeURIComponent(f.name.toLowerCase().replace(/\s+/g, '-'))}`)}>
              <div className="cat-card-icon" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }}>
                <IconFolder size={26} />
              </div>
              <div className="cat-card-name">{f.name}</div>
              <div className="cat-card-count">{(parseInt(f.files_count) || 0).toLocaleString()} files</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">
        Recent Files
        {folders[0] && <span style={{ fontSize: 13, fontWeight: 400, color: '#8a99a8', marginLeft: 8 }}>— {folders[0].name}</span>}
      </h2>
      {filesLoading ? <div className="loading-state">Loading…</div> : recentFiles.length === 0 ? (
        <div className="empty-state">No files found.</div>
      ) : (
        <div className="table-wrap">
          <table className="doc-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr>
            </thead>
            <tbody>
              {recentFiles.map((f) => (
                <tr key={f.id} className="doc-row">
                  <td className="doc-name-cell">
                    {f.is_folder ? <IconFolder size={16} color="#0891b2" /> : <IconFile size={16} color="#6366f1" />}
                    <span>{f.name}</span>
                  </td>
                  <td>{f.is_folder ? 'Folder' : (f.type || '—')}</td>
                  <td>{f.size || '—'}</td>
                  <td>{f.modified || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Members Modal */}
      {showTeamModal && (
        <div className="modal-backdrop" onClick={() => setShowTeamModal(false)}>
          <div className="modal" style={{ maxWidth: 520, width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Team Members ({users.length})</h2>
              <button className="icon-btn" onClick={() => setShowTeamModal(false)}><IconX size={16} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0, maxHeight: 420, overflowY: 'auto' }}>
              <table className="doc-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const badge = ROLE_BADGE[u.role] || ROLE_BADGE.VIEWER
                    return (
                      <tr key={u.ROWID} className="doc-row">
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', background: '#4f46e5',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700, flexShrink: 0,
                            }}>
                              {(u.name || u.email)?.[0]?.toUpperCase() || '?'}
                            </div>
                            {u.name || '—'}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IconMail size={12} />{u.email}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            color: badge.color, background: badge.bg, border: `1px solid ${badge.color}40`,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(u.added_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              {isAdmin && (
                <button className="btn btn-outline btn-sm" onClick={() => { setShowTeamModal(false); navigate('/users') }}>
                  <IconShield size={14} /> Manage Users
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowTeamModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
