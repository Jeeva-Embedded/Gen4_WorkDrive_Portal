import React, { useState, useRef, useEffect } from 'react'
import {
  IconChevronRight, IconFolder, IconFolderOpen, IconFile,
  IconRefresh, IconCopy, IconDownload, IconPlayerStop,
  IconSearch, IconCheck, IconArrowLeft, IconTree,
} from '@tabler/icons-react'
import { api } from '../utils/api'

// ── Text tree builder ─────────────────────────────────────────────────────────
function toTextTree(node, prefix = '', isLast = true, isRoot = true) {
  const lines = []
  if (isRoot) {
    lines.push(`📁 ${node.name}`)
  } else {
    const connector = isLast ? '└── ' : '├── '
    const icon = node.type === 'file' ? '📄 ' : '📁 '
    lines.push(`${prefix}${connector}${icon}${node.name}`)
  }

  if (node.children && node.children.length > 0) {
    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ')
    node.children.forEach((child, i) => {
      const childIsLast = i === node.children.length - 1
      lines.push(toTextTree(child, childPrefix, childIsLast, false))
    })
  }
  return lines.join('\n')
}

function toJsonTree(node) {
  return {
    name: node.name,
    type: node.type,
    id: node.id,
    ...(node.children && node.children.length > 0
      ? { children: node.children.map(toJsonTree) }
      : {}),
  }
}

function countTree(node) {
  let folders = node.type !== 'file' ? 1 : 0
  let files = node.type === 'file' ? 1 : 0
  if (node.children) {
    for (const c of node.children) {
      const sub = countTree(c)
      folders += sub.folders
      files += sub.files
    }
  }
  return { folders, files }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Render tree recursively ───────────────────────────────────────────────────
function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isFolder = node.type !== 'file'
  const hasChildren = node.children && node.children.length > 0
  const indent = depth * 18

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px 5px ' + (10 + indent) + 'px',
          borderBottom: '1px solid #f4f6f8',
          cursor: isFolder && hasChildren ? 'pointer' : 'default',
          background: 'transparent',
          transition: 'background .1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={isFolder && hasChildren ? () => setExpanded(v => !v) : undefined}
      >
        <span style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isFolder && hasChildren && (
            <IconChevronRight size={12} style={{
              color: 'var(--muted)',
              transform: expanded ? 'rotate(90deg)' : '',
              transition: 'transform .15s',
            }} />
          )}
        </span>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isFolder
            ? expanded
              ? <IconFolderOpen size={14} style={{ color: '#f59e0b' }} />
              : <IconFolder size={14} style={{ color: '#f59e0b' }} />
            : <IconFile size={13} style={{ color: '#6366f1' }} />
          }
        </span>
        <span style={{
          fontSize: 13, color: 'var(--text)', flex: 1,
          fontWeight: isFolder ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {node.name}
        </span>
        {node.error && (
          <span style={{ fontSize: 10, background: '#fef2f2', color: '#c0392b', padding: '1px 6px', borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>
            Access Denied
          </span>
        )}
      </div>
      {isFolder && expanded && hasChildren && node.children.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ModelTree({ addToast }) {
  // Folder picker state
  const [workspaces, setWorkspaces] = useState([])
  const [wsLoading, setWsLoading] = useState(false)
  // selectedFolder = the folder chosen FOR generation (click row to set)
  const [selectedFolder, setSelectedFolder] = useState(null) // {id, name}
  // navCrumbs = navigation path for browsing subfolders (click → arrow to drill)
  const [navCrumbs, setNavCrumbs] = useState([]) // [{id, name}]
  const [folderItems, setFolderItems] = useState([])
  const [folderLoading, setFolderLoading] = useState(false)

  // Tree generation state
  const [tree, setTree] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [maxDepth, setMaxDepth] = useState(4)
  const [viewMode, setViewMode] = useState('tree')
  const [copied, setCopied] = useState(false)
  const stopRef = useRef(false)

  useEffect(() => { loadWorkspaces() }, [])

  async function loadWorkspaces() {
    setWsLoading(true)
    try {
      const res = await api.workdrive.folders()
      setWorkspaces(res.folders || [])
    } catch {
      addToast('Failed to load workspaces', 'error')
    } finally {
      setWsLoading(false)
    }
  }

  // Click folder row → SELECT it for generation (no navigation)
  function pickFolder(folder) {
    setSelectedFolder({ id: folder.id, name: folder.name })
    setTree(null)
  }

  // Click → arrow → DRILL INTO folder to browse subfolders
  function drillInto(folder, e) {
    e.stopPropagation()
    const crumb = { id: folder.id, name: folder.name }
    setNavCrumbs(prev => [...prev, crumb])
    loadSubfolders(folder.id)
  }

  // Navigate back via breadcrumb
  function goToCrumb(index) {
    if (index < 0) {
      // Back to workspace list
      setNavCrumbs([])
      setFolderItems([])
      return
    }
    const newCrumbs = navCrumbs.slice(0, index + 1)
    setNavCrumbs(newCrumbs)
    loadSubfolders(newCrumbs[newCrumbs.length - 1].id)
  }

  async function loadSubfolders(folderId) {
    setFolderLoading(true)
    setFolderItems([])
    try {
      const res = await api.workdrive.files(folderId)
      setFolderItems((res.items || []).filter(i => i.is_folder))
    } catch {
      setFolderItems([])
    } finally {
      setFolderLoading(false)
    }
  }

  // ── Recursive scanner ─────────────────────────────────────────────────────
  async function fetchNode(id, name, type, depth) {
    if (stopRef.current) return { id, name, type, children: [], error: false }
    setScanStatus(`Scanning: ${name}`)
    if (type === 'file' || depth >= maxDepth) return { id, name, type, children: null, error: false }
    try {
      const res = await api.workdrive.files(id)
      const items = res.items || []
      setScanCount(c => c + 1)
      items.sort((a, b) => {
        if (!a.is_folder && b.is_folder) return 1
        if (a.is_folder && !b.is_folder) return -1
        return a.name.localeCompare(b.name)
      })
      const children = []
      for (const item of items) {
        if (stopRef.current) break
        await sleep(100)
        children.push(await fetchNode(item.id, item.name, item.is_folder ? 'folder' : 'file', depth + 1))
      }
      return { id, name, type, children, error: false }
    } catch {
      setScanCount(c => c + 1)
      return { id, name, type: 'folder', children: [], error: true }
    }
  }

  async function generateTree() {
    if (!selectedFolder) return
    stopRef.current = false
    setScanning(true)
    setTree(null)
    setScanCount(0)
    setScanStatus('Starting scan…')
    const root = await fetchNode(selectedFolder.id, selectedFolder.name, 'folder', 0)
    setTree(root)
    setScanning(false)
    setScanStatus(stopRef.current ? 'Scan stopped.' : 'Done.')
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  function getTextOutput() { return tree ? toTextTree(tree) : '' }

  function handleCopy() {
    navigator.clipboard.writeText(getTextOutput()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleExportText() {
    const blob = new Blob([getTextOutput()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${tree?.name || 'tree'}-model-tree.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportJson() {
    const json = JSON.stringify(toJsonTree(tree), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${tree?.name || 'tree'}-model-tree.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const stats = tree ? countTree(tree) : null
  // Determine what list to show: workspace list or subfolder list
  const inSubfolder = navCrumbs.length > 0
  const displayItems = inSubfolder ? folderItems : workspaces

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Model Tree Generator</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Folder Picker + Generate section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 280px)', minHeight: 300, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            Select Folder
            <button className="icon-btn" onClick={loadWorkspaces} title="Reload" style={{ width: 24, height: 24 }}>
              <IconRefresh size={13} />
            </button>
          </div>

          {/* Breadcrumb navigation (only when drilled into subfolders) */}
          {inSubfolder && (
            <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', background: '#f8fafc', flexShrink: 0 }}>
              <button onClick={() => goToCrumb(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '1px 3px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconArrowLeft size={11} /> Workspaces
              </button>
              {navCrumbs.map((c, i) => (
                <React.Fragment key={c.id}>
                  <IconChevronRight size={9} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <button
                    onClick={() => i < navCrumbs.length - 1 ? goToCrumb(i) : undefined}
                    style={{
                      background: 'none', border: 'none',
                      cursor: i < navCrumbs.length - 1 ? 'pointer' : 'default',
                      fontSize: 11, fontWeight: 600,
                      color: i === navCrumbs.length - 1 ? 'var(--navy)' : 'var(--muted)',
                      padding: '1px 2px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >{c.name}</button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Instruction hint */}
          <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--muted)', background: '#fffbeb', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            Click a folder to <strong>select</strong> it · Click <strong>→</strong> to browse subfolders
          </div>

          {/* Folder list — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {wsLoading || folderLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
            ) : displayItems.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--muted)', fontSize: 12 }}>
                {inSubfolder ? 'No subfolders here' : 'No workspaces found'}
              </div>
            ) : (
              displayItems.map(item => {
                const isSelected = selectedFolder?.id === item.id
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--navy)' : '3px solid transparent',
                      transition: 'background .1s',
                    }}
                  >
                    {/* Clickable name area → SELECT */}
                    <button
                      onClick={() => pickFolder(item)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 10px 10px 11px', border: 'none',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                        fontSize: 13, fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--navy)' : 'var(--text)',
                        minWidth: 0,
                      }}
                    >
                      <IconFolder size={14} style={{ color: isSelected ? 'var(--navy)' : '#f59e0b', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </button>
                    {/* Arrow button → DRILL INTO subfolders */}
                    <button
                      onClick={(e) => drillInto(item, e)}
                      title="Browse subfolders"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        padding: '10px 12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--navy)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
                    >
                      <IconChevronRight size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

        </div>
        </div>

        {/* ── RIGHT: Controls + Tree Result ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Generate controls bar — top of right panel */}
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Row 1: folder name + depth */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selectedFolder ? 'var(--navy)' : 'var(--muted)', fontStyle: selectedFolder ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFolder ? <>📁 {selectedFolder.name}</> : 'Select a folder on the left'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Depth:</label>
                <select
                  value={maxDepth}
                  onChange={e => setMaxDepth(+e.target.value)}
                  disabled={scanning}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                >
                  {[2, 3, 4, 5, 6].map(d => <option key={d} value={d}>{d} levels</option>)}
                </select>
              </div>
            </div>
            {/* Row 2: full-width generate / stop button */}
            {scanning ? (
              <button
                onClick={() => { stopRef.current = true }}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#c0392b', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <IconPlayerStop size={14} /> Stop Scan
              </button>
            ) : (
              <button
                onClick={generateTree}
                disabled={!selectedFolder}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: '#1e40af',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: selectedFolder ? 'pointer' : 'not-allowed',
                  opacity: selectedFolder ? 1 : 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <IconSearch size={14} /> Generate Tree
              </button>
            )}
          </div>

          {/* Placeholder */}
          {!tree && !scanning && (
            <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '60px 24px', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
              <IconTree size={48} style={{ color: 'var(--border)', marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {selectedFolder ? `Ready to generate "${selectedFolder.name}"` : 'Select a folder and generate'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {selectedFolder
                  ? <>Click <strong>Generate Tree</strong> above to start scanning.</>
                  : <>Pick any workspace or drill into a subfolder on the left, then click <strong>Generate Tree</strong>.</>
                }
              </div>
            </div>
          )}

          {/* Scanning state */}
          {scanning && (
            <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--navy)', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)', marginBottom: 6 }}>Scanning folders…</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{scanCount} folders scanned</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{scanStatus}</div>
            </div>
          )}

          {tree && !scanning && (
            <>
              {/* Result toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{tree.name}</div>
                  {stats && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      📁 {stats.folders} folders &nbsp;·&nbsp; 📄 {stats.files} files
                      {stopRef.current && <span style={{ color: '#b45309', marginLeft: 8 }}>⚠ Scan stopped early</span>}
                    </div>
                  )}
                </div>

                {/* View toggle */}
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {['tree', 'text'].map(v => (
                    <button key={v} onClick={() => setViewMode(v)} style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: viewMode === v ? 'var(--navy)' : '#fff',
                      color: viewMode === v ? '#fff' : 'var(--muted)',
                    }}>
                      {v === 'tree' ? '🌲 Tree' : '📝 Text'}
                    </button>
                  ))}
                </div>

                <button className="btn btn-outline btn-sm" onClick={handleCopy}>
                  {copied ? <><IconCheck size={12} /> Copied!</> : <><IconCopy size={12} /> Copy</>}
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleExportText}>
                  <IconDownload size={12} /> TXT
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleExportJson}>
                  <IconDownload size={12} /> JSON
                </button>
                <button className="btn btn-primary btn-sm" onClick={generateTree}>
                  <IconRefresh size={12} /> Regenerate
                </button>
              </div>

              {/* Tree view */}
              {viewMode === 'tree' && (
                <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                  <TreeNode node={tree} depth={0} />
                </div>
              )}

              {/* Text view */}
              {viewMode === 'text' && (
                <pre style={{
                  background: '#0d1117', color: '#c9d1d9', borderRadius: 12,
                  padding: '20px', fontSize: 13, lineHeight: 1.9,
                  overflowX: 'auto', fontFamily: "'Courier New', monospace",
                  border: '1px solid #30363d', margin: 0,
                }}>
                  {getTextOutput()}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
