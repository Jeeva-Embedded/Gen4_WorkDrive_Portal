import React from 'react'
import { IconMenu2 } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '../utils/roles'

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth()
  const role = user?.role || 'VIEWER'
  const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.VIEWER

  return (
    <header className="topbar">
      <button className="icon-btn topbar-menu" onClick={onMenuClick}>
        <IconMenu2 size={20} />
      </button>
      <div className="topbar-brand">Gen4 WorkDrive Portal</div>
      <div className="topbar-right">
        <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}>
          {ROLE_LABELS[role]}
        </span>
        <div className="topbar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
      </div>
    </header>
  )
}
