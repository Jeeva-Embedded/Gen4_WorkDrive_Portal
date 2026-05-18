import React from 'react'
import { IconX, IconDownload, IconExternalLink } from '@tabler/icons-react'
import { api } from '../utils/api'

export default function ViewerPanel({ doc: d, onClose, addToast }) {
  const ext = d.name?.split('.').pop()?.toLowerCase()

  async function handleDownload() {
    window.open(d.url, '_blank')
    await api.documents.incrementDownload(d.ROWID).catch(() => {})
  }

  return (
    <>
      <div className="viewer-backdrop" onClick={onClose} />
      <div className="viewer-panel">
        <div className="viewer-toolbar">
          <div className="viewer-filename">{d.name}</div>
          <div className="viewer-toolbar-actions">
            <button className="icon-btn" title="Download" onClick={handleDownload}><IconDownload size={17} /></button>
            {d.url && (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Open in WorkDrive">
                <IconExternalLink size={17} />
              </a>
            )}
            <button className="icon-btn" onClick={onClose}><IconX size={17} /></button>
          </div>
        </div>

        <div className="viewer-body">
          <div className="viewer-badges">
            <span className="badge">{d.category}</span>
            {d.sub_category && <span className="badge badge-sub">{d.sub_category}</span>}
            {d.source && <span className="badge badge-source">{d.source}</span>}
          </div>

          <div className="viewer-preview">
            {['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? (
              <img src={d.url} alt={d.name} className="preview-image" />
            ) : ext === 'pdf' ? (
              <iframe src={d.url} title={d.name} className="preview-iframe" />
            ) : (
              <div className="preview-placeholder">
                <span style={{ fontSize: 48 }}>📄</span>
                <p>{d.name}</p>
                <button className="btn btn-primary" onClick={handleDownload}>Download to View</button>
              </div>
            )}
          </div>

          <div className="viewer-meta">
            {[
              ['Category', d.category],
              ['Sub-Category', d.sub_category],
              ['Author', d.author],
              ['Modified By', d.modified_by],
              ['Size', d.size],
              ['Downloads', d.downloads ?? 0],
              ['Date', d.date ? new Date(d.date).toLocaleDateString() : '—'],
              ['Source', d.source],
            ].map(([label, value]) => (
              <div key={label} className="meta-item">
                <span className="meta-label">{label}</span>
                <span className="meta-value">{value || '—'}</span>
              </div>
            ))}
          </div>

          {d.notes && (
            <div className="viewer-notes">
              <div className="viewer-notes-label">Notes</div>
              <p>{d.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
