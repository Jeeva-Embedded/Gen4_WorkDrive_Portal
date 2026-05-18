import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconFiles, IconDownload, IconUsers, IconFolder, IconFile } from '@tabler/icons-react'
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

const FOLDER_COLORS = ['#f59e0b','#3b82f6','#8b5cf6','#059669','#ec4899','#0891b2','#d97706','#6366f1','#ef4444','#14b8a6','#f97316','#8b5cf6']

export default function Dashboard({ addToast }) {
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(false)
  const [totalFiles, setTotalFiles] = useState(0)

  useEffect(() => {
    Promise.all([
      api.workdrive.folders().catch(() => ({ folders: [] })),
      api.users.list().catch(() => ({ users: [] })),
    ]).then(([foldersRes, usersRes]) => {
      const fols = foldersRes.folders || []
      setFolders(fols)
      setUsers(usersRes.users || [])
      // sum up all files across workspaces
      const total = fols.reduce((a, f) => a + (parseInt(f.files_count) || 0), 0)
      setTotalFiles(total)

      // load recent files from the first workspace
      if (fols.length > 0) {
        setFilesLoading(true)
        api.workdrive.files(fols[0].id)
          .then((r) => setRecentFiles((r.items || []).slice(0, 8)))
          .catch(() => {})
          .finally(() => setFilesLoading(false))
      }
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-row">
        <StatCard icon={<IconFiles size={20} color="#fff" />} label="Total Files" value={loading ? '…' : totalFiles.toLocaleString()} color="#4f46e5" />
        <StatCard icon={<IconFolder size={20} color="#fff" />} label="Workspaces" value={loading ? '…' : folders.length} color="#0891b2" />
        <StatCard icon={<IconDownload size={20} color="#fff" />} label="Total Downloads" value="—" color="#d97706" />
        <StatCard icon={<IconUsers size={20} color="#fff" />} label="Team Members" value={loading ? '…' : (users.length || '—')} color="#059669" />
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
    </div>
  )
}
