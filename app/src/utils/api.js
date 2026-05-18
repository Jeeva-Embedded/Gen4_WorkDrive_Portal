const BASE = '/api'

function getToken() {
  return localStorage.getItem('zd_access_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('zd_access_token')
    localStorage.removeItem('zd_user')
    window.location.href = '/login'
    return
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Auth
export const api = {
  auth: {
    exchangeToken: (code, codeVerifier, redirectUri) =>
      request('/auth/token', {
        method: 'POST',
        body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
      }),
    me: () => request('/auth/me'),
  },

  documents: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/documents${q ? `?${q}` : ''}`)
    },
    create: (data) => request('/documents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
    setPermission: (id, access_role) => request(`/documents/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ access_role }) }),
    incrementDownload: (id) => request(`/documents/${id}/download`, { method: 'POST' }),
  },

  upload: {
    file: (formData) => {
      const token = getToken()
      return fetch(`${BASE}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        return data
      })
    },
  },

  workdrive: {
    folders: () => request('/workdrive/folders'),
    files: (folderId) => request(`/workdrive/files/${folderId}`),
    deleteFile: (fileId) => request(`/workdrive/files/${fileId}`, { method: 'DELETE' }),
    renameFile: (fileId, name) => request(`/workdrive/files/${fileId}/rename`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    moveFile: (fileId, folder_id) => request(`/workdrive/files/${fileId}/move`, { method: 'PATCH', body: JSON.stringify({ folder_id }) }),
    createFolder: (parent_id, name) => request('/workdrive/folders/create', { method: 'POST', body: JSON.stringify({ parent_id, name }) }),
  },

  deleteRequests: {
    list: () => request('/delete-requests'),
    review: (id, action) => request(`/delete-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  },

  categories: {
    list: () => request('/categories'),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },

  users: {
    list: () => request('/users'),
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
}
