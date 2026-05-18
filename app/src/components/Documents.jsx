import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { IconEye, IconDownload, IconPencil, IconTrash, IconSearch, IconX, IconLock, IconShield, IconFilter } from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { can, ROLES } from '../utils/roles'
import ViewerPanel from './ViewerPanel'
import DocModal from './DocModal'

const ACCESS_LABELS = {
  ALL:          { label: 'All', color: '#15803d', bg: '#f0fdf4' },
  EDITOR_ABOVE: { label: 'Editor+', color: '#b45309', bg: '#fffbeb' },
  ADMIN_ABOVE:  { label: 'Admin+', color: '#1d4ed8', bg: '#eff6ff' },
  SUPER_ADMIN:  { label: 'Super Admin', color: '#9d174d', bg: '#fdf2f8' },
}

const ACCESS_OPTIONS = [
  { value: 'ALL',          label: 'Everyone (All roles)' },
  { value: 'EDITOR_ABOVE', label: 'Editors & above' },
  { value: 'ADMIN_ABOVE',  label: 'Admins & above only' },
  { value: 'SUPER_ADMIN',  label: 'Super Admin only' },
]

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function PermissionBadge({ accessRole }) {
  const info = ACCESS_LABELS[accessRole] || ACCESS_LABELS.ALL
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      color: info.color, background: info.bg, border: `1px solid ${info.color}40`,
    }}>
      <IconLock size={10} />{info.label}
    </span>
  )
}

export default function Documents({ addToast }) {
  const { user } = useAuth()
  const role = user?.role || 'VIEWER'
  const isAdmin = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [docs, setDocs] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAccess, setFilterAccess] = useState('all')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)
  const [editDoc, setEditDoc] = useState(null)
  const [permDoc, setPermDoc] = useState(null)
  const [permValue, setPermValue] = useState('ALL')

  const catSlug = location.pathname.startsWith('/documents/')
    ? decodeURIComponent(location.pathname.slice('/documents/'.length)) : undefined

  const activeCat = useMemo(() => {
    if (!catSlug) return 'all'
    const match = folders.find((f) =>
      f.name.toLowerCase().replace(/\s+/g, '-') === catSlug.toLowerCase()
    )
    return match ? match.name : catSlug
  }, [catSlug, folders])

  function load() {
    setLoading(true)
    Promise.all([api.documents.list(), api.workdrive.folders()])
      .then(([docsRes, foldersRes]) => {
        setDocs(docsRes.documents || [])
        setFolders(foldersRes.folders || [])
      })
      .catch(() => addToast('Failed to load documents', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const authors = useMemo(() => [...new Set(docs.map((d) => d.author).filter(Boolean))], [docs])

  const filtered = useMemo(() => docs.filter((d) => {
    const catMatch = activeCat === 'all' || d.category?.toLowerCase() === activeCat.toLowerCase()
    const q = search.toLowerCase()
    const textMatch = !q || d.name?.toLowerCase().includes(q) || d.author?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q)
    const accessMatch = filterAccess === 'all' || (d.access_role || 'ALL') === filterAccess
    const authorMatch = !filterAuthor || d.author === filterAuthor
    return catMatch && textMatch && accessMatch && authorMatch
  }), [docs, activeCat, search, filterAccess, filterAuthor])

  function navCat(slug) {
    slug === 'all' ? navigate('/documents') : navigate(`/documents/${encodeURIComponent(slug)}`)
  }

  async function handleDownload(d) {
    window.open(d.url || d.download_url, '_blank')
    await api.documents.incrementDownload(d.ROWID).catch(() => {})
  }

  async function handleDelete(d) {
    const msg = isAdmin
      ? `Delete "${d.name}" permanently from portal and WorkDrive?`
      : `Request deletion of "${d.name}"? An admin will review and approve.`
    if (!window.confirm(msg)) return
    try {
      const res = await api.documents.delete(d.ROWID)
      if (res?.pending) {
        addToast('Delete request submitted — waiting for admin approval', 'info')
      } else {
        addToast(`"${d.name}" deleted`, 'info')
        load()
      }
    } catch (err) { addToast(err.message, 'error') }
  }

  async function handlePermSave() {
    try {
      await api.documents.setPermission(permDoc.ROWID, permValue)
      setDocs((p) => p.map((d) => d.ROWID === permDoc.ROWID ? { ...d, access_role: permValue } : d))
      addToast('Permission updated', 'success')
      setPermDoc(null)
    } catch (err) { addToast(err.message, 'error') }
  }

  const activeFilters = (filterAccess !== 'all' ? 1 : 0) + (filterAuthor ? 1 : 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-bar">
            <IconSearch size={15} />
            <input placeholder="Search name, author, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')}><IconX size={13} /></button>}
          </div>
          <button className={`btn btn-outline btn-sm ${showFilter ? 'active' : ''}`} onClick={() => setShowFilter((v) => !v)}>
            <IconFilter size={14} />
            {activeFilters > 0 && <span className="sidebar-badge" style={{ marginLeft: 4 }}>{activeFilters}</span>}
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="filter-bar">
          <div className="form-row" style={{ gap: 12, marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label style={{ fontSize: 11 }}>Access Level</label>
              <select value={filterAccess} onChange={(e) => setFilterAccess(e.target.value)}>
                <option value="all">All levels</option>
                {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label style={{ fontSize: 11 }}>Author</label>
              <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)}>
                <option value="">All authors</option>
                {authors.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            {activeFilters > 0 && (
              <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 2 }}
                onClick={() => { setFilterAccess('all'); setFilterAuthor('') }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category tabs — WorkDrive folders */}
      <div className="tab-bar" style={{ overflowX: 'auto' }}>
        <button className={`tab-btn ${activeCat === 'all' ? 'active' : ''}`} onClick={() => navCat('all')}>
          All
        </button>
        {folders.map((f) => {
          const slug = f.name.toLowerCase().replace(/\s+/g, '-')
          return (
            <button
              key={f.id}
              className={`tab-btn ${activeCat.toLowerCase() === f.name.toLowerCase() ? 'active' : ''}`}
              onClick={() => navCat(slug)}
            >
              {f.name}
            </button>
          )
        })}
      </div>

      {loading ? <div className="loading-state">Loading…</div> : filtered.length === 0 ? (
        <div className="empty-state">{search ? 'No documents match your search.' : 'No documents in this category yet.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Document Name</th><th>Category</th><th>Author</th>
                <th>Uploaded</th><th>Modified by</th><th>Last Modified</th>
                <th>Access</th><th>Size</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.ROWID} className="doc-row">
                  <td className="doc-name-cell"><span>📄</span><span>{d.name}</span></td>
                  <td><span className="badge">{d.category}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{d.author || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(d.uploaded_date)}</td>
                  <td style={{ fontSize: 13 }}>{d.modified_by || d.author || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(d.last_modified)}</td>
                  <td><PermissionBadge accessRole={d.access_role} /></td>
                  <td>{d.size || '—'}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" title="View" onClick={() => setViewDoc(d)}><IconEye size={15} /></button>
                    <button className="icon-btn" title="Download" onClick={() => handleDownload(d)}><IconDownload size={15} /></button>
                    {can(role, 'edit') && (
                      <button className="icon-btn" title="Edit" onClick={() => setEditDoc(d)}><IconPencil size={15} /></button>
                    )}
                    {isAdmin && (
                      <button className="icon-btn" title="Change permission" onClick={() => { setPermDoc(d); setPermValue(d.access_role || 'ALL') }}>
                        <IconShield size={15} />
                      </button>
                    )}
                    {(can(role, 'delete') || role === ROLES.EDITOR) && (
                      <button
                        className={`icon-btn ${isAdmin ? 'danger' : ''}`}
                        title={isAdmin ? 'Delete' : 'Request deletion'}
                        onClick={() => handleDelete(d)}
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewDoc && <ViewerPanel doc={viewDoc} onClose={() => setViewDoc(null)} addToast={addToast} />}
      {editDoc && <DocModal doc={editDoc} onClose={() => { setEditDoc(null); load() }} addToast={addToast} />}

      {permDoc && (
        <div className="modal-backdrop" onClick={() => setPermDoc(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Change Access — {permDoc.name}</h2>
              <button className="icon-btn" onClick={() => setPermDoc(null)}><IconX size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Who can see this file?</label>
                <select value={permValue} onChange={(e) => setPermValue(e.target.value)}>
                  {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPermDoc(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePermSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
