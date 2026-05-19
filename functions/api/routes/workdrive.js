const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { listFolderFiles, listTeamFolders, deleteFile, renameFile, moveFile, copyFile, createFolder } = require('../utils/zohoApi')
const { incrementWdDownload } = require('../utils/datastore')

const router = express.Router()
router.use(authMiddleware)

function zohoError(err) {
  const detail = err.response?.data
  if (detail) return typeof detail === 'object' ? JSON.stringify(detail) : detail
  return err.message
}

// All team workspaces (shown in left panel)
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

// List files/subfolders inside any folder
router.get('/files/:folderId', async (req, res) => {
  try {
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
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: zohoError(err) })
  }
})

// DELETE /workdrive/files/:fileId  (moves to trash via PATCH status:51)
router.delete('/files/:fileId', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await deleteFile(req.params.fileId)
    res.json({ success: true })
  } catch (err) {
    console.error('[workdrive] delete error:', zohoError(err))
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
    console.error('[workdrive] rename error:', zohoError(err))
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
    console.error('[workdrive] move error:', detail)

    // R508 = cross-workspace blocked → try copy then trash original
    if (detail.includes('R508')) {
      try {
        await copyFile(req.params.fileId, folder_id)
        await deleteFile(req.params.fileId).catch(() => {}) // move to trash
        return res.json({ success: true })
      } catch (copyErr) {
        console.error('[workdrive] copy fallback error:', zohoError(copyErr))
        return res.status(500).json({ error: 'Cannot move between workspaces — copy also failed. Please move directly in WorkDrive.' })
      }
    }

    // R510 = no permission on source file
    if (detail.includes('R510')) {
      return res.status(500).json({ error: 'No permission to move this file — it may be owned by another user.' })
    }

    res.status(500).json({ error: detail })
  }
})

// POST /workdrive/track-download
router.post('/track-download', async (req, res) => {
  const { file_id } = req.body
  if (!file_id) return res.status(400).json({ error: 'file_id is required' })
  try {
    const count = incrementWdDownload(file_id)
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
    const folderName = folder?.attributes?.name || name
    res.json({ id, name: folderName })
  } catch (err) {
    console.error('[workdrive] createFolder error:', zohoError(err))
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
