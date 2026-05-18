const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { getDatastore } = require('../utils/datastore')
const { sendMemberAddedEmail } = require('../utils/mailer')

const router = express.Router()
router.use(authMiddleware)
router.use(requireRole('SUPER_ADMIN', 'ADMIN'))

router.get('/', async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery('SELECT * FROM user_roles ORDER BY added_date DESC')
    res.json({ users: (rows || []).map((r) => r.user_roles) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { email, name, role } = req.body
  if (!email || !role) return res.status(400).json({ error: 'email and role are required' })

  try {
    const db = getDatastore(req)
    const existing = await db.zcql().executeZCQLQuery(
      `SELECT ROWID FROM user_roles WHERE email = '${email.toLowerCase()}' LIMIT 1`
    )
    if (existing?.length) return res.status(409).json({ error: 'User already exists' })

    const row = await db.datastore().table('user_roles').insertRow({
      data: { email: email.toLowerCase(), name: name || '', role, added_by: req.user.email, added_date: new Date().toISOString() },
    })

    sendMemberAddedEmail(email, name, role, req.user.email).catch(() => {})
    res.json({ user: row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { role } = req.body
  if (!role) return res.status(400).json({ error: 'role is required' })
  try {
    const db = getDatastore(req)
    const row = await db.datastore().table('user_roles').updateRow({ data: { ROWID: req.params.id, role } })
    res.json({ user: row })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const db = getDatastore(req)
    await db.datastore().table('user_roles').deleteRow(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
