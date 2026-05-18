import React, { useEffect, useState } from 'react'
import { IconPlus, IconPencil, IconTrash, IconMail, IconShield } from '@tabler/icons-react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { ROLES, ROLE_LABELS, ROLE_COLORS } from '../utils/roles'

function RoleBadge({ role }) {
  const s = ROLE_COLORS[role] || ROLE_COLORS.VIEWER
  return (
    <span className="role-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function AddUserModal({ onClose, onAdded, addToast }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState(ROLES.VIEWER)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      await api.users.create({ email: email.trim().toLowerCase(), name: name.trim(), role })
      addToast(`${email} added as ${ROLE_LABELS[role]}`, 'success')
      onAdded()
      onClose()
    } catch (err) {
      addToast(err.message, 'error')
    }
    setSaving(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Team Member</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Zoho Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" required />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <div />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserManagement({ addToast }) {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)

  function load() {
    api.users.list()
      .then((d) => setUsers(d.users || []))
      .catch(() => addToast('Failed to load users', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete(u) {
    if (u.email === me?.email) { addToast("You can't delete yourself", 'error'); return }
    if (!window.confirm(`Remove ${u.email} from the portal?`)) return
    try {
      await api.users.delete(u.ROWID)
      addToast(`${u.email} removed`, 'info')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  async function handleRoleChange(u, newRole) {
    try {
      await api.users.update(u.ROWID, { role: newRole })
      addToast(`${u.email} role updated to ${ROLE_LABELS[newRole]}`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Add Member
        </button>
      </div>

      <div className="info-banner">
        <IconShield size={16} />
        <span>Users log in with their Zoho account. Their role determines what they can access in the portal.</span>
      </div>

      {loading ? <div className="loading-state">Loading…</div> : (
        <div className="table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Added By</th>
                <th>Date Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.ROWID} className="doc-row">
                  <td className="doc-name-cell">
                    <IconMail size={15} style={{ color: 'var(--muted)' }} />
                    <span>{u.email}</span>
                    {u.email === me?.email && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>You</span>}
                  </td>
                  <td>{u.name || '—'}</td>
                  <td>
                    {me?.role === ROLES.SUPER_ADMIN && u.email !== me?.email ? (
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        style={{ ...ROLE_COLORS[u.role] }}
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{u.added_by || '—'}</td>
                  <td>{u.added_date ? new Date(u.added_date).toLocaleDateString() : '—'}</td>
                  <td className="actions-cell">
                    {u.email !== me?.email && me?.role === ROLES.SUPER_ADMIN && (
                      <button className="icon-btn icon-btn-danger" title="Remove" onClick={() => handleDelete(u)}>
                        <IconTrash size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdded={load} addToast={addToast} />}
    </div>
  )
}
