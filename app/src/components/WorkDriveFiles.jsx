import React, { useEffect, useState } from 'react'
import { IconFolder, IconFolderOpen, IconDownload, IconRefresh, IconChevronRight, IconArrowLeft, IconTrash, IconPencil, IconArrowsMove, IconCheck } from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { can } from '../utils/roles'

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
          {/* Workspace list */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Workspaces</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
              {rootFolders.map((f) => (
                <button
                  key={f.id}
                  className={`folder-item ${crumbs[0]?.id === f.id ? 'active' : ''}`}
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '6px 10px' }}
                  onClick={() => openWorkspace(f)}
                >
                  <IconFolder size={14} /><span>{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subfolder browser */}
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

const FILE_ICONS = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', ods: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', zip: '🗜️', rar: '🗜️' }
function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase()
  return FILE_ICONS[ext] || '📎'
}

export default function WorkDriveFiles({ addToast }) {
  const { user } = useAuth()
  const role = user?.role || 'VIEWER'
  const [rootFolders, setRootFolders] = useState([])
  const [activeRoot, setActiveRoot] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [renameItem, setRenameItem] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [moveItem, setMoveItem] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    api.workdrive.folders()
      .then((d) => {
        setRootFolders(d.folders || [])
        if (d.folders?.length) openRoot(d.folders[0])
      })
      .catch(() => addToast('Failed to load WorkDrive folders', 'error'))
  }, [])

  function openRoot(folder) {
    setActiveRoot(folder)
    setBreadcrumb([{ id: folder.id, name: folder.name }])
    loadFolder(folder.id)
  }

  function loadFolder(folderId) {
    setLoading(true)
    api.workdrive.files(folderId)
      .then((d) => setItems(d.items || d.files || []))
      .catch(() => addToast('Failed to load folder contents', 'error'))
      .finally(() => setLoading(false))
  }

  function openSubfolder(item) {
    setBreadcrumb((prev) => [...prev, { id: item.id, name: item.name }])
    loadFolder(item.id)
  }

  function navigateBreadcrumb(index) {
    const crumb = breadcrumb[index]
    setBreadcrumb(breadcrumb.slice(0, index + 1))
    loadFolder(crumb.id)
  }

  function goUp() {
    if (breadcrumb.length <= 1) return
    const newCrumbs = breadcrumb.slice(0, -1)
    setBreadcrumb(newCrumbs)
    loadFolder(newCrumbs[newCrumbs.length - 1].id)
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await api.workdrive.deleteFile(item.id)
      setItems((p) => p.filter((f) => f.id !== item.id))
      addToast('Deleted from WorkDrive', 'success')
    } catch {
      addToast('Delete failed', 'error')
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
  const canEdit = can(role, 'upload')
  const canDelete = role === 'SUPER_ADMIN' || role === 'ADMIN'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">WorkDrive Files</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canDelete && currentFolderId && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowNewFolder(true); setNewFolderName('') }}>
              + New Folder
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => currentFolderId && loadFolder(currentFolderId)}>
            <IconRefresh size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="workdrive-layout">
        <div className="workdrive-folders">
          <div className="workdrive-folders-title">Folders</div>
          {rootFolders.map((f) => (
            <button
              key={f.id}
              className={`folder-item ${activeRoot?.id === f.id ? 'active' : ''}`}
              onClick={() => openRoot(f)}
            >
              <IconFolder size={16} />
              <span>{f.name}</span>
            </button>
          ))}
        </div>

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

          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : items.length === 0 ? (
            <div className="empty-state">This folder is empty.</div>
          ) : (
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
                          <a href={item.download_url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Download">
                            <IconDownload size={15} />
                          </a>
                        )}
                        {canEdit && (
                          <button className="icon-btn" title="Rename" onClick={() => { setRenameItem(item); setRenameName(item.name) }}>
                            <IconPencil size={15} />
                          </button>
                        )}
                        {canDelete && !item.is_folder && (
                          <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(item)}>
                            <IconTrash size={15} />
                          </button>
                        )}
                        {canDelete && (
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
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                  placeholder="Enter folder name"
                />
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
        <MoveModal
          item={moveItem}
          rootFolders={rootFolders}
          onMove={handleMove}
          onClose={() => setMoveItem(null)}
        />
      )}
    </div>
  )
}
