const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { deleteFile } = require('../utils/zohoApi')
const { getDatastore } = require('../utils/datastore')
const { sendDeleteReviewedEmail } = require('../utils/mailer')

const router = express.Router()
router.use(authMiddleware)

// GET /delete-requests — admin+ sees all pending requests
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery(
      `SELECT * FROM delete_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100`
    )
    res.json({ requests: (rows || []).map((r) => r.delete_requests) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /delete-requests/:id — approve or reject
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { action } = req.body // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })

  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery(
      `SELECT * FROM delete_requests WHERE ROWID = ${req.params.id} LIMIT 1`
    )
    const request = rows?.[0]?.delete_requests
    if (!request) return res.status(404).json({ error: 'Request not found' })

    await db.datastore().table('delete_requests').updateRow({
      data: {
        ROWID: req.params.id,
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: req.user.name,
        reviewed_at: new Date().toISOString(),
      },
    })

    if (action === 'approve') {
      await db.datastore().table('documents').deleteRow(request.doc_id)
      if (request.workdrive_id) {
        await deleteFile(request.workdrive_id).catch((e) => console.warn('WorkDrive delete failed:', e.message))
      }
    }

    sendDeleteReviewedEmail(request.requested_by, request.doc_name, action, req.user.name).catch(() => {})
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
