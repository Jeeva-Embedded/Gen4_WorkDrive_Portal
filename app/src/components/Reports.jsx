import React, { useState, useMemo } from 'react'
import {
  IconDownload, IconFilter, IconFileSpreadsheet,
  IconUpload, IconTrash, IconUsers, IconPencil, IconChevronDown,
} from '@tabler/icons-react'
import { api } from '../utils/api'

const TYPE_OPTIONS = [
  { value: 'all',          label: 'All Activity' },
  { value: 'Upload',       label: 'Uploads' },
  { value: 'Modification', label: 'Modifications' },
  { value: 'Delete Request', label: 'Delete Requests' },
  { value: 'User Added',   label: 'Users Added' },
]

const TYPE_ICON = {
  'Upload':         <IconUpload size={13} />,
  'Modification':   <IconPencil size={13} />,
  'Delete Request': <IconTrash size={13} />,
  'User Added':     <IconUsers size={13} />,
}

const TYPE_STYLE = {
  'Upload':         { color: '#15803d', bg: '#f0fdf4' },
  'Modification':   { color: '#b45309', bg: '#fffbeb' },
  'Delete Request': { color: '#c0392b', bg: '#fef2f2' },
  'User Added':     { color: '#1d4ed8', bg: '#eff6ff' },
}

const STATUS_STYLE = {
  'Completed':  { color: '#15803d', bg: '#f0fdf4' },
  'Approved':   { color: '#15803d', bg: '#f0fdf4' },
  'Rejected':   { color: '#c0392b', bg: '#fef2f2' },
  'Pending':    { color: '#b45309', bg: '#fffbeb' },
  'SUPER_ADMIN':{ color: '#9d174d', bg: '#fdf2f8' },
  'ADMIN':      { color: '#1d4ed8', bg: '#eff6ff' },
  'EDITOR':     { color: '#b45309', bg: '#fffbeb' },
  'VIEWER':     { color: '#15803d', bg: '#f0fdf4' },
}

function Badge({ label, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      color: style?.color || '#5d6b7a',
      background: style?.bg || '#f4f6f8',
      border: `1px solid ${(style?.color || '#5d6b7a')}30`,
    }}>{label}</span>
  )
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function fmtDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color }}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function exportCsv(rows) {
  const headers = [
    'Date', 'Time', 'Activity Type', 'File Name', 'Category', 'Sub Category',
    'Size', 'Performed By', 'Reviewed By', 'Status', 'Downloads', 'Notes',
  ]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const lines = [
    headers.join(','),
    ...rows.map(r => {
      const d = r.date ? new Date(r.date) : null
      return [
        d ? d.toLocaleDateString() : '',
        d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        r.type,
        r.file_name,
        r.category,
        r.sub_category,
        r.size,
        r.performed_by,
        r.reviewed_by,
        r.status,
        r.downloads ?? '',
        r.notes,
      ].map(escape).join(',')
    }),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gen4-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function Reports({ addToast }) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [typeFilter, setTypeFilter] = useState('all')
  const [activities, setActivities] = useState(null) // null = not yet loaded
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadReport() {
    setLoading(true)
    try {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.reports.get(params)
      setActivities(res.activities || [])
      setSummary(res.summary || {})
    } catch (err) {
      addToast(err.message || 'Failed to load report', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!activities) return []
    if (typeFilter === 'all') return activities
    return activities.filter(a => a.type === typeFilter)
  }, [activities, typeFilter])

  const hasData = activities !== null

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        {hasData && filtered.length > 0 && (
          <button className="btn btn-primary" onClick={() => exportCsv(filtered)}>
            <IconFileSpreadsheet size={15} /> Download CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="report-filter-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to || today} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={today} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Activity Type</label>
          <div className="select-wrap">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <IconChevronDown size={13} className="select-chevron" />
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={loadReport}
          disabled={loading}
          style={{ alignSelf: 'flex-end' }}
        >
          {loading ? <span className="btn-spinner" style={{ width: 14, height: 14 }}></span> : <IconFilter size={15} />}
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="stats-row" style={{ marginBottom: 24 }}>
          <SummaryCard label="Total Events" value={summary.total ?? 0} color="#4f46e5" icon={<IconFilter size={18} color="#fff" />} />
          <SummaryCard label="Uploads" value={summary.uploads ?? 0} color="#15803d" icon={<IconUpload size={18} color="#fff" />} />
          <SummaryCard label="Delete Requests" value={summary.delete_reqs ?? 0} color="#c0392b" icon={<IconTrash size={18} color="#fff" />} />
          <SummaryCard label="Total Downloads" value={summary.total_downloads ?? 0} color="#d97706" icon={<IconDownload size={18} color="#fff" />} />
        </div>
      )}

      {/* Table */}
      {!hasData ? (
        <div className="empty-state" style={{ marginTop: 48 }}>
          <IconFileSpreadsheet size={36} color="#dde3ea" />
          <div style={{ marginTop: 12, color: 'var(--muted)' }}>Select a date range and click <strong>Generate Report</strong></div>
        </div>
      ) : loading ? (
        <div className="loading-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No activity found for the selected filters.</div>
      ) : (
        <div className="table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>File / Item</th>
                <th>Category</th>
                <th>Performed By</th>
                <th>Reviewed By</th>
                <th>Status</th>
                <th>Size</th>
                <th>Downloads</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.rowid || i} className="doc-row">
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                    {fmtDateTime(a.date)}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      color: TYPE_STYLE[a.type]?.color || '#5d6b7a',
                      background: TYPE_STYLE[a.type]?.bg || '#f4f6f8',
                    }}>
                      {TYPE_ICON[a.type]}{a.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, maxWidth: 220 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.file_name || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {a.category ? (
                      <span>
                        <span className="badge">{a.category}</span>
                        {a.sub_category && <span style={{ marginLeft: 4, color: 'var(--muted)', fontSize: 11 }}>{a.sub_category}</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>{a.performed_by || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--muted)' }}>{a.reviewed_by || '—'}</td>
                  <td><Badge label={a.status || '—'} style={STATUS_STYLE[a.status]} /></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{a.size || '—'}</td>
                  <td style={{ fontSize: 13, textAlign: 'center' }}>
                    {a.downloads !== '' ? a.downloads : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 180 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.notes || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
            Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'all' && ` · filtered by "${TYPE_OPTIONS.find(o => o.value === typeFilter)?.label}"`}
          </div>
        </div>
      )}
    </div>
  )
}
