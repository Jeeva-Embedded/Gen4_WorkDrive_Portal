import React from 'react'
import { IconMenu2 } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth()

  return (
    <header className="topbar">
      <button className="icon-btn topbar-menu" onClick={onMenuClick}>
        <IconMenu2 size={20} />
      </button>
      <div className="topbar-brand">Gen4 WorkDrive Portal</div>
      <div className="topbar-right">
        <span className="topbar-email">{user?.email || ''}</span>
        <div className="topbar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
      </div>
    </header>
  )
}
