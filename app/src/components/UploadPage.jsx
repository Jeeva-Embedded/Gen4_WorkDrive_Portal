import React, { useState, useRef, useCallback, useEffect } from 'react'
import { IconUpload, IconX, IconFile, IconFolder, IconFolderOpen, IconChevronRight, IconArrowLeft, IconPlus } from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/roles'

const ACCEPTED = '.pdf,.doc,.docx,.xlsx,.xls,.ods,.png,.jpg,.jpeg,.zip,.rar,.dwg,.step,.stp'
const MAX_MB = 50

const ACCESS_OPTIONS = [
  { value: 'ALL',          label: 'Everyone (All roles)' },
  { value: 'EDITOR_ABOVE', label: 'Editors & above' },
  { value: 'ADMIN_ABOVE',  label: 'Admins & above only' },
  { value: 'SUPER_ADMIN',  label: 'Super Admin only' },
]

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function FolderPicker({ workspaces, onSelect, canCreate, addToast }) {
  const [crumbs, setCrumbs] = useState([])   // [{id, name}]
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState(null)

  function openWorkspace(ws) {
    setActiveWorkspace(ws)
    setCrumbs([{ id: ws.id, name: ws.name }])
    loadFolder(ws.id)
    onSelect(ws)
  }

  function loadFolder(folderId) {
    setLoading(true)
    api.workdrive.files(folderId)
      .then((d) => setItems((d.items || []).filter((i) => i.is_folder)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  function openSub(item) {
    const newCrumbs = [...crumbs, { id: item.id, name: item.name }]
    setCrumbs(newCrumbs)
    loadFolder(item.id)
    onSelect({ id: item.id, name: item.name })
  }

  async function handleCreateFolder(canCreate, addToast) {
    if (!canCreate) return
    const name = window.prompt('New folder name:')
    if (!name?.trim()) return
    const parentId = crumbs[crumbs.length - 1]?.id
    if (!parentId) return
    try {
      const folder = await api.workdrive.createFolder(parentId, name.trim())
      const newItem = { id: folder.id, name: folder.name || name.trim(), is_folder: true }
      setItems((p) => [...p, newItem])
      addToast('Folder created', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to create folder', 'error')
    }
  }

  function navigate(index) {
    const c = crumbs[index]
    setCrumbs(crumbs.slice(0, index + 1))
    loadFolder(c.id)
    onSelect(c)
  }

  function goUp() {
    if (crumbs.length <= 1) return
    const newCrumbs = crumbs.slice(0, -1)
    setCrumbs(newCrumbs)
    const parent = newCrumbs[newCrumbs.length - 1]
    loadFolder(parent.id)
    onSelect(parent)
  }

  return (
    <div className="folder-picker">
      <div className="folder-picker-workspaces">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            className={`folder-picker-ws ${activeWorkspace?.id === ws.id ? 'active' : ''}`}
            onClick={() => openWorkspace(ws)}
          >
            <IconFolder size={14} />
            <span>{ws.name}</span>
          </button>
        ))}
      </div>

      {activeWorkspace && (
        <div className="folder-picker-browser">
          <div className="wd-breadcrumb" style={{ marginBottom: 6 }}>
            {crumbs.length > 1 && (
              <button className="wd-back-btn" onClick={goUp}><IconArrowLeft size={13} /></button>
            )}
            {crumbs.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <IconChevronRight size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                <button
                  className={`wd-crumb ${i === crumbs.length - 1 ? 'active' : ''}`}
                  onClick={() => i < crumbs.length - 1 && navigate(i)}
                  style={{ fontSize: 12 }}
                >
                  {c.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '4px 0' }}>Loading…</div>
          ) : (
            <>
              {items.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '4px 0' }}>No subfolders — uploading to current folder</div>
              ) : (
                <div className="folder-picker-subs">
                  {items.map((item) => (
                    <button key={item.id} className="folder-picker-sub" onClick={() => openSub(item)}>
                      <IconFolderOpen size={14} style={{ color: '#f59e0b' }} />
                      <span>{item.name}</span>
                      <IconChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
                    </button>
                  ))}
                </div>
              )}
              {canCreate && crumbs.length > 0 && (
                <button
                  className="folder-picker-sub"
                  style={{ marginTop: 6, color: 'var(--primary)', borderColor: 'var(--primary)', background: 'var(--primary-light)' }}
                  onClick={() => handleCreateFolder(canCreate, addToast)}
                >
                  <IconPlus size={13} /><span>New folder here</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function UploadPage({ addToast }) {
  const { user } = useAuth()
  const role = user?.role || ROLES.VIEWER
  const canCreate = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState({})
  const [done, setDone] = useState({})
  const [errors, setErrors] = useState({})
  const [workspaces, setWorkspaces] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState(user?.name || '')
  const [accessRole, setAccessRole] = useState('ALL')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    api.workdrive.folders().then((d) => {
      const folders = d.folders || []
      setWorkspaces(folders)
      if (folders.length) setSelectedFolder(folders[0])
    }).catch(() => addToast('Failed to load WorkDrive folders', 'error'))
  }, [])

  function addFiles(newFiles) {
    const valid = Array.from(newFiles).filter((f) => {
      if (f.size > MAX_MB * 1024 * 1024) { addToast(`${f.name} exceeds 50 MB`, 'error'); return false }
      return true
    })
    setFiles((p) => [...p, ...valid])
  }

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }, [])

  function clear() { setFiles([]); setProgress({}); setDone({}); setErrors({}); setDescription('') }

  async function handleUpload() {
    if (!files.length) return
    if (!author.trim()) { addToast('Author name is required', 'error'); return }
    if (!selectedFolder) { addToast('Please select a folder', 'error'); return }
    setUploading(true)
    let anyError = false

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress((p) => ({ ...p, [i]: 20 }))
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('category', selectedFolder.name)
        fd.append('folder_id', selectedFolder.id)
        fd.append('description', description)
        fd.append('author', author.trim())
        fd.append('access_role', accessRole)
        setProgress((p) => ({ ...p, [i]: 50 }))
        await api.upload.file(fd)
        setProgress((p) => ({ ...p, [i]: 100 }))
        setDone((p) => ({ ...p, [i]: true }))
      } catch (err) {
        setErrors((p) => ({ ...p, [i]: err.message }))
        anyError = true
      }
    }

    setUploading(false)
    anyError ? addToast('Some files failed — check errors below', 'error') : addToast('All files uploaded to WorkDrive!', 'success')
  }

  return (
    <div className="page">
      <h1 className="page-title">Upload Files</h1>
      <p className="page-desc">Files are saved directly to the selected WorkDrive folder.</p>

      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
      >
        <IconUpload size={40} color="var(--primary)" />
        <p className="drop-text">Drag & drop files here, or <span className="drop-link">click to browse</span></p>
        <p className="drop-hint">PDF, DOCX, XLSX, DWG, STEP, PNG — up to 50 MB each</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} style={{ display: 'none' }} onChange={(e) => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="upload-queue">
          {files.map((f, i) => (
            <div key={i} className="upload-queue-row">
              <div className="upload-queue-item">
                <IconFile size={16} />
                <div className="upload-queue-info">
                  <span className="upload-queue-name">{f.name}</span>
                  <span className="upload-queue-size">{formatSize(f.size)}</span>
                  {!done[i] && !errors[i] && progress[i] > 0 && (
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress[i] || 0}%` }} /></div>
                  )}
                  {done[i] && <span className="upload-done">✓ Saved to WorkDrive</span>}
                  {errors[i] && <span className="upload-error">{errors[i]}</span>}
                </div>
              </div>
              {!uploading && !done[i] && (
                <button className="icon-btn" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                  <IconX size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="upload-form">
        <div className="form-group">
          <label>WorkDrive Folder <span style={{ color: 'var(--danger)' }}>*</span></label>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 6px' }}>
            Select a workspace, then navigate into a subfolder if needed.
            {selectedFolder && <> · <strong>Uploading to:</strong> {selectedFolder.name}</>}
          </p>
          <FolderPicker workspaces={workspaces} onSelect={setSelectedFolder} canCreate={canCreate} addToast={addToast} />
        </div>

        <div className="form-group">
          <label>Who can access this file?</label>
          <select value={accessRole} onChange={(e) => setAccessRole(e.target.value)}>
            {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Author <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
        </div>
        <div className="form-group">
          <label>Description / Notes</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes…" />
        </div>
        <div className="upload-actions">
          <button className="btn btn-outline" onClick={clear} disabled={uploading}>Clear</button>
          <button className="btn btn-primary" onClick={handleUpload} disabled={!files.length || uploading || !selectedFolder}>
            {uploading ? 'Uploading to WorkDrive…' : `Upload${files.length ? ` (${files.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
