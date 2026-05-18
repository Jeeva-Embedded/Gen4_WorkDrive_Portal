import React, { useEffect, useState } from 'react'
import { IconTrash, IconCheck, IconX, IconRefresh } from '@tabler/icons-react'
import { api } from '../utils/api'

export default function DeleteRequests({ addToast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState({})

  function load() {
    setLoading(true)
    api.deleteRequests.list()
      .then((d) => setRequests(d.requests || []))
      .catch(() => addToast('Failed to load delete requests', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function review(id, action) {
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      await api.deleteRequests.review(id, action)
      addToast(action === 'approve' ? 'Deleted and removed from WorkDrive' : 'Request rejected', action === 'approve' ? 'success' : 'info')
      setRequests((p) => p.filter((r) => r.ROWID !== id))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

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
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <IconTrash size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
          <div>No pending delete requests</div>
        </div>
      ) : (
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
              {requests.map((r) => (
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
                      onClick={() => review(r.ROWID, 'approve')}
                      title="Approve — deletes the file permanently"
                    >
                      <IconCheck size={13} /> Approve
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={busy[r.ROWID]}
                      onClick={() => review(r.ROWID, 'reject')}
                      title="Reject — keep the file"
                    >
                      <IconX size={13} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
