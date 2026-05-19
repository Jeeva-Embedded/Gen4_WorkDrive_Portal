import React, { useEffect, useState } from 'react'
import { IconTrash, IconCheck, IconX, IconRefresh, IconFolder } from '@tabler/icons-react'
import { api } from '../utils/api'

export default function DeleteRequests({ addToast }) {
  const [docRequests, setDocRequests] = useState([])
  const [wdRequests, setWdRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState({})

  function load() {
    setLoading(true)
    Promise.all([
      api.deleteRequests.list().catch(() => ({ requests: [] })),
      api.workdrive.deleteRequests().catch(() => ({ requests: [] })),
    ]).then(([docData, wdData]) => {
      setDocRequests(docData.requests || [])
      setWdRequests(wdData.requests || [])
    }).catch(() => addToast('Failed to load delete requests', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function reviewDoc(id, action) {
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      await api.deleteRequests.review(id, action)
      addToast(action === 'approve' ? 'Document deleted' : 'Request rejected', action === 'approve' ? 'success' : 'info')
      setDocRequests((p) => p.filter((r) => r.ROWID !== id))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

  async function reviewWd(id, action) {
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      await api.workdrive.reviewDeleteRequest(id, action)
      addToast(action === 'approve' ? 'File deleted from WorkDrive' : 'Request rejected', action === 'approve' ? 'success' : 'info')
      setWdRequests((p) => p.filter((r) => r.ROWID !== id))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

  const pendingDocs = docRequests.filter(r => !r.status || r.status === 'pending')
  const pendingWd = wdRequests.filter(r => r.status === 'pending')
  const totalPending = pendingDocs.length + pendingWd.length

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Delete Requests</h1>
        <button className="btn btn-outline btn-sm" onClick={load}>
          <IconRefresh size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : totalPending === 0 ? (
        <div className="empty-state">
          <IconTrash size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
          <div>No pending delete requests</div>
        </div>
      ) : (
        <>
          {/* WorkDrive file delete requests */}
          {pendingWd.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconFolder size={16} style={{ color: '#f59e0b' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>WorkDrive Files</h2>
                <span style={{ background: '#fee2e2', color: '#c0392b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pendingWd.length}</span>
              </div>
              <div className="table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Folder</th>
                      <th>Requested by</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWd.map((r) => (
                      <tr key={r.ROWID} className="doc-row">
                        <td className="doc-name-cell">
                          <IconTrash size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                          <span>{r.file_name}</span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>{r.folder_name || '—'}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.requested_by_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.requested_by_email}</div>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ background: '#c0392b', borderColor: '#c0392b' }}
                            disabled={busy[r.ROWID]}
                            onClick={() => reviewWd(r.ROWID, 'approve')}
                            title="Approve — permanently deletes the file from WorkDrive"
                          >
                            <IconCheck size={13} /> Approve & Delete
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={busy[r.ROWID]}
                            onClick={() => reviewWd(r.ROWID, 'reject')}
                          >
                            <IconX size={13} /> Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Portal document delete requests */}
          {pendingDocs.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconTrash size={16} style={{ color: 'var(--danger)' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Portal Documents</h2>
                <span style={{ background: '#fee2e2', color: '#c0392b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pendingDocs.length}</span>
              </div>
              <div className="table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Requested by</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDocs.map((r) => (
                      <tr key={r.ROWID} className="doc-row">
                        <td className="doc-name-cell">
                          <IconTrash size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                          <span>{r.doc_name}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.requested_by_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.requested_by}</div>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy[r.ROWID]}
                            onClick={() => reviewDoc(r.ROWID, 'approve')}
                            title="Approve — deletes the document"
                          >
                            <IconCheck size={13} /> Approve
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={busy[r.ROWID]}
                            onClick={() => reviewDoc(r.ROWID, 'reject')}
                          >
                            <IconX size={13} /> Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
