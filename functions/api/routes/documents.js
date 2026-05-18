const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { deleteFile } = require('../utils/zohoApi')
const { getDatastore } = require('../utils/datastore')

const router = express.Router()
router.use(authMiddleware)

// Roles that can see documents with a given access_role
const ACCESS_MAP = {
  ALL:          ['VIEWER', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'],
  EDITOR_ABOVE: ['EDITOR', 'ADMIN', 'SUPER_ADMIN'],
  ADMIN_ABOVE:  ['ADMIN', 'SUPER_ADMIN'],
  SUPER_ADMIN:  ['SUPER_ADMIN'],
}

function canViewDoc(doc, userRole) {
  const level = doc.access_role || 'ALL'
  return (ACCESS_MAP[level] || ACCESS_MAP.ALL).includes(userRole)
}

router.get('/', async (req, res) => {
  try {
    const db = getDatastore(req)
    const { category, limit = 200 } = req.query
    let query = `SELECT * FROM documents ORDER BY uploaded_date DESC LIMIT ${limit}`
    if (category && category !== 'All') {
      query = `SELECT * FROM documents WHERE category = '${category}' ORDER BY uploaded_date DESC LIMIT ${limit}`
    }
    const rows = await db.zcql().executeZCQLQuery(query)
    const all = (rows || []).map((r) => r.documents)
    const filtered = all.filter((d) => canViewDoc(d, req.user.role))
    res.json({ documents: filtered })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const db = getDatastore(req)
    const row = await db.datastore().table('documents').insertRow({
      data: { ...req.body, uploaded_date: new Date().toISOString() },
    })
    res.json({ document: row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const db = getDatastore(req)
    const row = await db.datastore().table('documents').updateRow({ data: { ROWID: req.params.id, ...req.body } })
    res.json({ document: row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /:id/permissions — admin+ only
router.patch('/:id/permissions', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { access_role } = req.body
  if (!ACCESS_MAP[access_role]) return res.status(400).json({ error: 'Invalid access_role' })
  try {
    const db = getDatastore(req)
    await db.datastore().table('documents').updateRow({ data: { ROWID: req.params.id, access_role } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  const db = getDatastore(req)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)

  if (!isAdmin) {
    // Non-admin: create a delete request instead
    try {
      const docRows = await db.zcql().executeZCQLQuery(`SELECT * FROM documents WHERE ROWID = ${req.params.id} LIMIT 1`)
      const doc = docRows?.[0]?.documents
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      await db.datastore().table('delete_requests').insertRow({
        data: {
          doc_id: req.params.id,
          doc_name: doc.name,
          workdrive_id: doc.workdrive_id || '',
          requested_by: req.user.email,
          requested_by_name: req.user.name,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      })
      return res.json({ success: true, pending: true, message: 'Delete request submitted for admin approval' })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // Admin+: delete directly
  try {
    const rows = await db.zcql().executeZCQLQuery(`SELECT workdrive_id FROM documents WHERE ROWID = ${req.params.id} LIMIT 1`)
    const wdId = rows?.[0]?.documents?.workdrive_id
    await db.datastore().table('documents').deleteRow(req.params.id)
    if (wdId) await deleteFile(wdId).catch((e) => console.warn('WorkDrive delete failed:', e.message))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/download', async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery(`SELECT downloads FROM documents WHERE ROWID = ${req.params.id} LIMIT 1`)
    const current = parseInt(rows?.[0]?.documents?.downloads || 0)
    await db.datastore().table('documents').updateRow({ data: { ROWID: req.params.id, downloads: current + 1 } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
