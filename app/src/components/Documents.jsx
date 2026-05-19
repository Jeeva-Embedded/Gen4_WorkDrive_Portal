import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  IconEye, IconDownload, IconPencil, IconTrash, IconSearch, IconX,
  IconLock, IconShield, IconFilter, IconFolder, IconFile, IconChevronRight,
} from '@tabler/icons-react'
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
  const navigate = useNavigate()

  // Portal DB state
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

  // WorkDrive browsing state
  const [activeFolder, setActiveFolder] = useState(null) // { id, name } of selected workspace
  const [wdPath, setWdPath] = useState([])              // breadcrumb stack
  const [wdFiles, setWdFiles] = useState([])
  const [wdLoading, setWdLoading] = useState(false)

  const catSlug = location.pathname.startsWith('/documents/')
    ? decodeURIComponent(location.pathname.slice('/documents/'.length)) : undefined

  // Load folders + portal docs once
  function loadPortal() {
    setLoading(true)
    Promise.all([api.documents.list(), api.workdrive.folders()])
      .then(([docsRes, foldersRes]) => {
        setDocs(docsRes.documents || [])
        const fols = foldersRes.folders || []
        setFolders(fols)
        // If URL has a workspace slug, auto-select that workspace tab
        if (catSlug && catSlug !== 'all') {
          const match = fols.find((f) =>
            f.name.toLowerCase().replace(/\s+/g, '-') === catSlug.toLowerCase()
          )
          if (match) openWorkspace(match, fols)
        }
      })
      .catch(() => addToast('Failed to load', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPortal() }, [])

  // When URL changes to a workspace slug after initial load
  useEffect(() => {
    if (!folders.length) return
    if (!catSlug || catSlug === 'all') {
      setActiveFolder(null)
      setWdPath([])
      setWdFiles([])
      return
    }
    const match = folders.find((f) =>
      f.name.toLowerCase().replace(/\s+/g, '-') === catSlug.toLowerCase()
    )
    if (match && match.id !== activeFolder?.id) {
      openWorkspace(match, folders)
    }
  }, [catSlug, folders])

  function openWorkspace(folder, fols) {
    setActiveFolder(folder)
    setWdPath([{ id: folder.id, name: folder.name }])
    fetchWdFiles(folder.id)
  }

  function fetchWdFiles(folderId) {
    setWdLoading(true)
    setWdFiles([])
    api.workdrive.files(folderId)
      .then((r) => setWdFiles(r.items || []))
      .catch(() => addToast('Failed to load files', 'error'))
      .finally(() => setWdLoading(false))
  }

  function openSubfolder(file) {
    setWdPath((p) => [...p, { id: file.id, name: file.name }])
    fetchWdFiles(file.id)
  }

  function navBreadcrumb(idx) {
    const crumb = wdPath[idx]
    setWdPath((p) => p.slice(0, idx + 1))
    fetchWdFiles(crumb.id)
  }

  function navCat(folder) {
    if (!folder) {
      setActiveFolder(null)
      setWdPath([])
      setWdFiles([])
      navigate('/documents')
    } else {
      const slug = folder.name.toLowerCase().replace(/\s+/g, '-')
      navigate(`/documents/${encodeURIComponent(slug)}`)
    }
  }

  // Portal docs filters
  const authors = useMemo(() => [...new Set(docs.map((d) => d.author).filter(Boolean))], [docs])
  const filtered = useMemo(() => docs.filter((d) => {
    const q = search.toLowerCase()
    const textMatch = !q || d.name?.toLowerCase().includes(q) || d.author?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q)
    const accessMatch = filterAccess === 'all' || (d.access_role || 'ALL') === filterAccess
    const authorMatch = !filterAuthor || d.author === filterAuthor
    return textMatch && accessMatch && authorMatch
  }), [docs, search, filterAccess, filterAuthor])

  // WorkDrive search filter
  const wdFiltered = useMemo(() => {
    if (!search) return wdFiles
    const q = search.toLowerCase()
    return wdFiles.filter((f) => f.name?.toLowerCase().includes(q))
  }, [wdFiles, search])

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
        loadPortal()
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
  const isWorkspaceTab = !!activeFolder

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="search-bar">
            <IconSearch size={15} />
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')}><IconX size={13} /></button>}
          </div>
          {!isWorkspaceTab && (
            <button className={`btn btn-outline btn-sm ${showFilter ? 'active' : ''}`} onClick={() => setShowFilter((v) => !v)}>
              <IconFilter size={14} />
              {activeFilters > 0 && <span className="sidebar-badge" style={{ marginLeft: 4 }}>{activeFilters}</span>}
            </button>
          )}
        </div>
      </div>

      {!isWorkspaceTab && showFilter && (
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

      {/* Workspace tabs */}
      <div className="tab-bar" style={{ overflowX: 'auto' }}>
        <button className={`tab-btn ${!isWorkspaceTab ? 'active' : ''}`} onClick={() => navCat(null)}>
          All Uploads
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            className={`tab-btn ${activeFolder?.id === f.id ? 'active' : ''}`}
            onClick={() => navCat(f)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* WorkDrive mode */}
      {isWorkspaceTab ? (
        <>
          {/* Breadcrumb */}
          {wdPath.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0', fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
              {wdPath.map((crumb, i) => (
                <React.Fragment key={crumb.id}>
                  {i > 0 && <IconChevronRight size={13} />}
                  <button
                    style={{
                      background: 'none', border: 'none', cursor: i < wdPath.length - 1 ? 'pointer' : 'default',
                      color: i < wdPath.length - 1 ? 'var(--primary)' : 'var(--text)',
                      fontWeight: i === wdPath.length - 1 ? 600 : 400, fontSize: 13, padding: '2px 4px',
                    }}
                    onClick={() => i < wdPath.length - 1 && navBreadcrumb(i)}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {wdLoading ? (
            <div className="loading-state">Loading…</div>
          ) : wdFiltered.length === 0 ? (
            <div className="empty-state">{search ? 'No files match your search.' : 'This folder is empty.'}</div>
          ) : (
            <div className="table-wrap">
              <table className="doc-table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {wdFiltered.map((f) => (
                    <tr key={f.id} className="doc-row">
                      <td className="doc-name-cell">
                        {f.is_folder
                          ? <IconFolder size={16} color="#0891b2" />
                          : <IconFile size={16} color="#6366f1" />}
                        <span
                          style={f.is_folder ? { cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 } : {}}
                          onClick={() => f.is_folder && openSubfolder(f)}
                        >
                          {f.name}
                        </span>
                      </td>
                      <td>{f.is_folder ? 'Folder' : (f.type || '—')}</td>
                      <td>{f.size || '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{f.modified || '—'}</td>
                      <td className="actions-cell">
                        {f.is_folder ? (
                          <button className="btn btn-outline btn-sm" onClick={() => openSubfolder(f)}>
                            Open
                          </button>
                        ) : (
                          <>
                            {f.permalink && (
                              <button className="btn btn-outline btn-sm" onClick={() => { window.open(f.permalink, '_blank'); api.workdrive.trackDownload(f.id) }}>
                                <IconEye size={14} /> View
                              </button>
                            )}
                            {f.download_url && (
                              <button className="icon-btn" title="Download" onClick={() => { window.open(f.download_url, '_blank'); api.workdrive.trackDownload(f.id) }}>
                                <IconDownload size={15} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Portal uploads mode (All tab) */
        <>
          {loading ? <div className="loading-state">Loading…</div> : filtered.length === 0 ? (
            <div className="empty-state">{search ? 'No documents match your search.' : 'No documents uploaded yet.'}</div>
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
        </>
      )}

      {viewDoc && <ViewerPanel doc={viewDoc} onClose={() => setViewDoc(null)} addToast={addToast} />}
      {editDoc && <DocModal doc={editDoc} onClose={() => { setEditDoc(null); loadPortal() }} addToast={addToast} />}

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
