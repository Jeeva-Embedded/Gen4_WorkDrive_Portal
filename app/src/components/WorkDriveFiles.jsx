import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  IconFolder, IconFolderOpen, IconDownload, IconRefresh, IconChevronRight,
  IconArrowLeft, IconTrash, IconPencil, IconArrowsMove, IconCheck,
  IconLock, IconSettings, IconBell, IconX, IconUserCheck, IconShieldCheck,
} from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'

// ── Move Modal ────────────────────────────────────────────────────────────────
function MoveModal({ item, rootFolders, onMove, onClose }) {
  const [crumbs, setCrumbs] = useState([])
  const [subItems, setSubItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  function openWorkspace(ws) {
    setCrumbs([{ id: ws.id, name: ws.name }])
    setSelectedId(ws.id)
    loadSubs(ws.id)
  }
  function loadSubs(folderId) {
    setLoading(true)
    api.workdrive.files(folderId)
      .then((d) => setSubItems((d.items || []).filter((i) => i.is_folder)))
      .catch(() => setSubItems([]))
      .finally(() => setLoading(false))
  }
  function openSub(sub) {
    setCrumbs((p) => [...p, { id: sub.id, name: sub.name }])
    setSelectedId(sub.id)
    loadSubs(sub.id)
  }
  function navigate(index) {
    const c = crumbs[index]
    setCrumbs(crumbs.slice(0, index + 1))
    setSelectedId(c.id)
    loadSubs(c.id)
  }
  function goUp() {
    if (crumbs.length <= 1) return
    const newCrumbs = crumbs.slice(0, -1)
    setCrumbs(newCrumbs)
    const parent = newCrumbs[newCrumbs.length - 1]
    setSelectedId(parent.id)
    loadSubs(parent.id)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ minWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Move "{item.name}" to…</h2>
          <button className="icon-btn" onClick={onClose}><IconArrowLeft size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '0 16px 16px' }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Workspaces</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
              {rootFolders.map((f) => (
                <button key={f.id} className={`folder-item ${crumbs[0]?.id === f.id ? 'active' : ''}`}
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '6px 10px' }} onClick={() => openWorkspace(f)}>
                  <IconFolder size={14} /><span>{f.name}</span>
                </button>
              ))}
            </div>
          </div>
          {crumbs.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div className="wd-breadcrumb" style={{ marginBottom: 6 }}>
                {crumbs.length > 1 && <button className="wd-back-btn" onClick={goUp}><IconArrowLeft size={12} /></button>}
                {crumbs.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {i > 0 && <IconChevronRight size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                    <button className={`wd-crumb ${i === crumbs.length - 1 ? 'active' : ''}`} style={{ fontSize: 11 }}
                      onClick={() => i < crumbs.length - 1 && navigate(i)}>{c.name}</button>
                  </React.Fragment>
                ))}
              </div>
              {loading ? (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
              ) : subItems.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>No subfolders</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
                  {subItems.map((s) => (
                    <button key={s.id} className="folder-picker-sub" onClick={() => openSub(s)}>
                      <IconFolderOpen size={13} style={{ color: '#f59e0b' }} /><span>{s.name}</span>
                      <IconChevronRight size={11} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selectedId || selectedId === item.id} onClick={() => onMove(selectedId)}>
            <IconCheck size={14} /> Move here
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Folder Permissions Modal (admin) ──────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'none',   label: 'No Access',  color: '#9ca3af' },
  { value: 'VIEWER', label: 'Viewer',     color: '#15803d' },
  { value: 'EDITOR', label: 'Editor',     color: '#b45309' },
]

function PermissionsModal({ folder, users, onClose, onSave }) {
  const [isOpen, setIsOpen] = useState(true)
  const [members, setMembers] = useState([]) // [{email, role}]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.workdrive.permissions()
      .then(({ permissions }) => {
        const perm = permissions.find(p => p.folder_id === folder.id)
        if (perm) {
          setIsOpen(perm.is_open !== false)
          setMembers(perm.members || [])
        } else {
          setIsOpen(true)
          setMembers([])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [folder.id])

  function getMemberRole(email) {
    return members.find(m => m.email === email.toLowerCase())?.role || 'none'
  }

  function setMemberRole(email, role) {
    const lc = email.toLowerCase()
    setMembers(prev => {
      const filtered = prev.filter(m => m.email !== lc)
      return role === 'none' ? filtered : [...filtered, { email: lc, role }]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.workdrive.setPermissions(folder.id, {
        folder_name: folder.name,
        is_open: isOpen,
        members: isOpen ? [] : members,
      })
      onSave()
      onClose()
    } catch (err) {
      alert(err.message || 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const accessCount = members.length

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ minWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><IconShieldCheck size={16} style={{ marginRight: 6 }} />Manage Access — {folder.name}</h2>
          <button className="icon-btn" onClick={onClose}><IconX size={16} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ color: 'var(--muted)', padding: '12px 0' }}>Loading…</div>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
                <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} style={{ width: 16, height: 16 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Open to all members</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Every portal member can browse this folder</div>
                </div>
              </label>

              {!isOpen && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Member Access
                    </div>
                    {accessCount > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                        {accessCount} {accessCount === 1 ? 'member' : 'members'} with access
                      </div>
                    )}
                  </div>
                  {users.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>No members found</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
                      {users.map(u => {
                        const memberRole = getMemberRole(u.email)
                        const hasAccess = memberRole !== 'none'
                        return (
                          <div key={u.email} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 8,
                            background: hasAccess ? '#f0fdf4' : 'transparent',
                            border: `1px solid ${hasAccess ? '#bbf7d0' : 'transparent'}`,
                          }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: '#4f46e5', color: '#fff', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                            }}>
                              {(u.name || u.email)?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || u.email}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                            </div>
                            <select
                              value={memberRole}
                              onChange={e => setMemberRole(u.email, e.target.value)}
                              style={{
                                border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                                color: ROLE_OPTIONS.find(r => r.value === memberRole)?.color,
                                background: hasAccess ? '#fff' : 'var(--bg)',
                              }}
                            >
                              {ROLE_OPTIONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <strong>Viewer</strong> — can browse and download files &nbsp;·&nbsp; <strong>Editor</strong> — can also upload and rename
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : <><IconCheck size={14} /> Save</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Access Requests Panel (admin) ─────────────────────────────────────────────
function AccessRequestsPanel({ requests, onReview }) {
  const [expanded, setExpanded] = useState(false)
  const pending = requests.filter(r => r.status === 'pending')
  if (pending.length === 0) return null

  return (
    <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(p => !p)}>
        <IconBell size={16} style={{ color: '#f59e0b' }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{pending.length} pending folder access {pending.length === 1 ? 'request' : 'requests'}</span>
        <IconChevronRight size={14} style={{ marginLeft: 'auto', transform: expanded ? 'rotate(90deg)' : '', transition: 'transform 0.2s', color: 'var(--muted)' }} />
      </div>
      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map(r => (
            <div key={r.ROWID} style={{ background: '#fff', border: '1px solid #e5c96a', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.requester_name || r.requester_email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>wants access to <strong>{r.folder_name}</strong></div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(r.requested_at).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ background: '#15803d', borderColor: '#15803d' }} onClick={() => onReview(r.ROWID, 'approve')}>
                  <IconUserCheck size={13} /> Approve
                </button>
                <button className="btn btn-outline btn-sm" style={{ color: '#c0392b', borderColor: '#c0392b' }} onClick={() => onReview(r.ROWID, 'reject')}>
                  <IconX size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── WD Delete Requests Panel (SUPER_ADMIN) ────────────────────────────────────
function WdDeleteRequestsPanel({ requests, onReview }) {
  const [expanded, setExpanded] = useState(false)
  const pending = requests.filter(r => r.status === 'pending')
  if (pending.length === 0) return null

  return (
    <div style={{ background: '#fff1f0', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(p => !p)}>
        <IconTrash size={16} style={{ color: '#c0392b' }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{pending.length} pending file deletion {pending.length === 1 ? 'request' : 'requests'}</span>
        <IconChevronRight size={14} style={{ marginLeft: 'auto', transform: expanded ? 'rotate(90deg)' : '', transition: 'transform 0.2s', color: 'var(--muted)' }} />
      </div>
      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map(r => (
            <div key={r.ROWID} style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.file_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Requested by <strong>{r.requested_by_name || r.requested_by_email}</strong>
                  {r.folder_name && <> in <strong>{r.folder_name}</strong></>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(r.requested_at).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ background: '#c0392b', borderColor: '#c0392b' }} onClick={() => onReview(r.ROWID, 'approve')}>
                  <IconTrash size={13} /> Approve & Delete
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onReview(r.ROWID, 'reject')}>
                  <IconX size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── File icon helper ──────────────────────────────────────────────────────────
const FILE_ICONS = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', ods: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', zip: '🗜️', rar: '🗜️' }
function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase()
  return FILE_ICONS[ext] || '📎'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkDriveFiles({ addToast }) {
  const { user } = useAuth()
  const location = useLocation()
  const role = user?.role || 'VIEWER'
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const [rootFolders, setRootFolders] = useState([])
  const [activeRoot, setActiveRoot] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [folderRole, setFolderRole] = useState(null) // folder-specific role override
  const [accessDenied, setAccessDenied] = useState(null)
  const [requestSent, setRequestSent] = useState(false)
  const [requestSending, setRequestSending] = useState(false)

  const [renameItem, setRenameItem] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [moveItem, setMoveItem] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Admin-only state
  const [permModal, setPermModal] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [accessRequests, setAccessRequests] = useState([])
  const [deleteRequests, setDeleteRequests] = useState([])

  // Load folders on mount; detect navigation intent from location state
  useEffect(() => {
    api.workdrive.folders()
      .then((d) => {
        const fols = d.folders || []
        setRootFolders(fols)
        const { permFolderId, permFolderName, openFolderId, openFolderName } = location.state || {}
        if (permFolderId) {
          // Gear icon from Dashboard → open folder + permissions modal
          const target = fols.find(f => f.id === permFolderId) || { id: permFolderId, name: permFolderName || permFolderId }
          openRoot(target)
          setPermModal(target)
          window.history.replaceState({}, '')
        } else if (openFolderId) {
          // Workspace card from Dashboard → open that folder directly
          const target = fols.find(f => f.id === openFolderId) || { id: openFolderId, name: openFolderName || openFolderId }
          openRoot(target)
          window.history.replaceState({}, '')
        } else {
          const targetId = window.history.state?.usr?.folderId
          const target = targetId ? fols.find((f) => f.id === targetId) : null
          openRoot(target || fols[0])
        }
      })
      .catch(() => addToast('Failed to load WorkDrive folders', 'error'))
  }, [])

  // Admin: load users and access requests
  useEffect(() => {
    if (!isAdmin) return
    api.users.list().then(d => setAllUsers(d.users || d || [])).catch(() => {})
    loadAccessRequests()
    loadDeleteRequests()
  }, [isAdmin])

  function loadAccessRequests() {
    api.workdrive.accessRequests().then(d => setAccessRequests(d.requests || [])).catch(() => {})
  }

  function loadDeleteRequests() {
    api.workdrive.deleteRequests().then(d => setDeleteRequests(d.requests || [])).catch(() => {})
  }

  function openRoot(folder) {
    if (!folder) return
    setActiveRoot(folder)
    setBreadcrumb([{ id: folder.id, name: folder.name }])
    loadFolder(folder.id)
  }

  function loadFolder(folderId, crumbsSnapshot) {
    setLoading(true)
    setAccessDenied(null)
    setRequestSent(false)
    setFolderRole(null)
    setItems([])
    api.workdrive.files(folderId)
      .then((d) => {
        setItems(d.items || d.files || [])
        setFolderRole(d.folder_role || null)
      })
      .catch((err) => {
        if (err.status === 403) {
          const crumbs = crumbsSnapshot || breadcrumb
          const folderName = crumbs.find(b => b.id === folderId)?.name
            || rootFolders.find(f => f.id === folderId)?.name
            || folderId
          setAccessDenied({ folderId, folderName })
        } else {
          addToast('Failed to load folder contents', 'error')
        }
      })
      .finally(() => setLoading(false))
  }

  function openSubfolder(item) {
    const newCrumbs = [...breadcrumb, { id: item.id, name: item.name }]
    setBreadcrumb(newCrumbs)
    loadFolder(item.id, newCrumbs)
  }

  function navigateBreadcrumb(index) {
    const newCrumbs = breadcrumb.slice(0, index + 1)
    setBreadcrumb(newCrumbs)
    loadFolder(newCrumbs[newCrumbs.length - 1].id, newCrumbs)
  }

  function goUp() {
    if (breadcrumb.length <= 1) return
    const newCrumbs = breadcrumb.slice(0, -1)
    setBreadcrumb(newCrumbs)
    loadFolder(newCrumbs[newCrumbs.length - 1].id, newCrumbs)
  }

  async function handleRequestAccess() {
    if (!accessDenied) return
    setRequestSending(true)
    try {
      await api.workdrive.requestAccess({ folder_id: accessDenied.folderId, folder_name: accessDenied.folderName })
      setRequestSent(true)
      addToast('Access request sent to admin', 'success')
    } catch (err) {
      if (err.status === 409) {
        setRequestSent(true)
        addToast('You already have a pending request for this folder', 'info')
      } else {
        addToast(err.message || 'Failed to send request', 'error')
      }
    } finally {
      setRequestSending(false)
    }
  }

  async function handleReviewRequest(id, action) {
    try {
      await api.workdrive.reviewAccessRequest(id, action)
      addToast(action === 'approve' ? 'Access approved' : 'Request rejected', 'success')
      loadAccessRequests()
    } catch (err) {
      addToast(err.message || 'Action failed', 'error')
    }
  }

  // SUPER_ADMIN: direct delete
  async function handleDelete(item) {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return
    try {
      await api.workdrive.deleteFile(item.id)
      setItems((p) => p.filter((f) => f.id !== item.id))
      addToast('Deleted from WorkDrive', 'success')
    } catch {
      addToast('Delete failed', 'error')
    }
  }

  // ADMIN / EDITOR: submit delete request
  async function handleRequestDelete(item) {
    if (!confirm(`Submit a delete request for "${item.name}"?\nA Super Admin will review and approve before it's deleted.`)) return
    try {
      const folderName = breadcrumb[0]?.name || ''
      await api.workdrive.requestDelete({ file_id: item.id, file_name: item.name, folder_name: folderName })
      addToast('Delete request submitted — waiting for Super Admin approval', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to submit request', 'error')
    }
  }

  // SUPER_ADMIN: approve / reject delete requests
  async function handleReviewDeleteRequest(id, action) {
    try {
      await api.workdrive.reviewDeleteRequest(id, action)
      addToast(action === 'approve' ? 'File deleted' : 'Request rejected', 'success')
      loadDeleteRequests()
      if (action === 'approve') loadFolder(currentFolderId)
    } catch (err) {
      addToast(err.message || 'Action failed', 'error')
    }
  }

  async function handleRename() {
    if (!renameName.trim()) return
    try {
      await api.workdrive.renameFile(renameItem.id, renameName.trim())
      setItems((p) => p.map((f) => f.id === renameItem.id ? { ...f, name: renameName.trim() } : f))
      addToast('Renamed successfully', 'success')
    } catch {
      addToast('Rename failed', 'error')
    } finally {
      setRenameItem(null)
    }
  }

  async function handleMove(targetFolderId) {
    try {
      await api.workdrive.moveFile(moveItem.id, targetFolderId)
      setItems((p) => p.filter((f) => f.id !== moveItem.id))
      addToast('Moved successfully', 'success')
    } catch (err) {
      addToast(err.message || 'Move failed', 'error')
    } finally {
      setMoveItem(null)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !currentFolderId) return
    try {
      const folder = await api.workdrive.createFolder(currentFolderId, newFolderName.trim())
      setItems((p) => [...p, {
        id: folder.id,
        name: folder.name || newFolderName.trim(),
        is_folder: true,
        type: 'folder',
        size: '—',
        modified: new Date().toLocaleDateString(),
      }])
      addToast('Folder created', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to create folder', 'error')
    } finally {
      setShowNewFolder(false)
      setNewFolderName('')
    }
  }

  const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id
  const effectiveRole = folderRole || role
  const canEdit = isAdmin || effectiveRole === 'EDITOR'
  const canDirectDelete = role === 'SUPER_ADMIN'
  const canRequestDelete = !canDirectDelete && (role === 'ADMIN' || effectiveRole === 'EDITOR')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">WorkDrive Files</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canDirectDelete && currentFolderId && !accessDenied && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowNewFolder(true); setNewFolderName('') }}>
              + New Folder
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => currentFolderId && loadFolder(currentFolderId)}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Pending access requests banner */}
      {isAdmin && accessRequests.length > 0 && (
        <AccessRequestsPanel requests={accessRequests} onReview={handleReviewRequest} />
      )}

      {/* Pending WD delete requests banner — SUPER_ADMIN only */}
      {role === 'SUPER_ADMIN' && deleteRequests.filter(r => r.status === 'pending').length > 0 && (
        <WdDeleteRequestsPanel requests={deleteRequests} onReview={handleReviewDeleteRequest} />
      )}

      <div className="workdrive-layout">
        {/* Sidebar — visible to all, shows all folders */}
        <div className="workdrive-folders">
          <div className="workdrive-folders-title">Folders</div>
          {rootFolders.map((f) => (
            <div key={f.id} className="folder-item-row">
              <button
                className={`folder-item ${activeRoot?.id === f.id ? 'active' : ''}`}
                onClick={() => openRoot(f)}
              >
                <IconFolder size={16} />
                <span>{f.name}</span>
              </button>
              {isAdmin && (
                <button
                  className="folder-manage-btn"
                  title="Manage folder access"
                  onClick={(e) => { e.stopPropagation(); setPermModal(f) }}
                >
                  <IconSettings size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Main file area */}
        <div className="workdrive-files">
          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <div className="wd-breadcrumb">
              {breadcrumb.length > 1 && (
                <button className="wd-back-btn" onClick={goUp}>
                  <IconArrowLeft size={14} />
                </button>
              )}
              {breadcrumb.map((crumb, i) => (
                <React.Fragment key={crumb.id}>
                  {i > 0 && <IconChevronRight size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                  <button
                    className={`wd-crumb ${i === breadcrumb.length - 1 ? 'active' : ''}`}
                    onClick={() => i < breadcrumb.length - 1 && navigateBreadcrumb(i)}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Access Denied state */}
          {accessDenied && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <IconLock size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Access Required</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                You don't have permission to view <strong>"{accessDenied.folderName}"</strong>.
                {!requestSent && ' Request access from the admin to get in.'}
              </p>
              {isAdmin ? (
                <button className="btn btn-primary" onClick={() => setPermModal(rootFolders.find(f => f.id === accessDenied.folderId) || { id: accessDenied.folderId, name: accessDenied.folderName })}>
                  <IconSettings size={14} /> Manage Access
                </button>
              ) : requestSent ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, fontSize: 14, background: '#dcfce7', padding: '10px 20px', borderRadius: 8 }}>
                  <IconCheck size={16} /> Request sent — waiting for admin approval
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleRequestAccess} disabled={requestSending}>
                  {requestSending ? 'Sending…' : 'Request Access'}
                </button>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && <div className="loading-state">Loading…</div>}

          {/* Empty folder */}
          {!loading && !accessDenied && items.length === 0 && (
            <div className="empty-state">This folder is empty.</div>
          )}

          {/* File list */}
          {!loading && !accessDenied && items.length > 0 && (
            <div className="table-wrap">
              <table className="doc-table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`doc-row ${item.is_folder ? 'folder-row' : ''}`}
                      onClick={item.is_folder ? () => openSubfolder(item) : undefined}
                      style={item.is_folder ? { cursor: 'pointer' } : {}}
                    >
                      <td className="doc-name-cell">
                        {item.is_folder
                          ? <IconFolderOpen size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          : <span>{fileIcon(item.name)}</span>
                        }
                        <span style={item.is_folder ? { fontWeight: 600 } : {}}>{item.name}</span>
                      </td>
                      <td>{item.is_folder ? 'Folder' : (item.type?.toUpperCase() || '—')}</td>
                      <td>{item.size || '—'}</td>
                      <td>{item.modified || '—'}</td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        {item.is_folder ? (
                          <button className="icon-btn" title="Open" onClick={() => openSubfolder(item)}>
                            <IconFolderOpen size={15} />
                          </button>
                        ) : (
                          <a
                            href={item.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            title="Download"
                            onClick={() => api.workdrive.trackDownload(item.id, item.name, breadcrumb[breadcrumb.length - 1]?.name || '')}
                          >
                            <IconDownload size={15} />
                          </a>
                        )}
                        {canEdit && (
                          <button className="icon-btn" title="Rename" onClick={() => { setRenameItem(item); setRenameName(item.name) }}>
                            <IconPencil size={15} />
                          </button>
                        )}
                        {canDirectDelete && !item.is_folder && (
                          <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(item)}>
                            <IconTrash size={15} />
                          </button>
                        )}
                        {canRequestDelete && !item.is_folder && (
                          <button className="icon-btn" title="Request deletion" style={{ color: '#c0392b' }} onClick={() => handleRequestDelete(item)}>
                            <IconTrash size={15} />
                          </button>
                        )}
                        {canDirectDelete && (
                          <button className="icon-btn" title="Move" onClick={() => setMoveItem(item)}>
                            <IconArrowsMove size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {renameItem && (
        <div className="modal-backdrop" onClick={() => setRenameItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rename</h2>
              <button className="icon-btn" onClick={() => setRenameItem(null)}><IconArrowLeft size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>New name</label>
                <input value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setRenameItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="modal-backdrop" onClick={() => setShowNewFolder(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Folder</h2>
              <button className="icon-btn" onClick={() => setShowNewFolder(false)}><IconArrowLeft size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Folder name</label>
                <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} autoFocus placeholder="Enter folder name" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveItem && (
        <MoveModal item={moveItem} rootFolders={rootFolders} onMove={handleMove} onClose={() => setMoveItem(null)} />
      )}

      {/* Permissions Modal (admin) */}
      {permModal && (
        <PermissionsModal
          folder={permModal}
          users={allUsers}
          onClose={() => setPermModal(null)}
          onSave={() => {
            addToast('Permissions saved', 'success')
            if (accessDenied?.folderId === permModal.id) loadFolder(permModal.id)
          }}
        />
      )}
    </div>
  )
}
