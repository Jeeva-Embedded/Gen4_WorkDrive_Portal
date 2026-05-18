const express = require('express')
const multer = require('multer')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { uploadFile } = require('../utils/zohoApi')
const { getDatastore } = require('../utils/datastore')
const { sendFileUploadedEmail } = require('../utils/mailer')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.use(authMiddleware)
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'EDITOR'))

const ENV_FOLDER_MAP = {
  Mechanical: process.env.ZOHO_FOLDER_MECHANICAL,
  Electronics: process.env.ZOHO_FOLDER_ELECTRONICS,
  Software: process.env.ZOHO_FOLDER_SOFTWARE,
}

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })

  const { category = 'General', subCategory = 'General', description = '', author, folder_id, access_role = 'ALL' } = req.body

  // Use explicit folder_id from request, or env map, or root folder
  const folderId = folder_id || ENV_FOLDER_MAP[category] || process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID

  try {
    const wdFile = await uploadFile(folderId, req.file.buffer, req.file.originalname, req.file.mimetype)
    if (!wdFile) throw new Error('WorkDrive upload returned no data')

    // WorkDrive returns resource_id at top level or inside attributes
    const workdriveId  = wdFile.resource_id || wdFile.id || wdFile.attributes?.resource_id || ''
    const permalink    = wdFile.permalink   || wdFile.attributes?.permalink   || ''
    const downloadUrl  = wdFile.download_url || wdFile.attributes?.download_url || ''

    const now = new Date().toISOString()
    const db = getDatastore(req)
    const doc = await db.datastore().table('documents').insertRow({
      data: {
        name: req.file.originalname,
        workdrive_id: workdriveId,
        url: permalink,
        download_url: downloadUrl,
        category,
        sub_category: subCategory,
        notes: description,
        author: author || req.user.name,
        modified_by: req.user.name,
        size: formatSize(req.file.size),
        uploaded_date: now,
        last_modified: now,
        downloads: 0,
        source: 'upload',
        access_role,
      },
    })

    sendFileUploadedEmail(req.file.originalname, category, req.user.name, req.user.email).catch(() => {})
    res.json({ success: true, document: doc })
  } catch (err) {
    console.error('Upload error:', err.message)
    res.status(500).json({ error: 'Upload failed: ' + err.message })
  }
})

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

module.exports = router
