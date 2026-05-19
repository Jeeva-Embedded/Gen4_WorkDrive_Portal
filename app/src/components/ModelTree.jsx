import React, { useState, useRef, useCallback } from 'react'
import {
  IconChevronRight, IconFolder, IconFolderOpen, IconFile,
  IconRefresh, IconCopy, IconDownload, IconPlayerStop,
  IconSearch, IconTree, IconCheck,
} from '@tabler/icons-react'
import { api } from '../utils/api'

// ── Text tree builder ─────────────────────────────────────────────────────────
function toTextTree(nodes, prefix = '', isRoot = true) {
  if (!nodes || nodes.length === 0) return ''
  const lines = []
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1
    const connector = isRoot ? '' : (isLast ? '└── ' : '├── ')
    const icon = node.type === 'file' ? '📄 ' : '📁 '
    lines.push(`${prefix}${connector}${icon}${node.name}`)
    if (node.children && node.children.length > 0) {
      const childPrefix = isRoot ? '' : (isLast ? '    ' : '│   ')
      lines.push(toTextTree(node.children, prefix + childPrefix, false))
    } else if (node.loaded && node.type !== 'file') {
      const childPrefix = isRoot ? '' : (isLast ? '    ' : '│   ')
      lines.push(`${prefix}${childPrefix}    (empty)`)
    }
  })
  return lines.filter(Boolean).join('\n')
}

function toJsonTree(nodes) {
  return nodes.map(n => ({
    name: n.name,
    type: n.type,
    id: n.id,
    ...(n.children && n.children.length > 0 ? { children: toJsonTree(n.children) } : {}),
  }))
}

// ── sleep helper ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Single tree node row ──────────────────────────────────────────────────────
function TreeNode({ node, depth, onToggle, onExpand }) {
  const isFolder = node.type !== 'file'
  const hasChildren = node.children && node.children.length > 0
  const indent = depth * 20

  return (
    <>
      <div
        className={`tree-row ${isFolder ? 'tree-row-folder' : ''}`}
        style={{ paddingLeft: 12 + indent }}
        onClick={isFolder ? () => onToggle(node.id) : undefined}
      >
        {/* Expand chevron */}
        <span className="tree-chevron" style={{ opacity: isFolder ? 1 : 0 }}>
          {node.loading ? (
            <span className="tree-spinner" />
          ) : (
            <IconChevronRight
              size={13}
              style={{ transform: node.expanded ? 'rotate(90deg)' : '', transition: 'transform .15s', color: 'var(--muted)' }}
            />
          )}
        </span>

        {/* Icon */}
        <span className="tree-icon">
          {isFolder
            ? node.expanded
              ? <IconFolderOpen size={15} style={{ color: '#f59e0b' }} />
              : <IconFolder size={15} style={{ color: '#f59e0b' }} />
            : <IconFile size={14} style={{ color: '#6366f1' }} />
          }
        </span>

        {/* Name */}
        <span className="tree-name" style={{ fontWeight: isFolder ? 600 : 400 }}>{node.name}</span>

        {/* Meta */}
        {node.type === 'workspace' && (
          <span className="tree-badge" style={{ background: '#e0e7ff', color: '#4f46e5' }}>Workspace</span>
        )}
        {node.error && (
          <span className="tree-badge" style={{ background: '#fef2f2', color: '#c0392b' }}>Access Denied</span>
        )}
        {isFolder && node.loaded && !node.loading && (
          <span className="tree-count">
            {(node.children || []).filter(c => c.type !== 'file').length > 0
              ? `${(node.children || []).filter(c => c.type !== 'file').length} folder${(node.children || []).filter(c => c.type !== 'file').length !== 1 ? 's' : ''}, `
              : ''
            }
            {(node.children || []).filter(c => c.type === 'file').length} file{(node.children || []).filter(c => c.type === 'file').length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {node.expanded && node.children && node.children.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} onToggle={onToggle} onExpand={onExpand} />
      ))}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ModelTree({ addToast }) {
  const [tree, setTree] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'text'
  const [copied, setCopied] = useState(false)
  const [maxDepth, setMaxDepth] = useState(4)
  const stopRef = useRef(false)

  // ── helpers ──────────────────────────────────────────────────────────────────
  const updateNode = useCallback((id, patch) => {
    setTree(prev => applyPatch(prev, id, patch))
  }, [])

  function applyPatch(nodes, id, patch) {
    return nodes.map(n => {
      if (n.id === id) return { ...n, ...patch }
      if (n.children) return { ...n, children: applyPatch(n.children, id, patch) }
      return n
    })
  }

  function findNode(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const found = findNode(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  // ── Load a single folder's children ──────────────────────────────────────────
  async function loadChildren(folderId) {
    try {
      const res = await api.workdrive.files(folderId)
      const items = (res.items || []).map(item => ({
        id: item.id,
        name: item.name,
        type: item.is_folder ? 'folder' : 'file',
        children: item.is_folder ? [] : null,
        loaded: false,
        expanded: false,
        loading: false,
        error: false,
      }))
      // folders first, then files
      items.sort((a, b) => {
        if (a.type !== 'file' && b.type === 'file') return -1
        if (a.type === 'file' && b.type !== 'file') return 1
        return a.name.localeCompare(b.name)
      })
      return { items, error: false }
    } catch (err) {
      return { items: [], error: true }
    }
  }

  // ── Toggle expand/collapse ────────────────────────────────────────────────────
  async function handleToggle(id) {
    setTree(prev => {
      const node = findNode(prev, id)
      if (!node) return prev
      if (node.expanded) return applyPatch(prev, id, { expanded: false })
      if (node.loaded) return applyPatch(prev, id, { expanded: true })
      return applyPatch(prev, id, { loading: true, expanded: true })
    })

    // Need to check if already loaded
    setTree(prev => {
      const node = findNode(prev, id)
      if (!node || node.loaded) return prev
      // kick off load
      loadChildren(id).then(({ items, error }) => {
        setTree(p => applyPatch(p, id, { children: items, loaded: true, loading: false, error }))
      })
      return prev
    })
  }

  // ── Initial workspace load ────────────────────────────────────────────────────
  async function loadWorkspaces() {
    setLoaded(false)
    setTree([])
    setScanCount(0)
    setScanStatus('Loading workspaces…')
    try {
      const res = await api.workdrive.folders()
      const workspaces = (res.folders || []).map(f => ({
        id: f.id,
        name: f.name,
        type: 'workspace',
        children: [],
        loaded: false,
        expanded: false,
        loading: false,
        error: false,
      }))
      setTree(workspaces)
      setLoaded(true)
      setScanStatus(`${workspaces.length} workspaces loaded — click to expand or use Scan All`)
    } catch {
      addToast('Failed to load workspaces', 'error')
      setScanStatus('')
    }
  }

  // ── Recursive scan all ────────────────────────────────────────────────────────
  async function scanAll() {
    if (!loaded) {
      addToast('Load workspaces first', 'info')
      return
    }
    stopRef.current = false
    setScanning(true)
    setScanCount(0)

    async function recurse(nodes, depth) {
      for (const node of nodes) {
        if (stopRef.current) return
        if (node.type === 'file') continue
        if (depth >= maxDepth) continue

        setScanStatus(`Scanning: ${node.name}`)

        const { items, error } = await loadChildren(node.id)
        setScanCount(c => c + 1)

        setTree(prev => applyPatch(prev, node.id, {
          children: items, loaded: true, loading: false,
          expanded: true, error,
        }))

        await sleep(120) // small delay to avoid rate limits
        await recurse(items.filter(i => i.type !== 'file'), depth + 1)
      }
    }

    await recurse(tree, 0)
    setScanning(false)
    setScanStatus(stopRef.current ? 'Scan stopped.' : 'Scan complete.')
  }

  // ── Text export ───────────────────────────────────────────────────────────────
  function getTextOutput() {
    return tree.map(ws => toTextTree([ws], '', true)).join('\n\n')
  }

  function handleCopy() {
    navigator.clipboard.writeText(getTextOutput()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleExportJson() {
    const json = JSON.stringify(toJsonTree(tree), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gen4-workdrive-tree-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportText() {
    const text = getTextOutput()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gen4-workdrive-tree-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalFolders = (() => {
    let n = 0
    function count(nodes) { for (const nd of nodes) { if (nd.type !== 'file') { n++; if (nd.children) count(nd.children) } } }
    count(tree)
    return n
  })()

  const totalFiles = (() => {
    let n = 0
    function count(nodes) { for (const nd of nodes) { if (nd.type === 'file') n++; if (nd.children) count(nd.children) } }
    count(tree)
    return n
  })()

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Model Tree Generator</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View toggle */}
          {loaded && (
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === 'tree' ? 'var(--navy)' : '#fff',
                  color: viewMode === 'tree' ? '#fff' : 'var(--muted)',
                }}
              >
                <IconTree size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Tree
              </button>
              <button
                onClick={() => setViewMode('text')}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === 'text' ? 'var(--navy)' : '#fff',
                  color: viewMode === 'text' ? '#fff' : 'var(--muted)',
                }}
              >
                <IconFile size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Text
              </button>
            </div>
          )}

          {loaded && (
            <>
              <button className="btn btn-outline btn-sm" onClick={handleCopy}>
                {copied ? <><IconCheck size={13} /> Copied!</> : <><IconCopy size={13} /> Copy</>}
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleExportText}>
                <IconDownload size={13} /> TXT
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleExportJson}>
                <IconDownload size={13} /> JSON
              </button>
            </>
          )}

          {scanning ? (
            <button className="btn btn-sm" style={{ background: '#c0392b', color: '#fff', borderColor: '#c0392b' }}
              onClick={() => { stopRef.current = true }}>
              <IconPlayerStop size={13} /> Stop
            </button>
          ) : (
            loaded && (
              <button className="btn btn-primary btn-sm" onClick={scanAll}>
                <IconSearch size={13} /> Scan All
              </button>
            )
          )}

          <button className="btn btn-primary btn-sm" onClick={loadWorkspaces} disabled={scanning}>
            <IconRefresh size={13} /> {loaded ? 'Reload' : 'Load Workspaces'}
          </button>
        </div>
      </div>

      {/* Options bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <label style={{ color: 'var(--muted)', fontWeight: 600 }}>Max Depth:</label>
          <select
            value={maxDepth}
            onChange={e => setMaxDepth(+e.target.value)}
            disabled={scanning}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} levels</option>)}
          </select>
        </div>

        {loaded && (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
            <span>📁 {totalFolders} folders scanned</span>
            <span>📄 {totalFiles} files found</span>
          </div>
        )}

        {scanStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: scanning ? 'var(--navy)' : 'var(--muted)' }}>
            {scanning && <span className="tree-spinner" style={{ borderTopColor: 'var(--navy)' }} />}
            {scanning && <span>Folders scanned: <strong>{scanCount}</strong> — </span>}
            <span>{scanStatus}</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loaded && (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <IconTree size={48} style={{ color: 'var(--border)', marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 8 }}>WorkDrive Model Tree</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, marginBottom: 20 }}>
            Generate a complete visual tree of your WorkDrive folder structure.
            Click folders to expand individually or use "Scan All" to load everything at once.
          </div>
          <button className="btn btn-primary" onClick={loadWorkspaces}>
            <IconRefresh size={14} /> Load Workspaces
          </button>
        </div>
      )}

      {/* Tree view */}
      {loaded && viewMode === 'tree' && (
        <div className="tree-container">
          {tree.length === 0
            ? <div className="empty-state">No workspaces found.</div>
            : tree.map(node => (
              <TreeNode key={node.id} node={node} depth={0} onToggle={handleToggle} />
            ))
          }
        </div>
      )}

      {/* Text view */}
      {loaded && viewMode === 'text' && (
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopy}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
          >
            {copied ? <><IconCheck size={12} /> Copied</> : <><IconCopy size={12} /> Copy</>}
          </button>
          <pre style={{
            background: '#0d1117', color: '#c9d1d9', borderRadius: 12,
            padding: '20px 20px 20px 20px', fontSize: 13, lineHeight: 1.8,
            overflowX: 'auto', fontFamily: "'Courier New', monospace",
            border: '1px solid #30363d', minHeight: 200,
          }}>
            {getTextOutput() || '(no folders loaded yet — click expand or Scan All first)'}
          </pre>
        </div>
      )}
    </div>
  )
}
