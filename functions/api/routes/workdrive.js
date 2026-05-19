const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { listFolderFiles, listTeamFolders, deleteFile, renameFile, moveFile, copyFile, createFolder } = require('../utils/zohoApi')
const { incrementWdDownload, getDatastore } = require('../utils/datastore')
const { sendAccessRequestEmail, sendAccessGrantedEmail } = require('../utils/mailer')

const router = express.Router()
router.use(authMiddleware)

function zohoError(err) {
  const detail = err.response?.data
  if (detail) return typeof detail === 'object' ? JSON.stringify(detail) : detail
  return err.message
}

async function getPermRecord(db, folderId) {
  const rows = await db.zcql().executeZCQLQuery(
    `SELECT * FROM folder_permissions WHERE ROWID = '${folderId}'`
  )
  return rows?.[0]?.folder_permissions || null
}

// Returns true if the user can access the folder
async function canAccessFolder(db, folderId, userEmail, userRole) {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return true
  const perm = await getPermRecord(db, folderId)
  if (!perm || perm.is_open !== false) return true
  const members = perm.members || []
  return members.some(m => m.email?.toLowerCase() === userEmail.toLowerCase())
}

// Returns the user's folder-specific role, or null (= use portal role)
async function getUserFolderRole(db, folderId, userEmail, userRole) {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return null
  const perm = await getPermRecord(db, folderId)
  if (!perm || perm.is_open !== false) return null
  const members = perm.members || []
  const member = members.find(m => m.email?.toLowerCase() === userEmail.toLowerCase())
  return member?.role || 'VIEWER'
}

// All team workspaces — visible to everyone
router.get('/folders', async (req, res) => {
  try {
    const raw = await listTeamFolders()
    const folders = raw.map((f) => ({
      id: f.id,
      name: f.attributes?.name || f.id,
      files_count: f.attributes?.storage_info?.files_count || 0,
      size: f.attributes?.storage_info?.size || '',
    }))
    res.json({ folders })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

// List files — permission check + return folder_role for UI action gating
router.get('/files/:folderId', async (req, res) => {
  const db = getDatastore(req)
  try {
    const allowed = await canAccessFolder(db, req.params.folderId, req.user.email, req.user.role)
    if (!allowed) return res.status(403).json({ error: 'unauthorized', folder_id: req.params.folderId })

    const folderRole = await getUserFolderRole(db, req.params.folderId, req.user.email, req.user.role)

    const raw = await listFolderFiles(req.params.folderId)
    const items = raw.map((f) => ({
      id: f.id,
      name: f.attributes?.display_attr_name || f.attributes?.name || f.id,
      is_folder: f.attributes?.is_folder === true || f.attributes?.type === 'folder',
      type: f.attributes?.type || '',
      size: formatSize(f.attributes?.storage_info?.size_in_bytes),
      modified: f.attributes?.modified_time_in_millisecond
        ? new Date(f.attributes.modified_time_in_millisecond).toLocaleDateString()
        : '—',
      permalink: f.attributes?.permalink || '',
      download_url: f.attributes?.download_url || '',
    }))
    res.json({ items, folder_role: folderRole })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

// GET /workdrive/permissions — all folder permissions (admin+)
router.get('/permissions', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery('SELECT * FROM folder_permissions')
    res.json({ permissions: rows.map(r => r.folder_permissions) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /workdrive/permissions/:folderId — set folder permissions with per-user roles
router.post('/permissions/:folderId', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { folderId } = req.params
  const { folder_name, is_open, members } = req.body
  // members: [{email, role}] where role is 'VIEWER' or 'EDITOR'
  try {
    const db = getDatastore(req)
    const permData = {
      ROWID: folderId,
      folder_id: folderId,
      folder_name: folder_name || folderId,
      is_open: is_open !== false,
      members: (members || []).map(m => ({
        email: m.email.toLowerCase(),
        role: m.role || 'VIEWER',
      })),
      updated_by: req.user.email,
      updated_at: new Date().toISOString(),
    }
    const existing = await getPermRecord(db, folderId)
    if (existing) {
      await db.datastore().table('folder_permissions').updateRow({ data: permData })
    } else {
      await db.datastore().table('folder_permissions').insertRow({ data: permData })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /workdrive/access-requests — admins see all, others see own
router.get('/access-requests', async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery('SELECT * FROM wd_access_requests')
    let reqs = rows.map(r => r.wd_access_requests)
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
      reqs = reqs.filter(r => r.requester_email === req.user.email)
    }
    res.json({ requests: reqs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /workdrive/access-requests — submit request
router.post('/access-requests', async (req, res) => {
  const { folder_id, folder_name } = req.body
  if (!folder_id) return res.status(400).json({ error: 'folder_id required' })
  try {
    const db = getDatastore(req)
    const all = await db.zcql().executeZCQLQuery('SELECT * FROM wd_access_requests')
    const dupe = all.map(r => r.wd_access_requests).find(r =>
      r.folder_id === folder_id && r.requester_email === req.user.email && r.status === 'pending'
    )
    if (dupe) return res.status(409).json({ error: 'You already have a pending request for this folder' })

    const row = await db.datastore().table('wd_access_requests').insertRow({
      data: {
        folder_id,
        folder_name: folder_name || folder_id,
        requester_email: req.user.email,
        requester_name: req.user.name,
        status: 'pending',
        requested_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
      }
    })
    sendAccessRequestEmail(folder_name, req.user.name, req.user.email).catch(() => {})
    res.json({ success: true, id: row.ROWID })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /workdrive/access-requests/:id — approve or reject
router.patch('/access-requests/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { id } = req.params
  const { action } = req.body
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery(`SELECT * FROM wd_access_requests WHERE ROWID = '${id}'`)
    const record = rows?.[0]?.wd_access_requests
    if (!record) return res.status(404).json({ error: 'Request not found' })

    await db.datastore().table('wd_access_requests').updateRow({
      data: {
        ROWID: id,
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: req.user.email,
        reviewed_at: new Date().toISOString(),
      }
    })

    if (action === 'approve') {
      const { folder_id, folder_name, requester_email } = record
      const perm = await getPermRecord(db, folder_id)
      const existing = (perm?.members || []).filter(m => m.email !== requester_email.toLowerCase())
      const members = [...existing, { email: requester_email.toLowerCase(), role: 'VIEWER' }]
      const permData = {
        ROWID: folder_id,
        folder_id,
        folder_name,
        is_open: perm?.is_open !== undefined ? perm.is_open : false,
        members,
        updated_by: req.user.email,
        updated_at: new Date().toISOString(),
      }
      if (perm) {
        await db.datastore().table('folder_permissions').updateRow({ data: permData })
      } else {
        permData.is_open = false
        await db.datastore().table('folder_permissions').insertRow({ data: permData })
      }
      sendAccessGrantedEmail(requester_email, record.requester_name, folder_name).catch(() => {})
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /workdrive/files/:fileId
router.delete('/files/:fileId', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await deleteFile(req.params.fileId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

// PATCH /workdrive/files/:fileId/rename
router.patch('/files/:fileId/rename', requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR'), async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    await renameFile(req.params.fileId, name)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

// PATCH /workdrive/files/:fileId/move
router.patch('/files/:fileId/move', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { folder_id } = req.body
  if (!folder_id) return res.status(400).json({ error: 'folder_id is required' })
  try {
    await moveFile(req.params.fileId, folder_id)
    return res.json({ success: true })
  } catch (err) {
    const detail = zohoError(err)
    if (detail.includes('R508')) {
      try {
        await copyFile(req.params.fileId, folder_id)
        await deleteFile(req.params.fileId).catch(() => {})
        return res.json({ success: true })
      } catch {
        return res.status(500).json({ error: 'Cannot move between workspaces — copy also failed.' })
      }
    }
    if (detail.includes('R510')) return res.status(500).json({ error: 'No permission to move this file.' })
    res.status(500).json({ error: detail })
  }
})

// POST /workdrive/track-download
router.post('/track-download', async (req, res) => {
  const { file_id } = req.body
  if (!file_id) return res.status(400).json({ error: 'file_id is required' })
  try {
    const count = await incrementWdDownload(file_id)
    res.json({ success: true, count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /workdrive/folders/create
router.post('/folders/create', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { parent_id, name } = req.body
  if (!parent_id || !name) return res.status(400).json({ error: 'parent_id and name are required' })
  try {
    const folder = await createFolder(parent_id, name)
    const id = folder?.id || folder?.attributes?.id || folder?.resource_id || ''
    res.json({ id, name: folder?.attributes?.name || name })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

module.exports = router
