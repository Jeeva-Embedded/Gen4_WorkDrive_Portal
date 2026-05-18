import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconFiles, IconDownload, IconUsers, IconFolder } from '@tabler/icons-react'
import { api } from '../utils/api'

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
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

export default function Dashboard({ addToast }) {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [users, setUsers] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.documents.list({ limit: 6 }).catch(() => ({ documents: [] })),
      api.workdrive.folders().catch(() => ({ folders: [] })),
      api.users.list().catch(() => ({ users: [] })),
    ]).then(([docsRes, foldersRes, usersRes]) => {
      setDocs(docsRes.documents || [])
      setFolders(foldersRes.folders || [])
      setUsers(usersRes.users || [])
    }).finally(() => setLoading(false))
  }, [])

  const totalDownloads = docs.reduce((a, d) => a + (parseInt(d.downloads) || 0), 0)

  const FOLDER_COLORS = ['#f59e0b','#3b82f6','#8b5cf6','#059669','#ec4899','#0891b2','#d97706','#6366f1']

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-row">
        <StatCard icon={<IconFiles size={20} color="#fff" />} label="Total Documents" value={loading ? '…' : docs.length} color="#4f46e5" />
        <StatCard icon={<IconFolder size={20} color="#fff" />} label="Workspaces" value={folders.length || '…'} color="#0891b2" />
        <StatCard icon={<IconDownload size={20} color="#fff" />} label="Total Downloads" value={totalDownloads} color="#d97706" />
        <StatCard icon={<IconUsers size={20} color="#fff" />} label="Team Members" value={users.length || '—'} color="#059669" />
      </div>

      <h2 className="section-title">Workspaces</h2>
      {loading ? <div className="loading-state">Loading…</div> : (
        <div className="cat-grid">
          {folders.map((f, i) => {
            const count = docs.filter((d) => d.category?.toLowerCase() === f.name.toLowerCase()).length
            return (
              <div key={f.id} className="cat-card" onClick={() => navigate(`/documents/${encodeURIComponent(f.name.toLowerCase().replace(/\s+/g, '-'))}`)}>
                <div className="cat-card-icon" style={{ color: FOLDER_COLORS[i % FOLDER_COLORS.length] }}>
                  <IconFolder size={26} />
                </div>
                <div className="cat-card-name">{f.name}</div>
                <div className="cat-card-count">{count} docs</div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="section-title">Recent Documents</h2>
      {loading ? <div className="loading-state">Loading…</div> : docs.length === 0 ? (
        <div className="empty-state">No documents yet. Upload one to get started.</div>
      ) : (
        <div className="table-wrap">
          <table className="doc-table">
            <thead>
              <tr><th>Name</th><th>Category</th><th>Author</th><th>Uploaded</th><th>Modified by</th><th>Last Modified</th><th>Size</th></tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.ROWID} className="doc-row">
                  <td className="doc-name-cell"><span>📄</span><span>{d.name}</span></td>
                  <td><span className="badge">{d.category}</span></td>
                  <td>{d.author || '—'}</td>
                  <td>{fmtDate(d.uploaded_date)}</td>
                  <td>{d.modified_by || d.author || '—'}</td>
                  <td>{fmtDate(d.last_modified)}</td>
                  <td>{d.size || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
