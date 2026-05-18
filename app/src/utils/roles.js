export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
}

const PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['upload', 'delete', 'view', 'edit', 'manage_categories', 'view_users', 'manage_users'],
  EDITOR: ['upload', 'view', 'edit_own'],
  VIEWER: ['view'],
}

export function can(role, permission) {
  const perms = PERMISSIONS[role] || PERMISSIONS.VIEWER
  return perms.includes('*') || perms.includes(permission)
}

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

export const ROLE_COLORS = {
  SUPER_ADMIN: { bg: '#fdf2f8', color: '#9d174d', border: '#f9a8d4' },
  ADMIN:       { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  EDITOR:      { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  VIEWER:      { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' },
}
