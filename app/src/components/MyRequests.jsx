import React, { useEffect, useState } from 'react'
import { IconRefresh, IconLock, IconTrash, IconClock, IconCheck, IconX } from '@tabler/icons-react'
import { api } from '../utils/api'

const STATUS_STYLE = {
  pending:  { label: 'Pending',  color: '#b45309', bg: '#fffbeb' },
  approved: { label: 'Approved', color: '#15803d', bg: '#f0fdf4' },
  rejected: { label: 'Rejected', color: '#c0392b', bg: '#fef2f2' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
    }}>
      {status === 'pending' && <IconClock size={11} />}
      {status === 'approved' && <IconCheck size={11} />}
      {status === 'rejected' && <IconX size={11} />}
      {s.label}
    </span>
  )
}

export default function MyRequests({ addToast }) {
  const [accessReqs, setAccessReqs] = useState([])
  const [deleteReqs, setDeleteReqs] = useState([])
  const [loading, setLoading] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      api.workdrive.accessRequests().catch(() => ({ requests: [] })),
      api.workdrive.deleteRequests().catch(() => ({ requests: [] })),
    ]).then(([ar, dr]) => {
      setAccessReqs(ar.requests || [])
      setDeleteReqs(dr.requests || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const hasAny = accessReqs.length > 0 || deleteReqs.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Requests</h1>
        <button className="btn btn-outline btn-sm" onClick={load}>
          <IconRefresh size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : !hasAny ? (
        <div className="empty-state">
          <IconClock size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
          <div>No requests submitted yet</div>
        </div>
      ) : (
        <>
          {/* Folder Access Requests */}
          {accessReqs.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconLock size={16} style={{ color: '#1a5276' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Folder Access Requests</h2>
                <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {accessReqs.length}
                </span>
              </div>
              <div className="table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Folder</th>
                      <th>Requested On</th>
                      <th>Status</th>
                      <th>Reviewed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessReqs.map(r => (
                      <tr key={r.ROWID} className="doc-row">
                        <td className="doc-name-cell">
                          <IconLock size={14} style={{ color: '#1a5276', flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{r.folder_name}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.reviewed_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Delete Requests */}
          {deleteReqs.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <IconTrash size={16} style={{ color: '#c0392b' }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>File Delete Requests</h2>
                <span style={{ background: '#fee2e2', color: '#c0392b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {deleteReqs.length}
                </span>
              </div>
              <div className="table-wrap">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Folder</th>
                      <th>Requested On</th>
                      <th>Status</th>
                      <th>Reviewed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deleteReqs.map(r => (
                      <tr key={r.ROWID} className="doc-row">
                        <td className="doc-name-cell">
                          <IconTrash size={14} style={{ color: '#c0392b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{r.file_name}</span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.folder_name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.reviewed_by || '—'}</td>
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
