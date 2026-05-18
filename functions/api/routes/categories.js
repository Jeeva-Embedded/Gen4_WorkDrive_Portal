const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { getDatastore } = require('../utils/datastore')

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery('SELECT * FROM categories ORDER BY name ASC')
    res.json({ categories: (rows || []).map((r) => r.categories) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, folder_id } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  try {
    const db = getDatastore(req)
    const row = await db.datastore().table('categories').insertRow({
      data: { name, folder_id: folder_id || '', created_by: req.user.email, created_date: new Date().toISOString() },
    })
    res.json({ category: row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const db = getDatastore(req)
    await db.datastore().table('categories').deleteRow(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
