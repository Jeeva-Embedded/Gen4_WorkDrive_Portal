import React, { useState } from 'react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const CATS = ['Mechanical', 'Electronics', 'Software']
const SUBS = ['General', 'QC', 'IQC']

export default function DocModal({ doc, onClose, addToast }) {
  const { user } = useAuth()
  const [category, setCategory] = useState(doc.category || 'Mechanical')
  const [subCategory, setSubCategory] = useState(doc.sub_category || 'General')
  const [notes, setNotes] = useState(doc.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await api.documents.update(doc.ROWID, {
        category, sub_category: subCategory, notes,
        modified_by: user?.name || user?.email,
        modified_date: new Date().toISOString(),
      })
      addToast('Document updated', 'success')
      onClose()
    } catch (err) { addToast(err.message, 'error') }
    setSaving(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Document</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="import-filename">📄 {doc.name}</p>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sub-Category</label>
              <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {SUBS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
