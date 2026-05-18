const express = require('express')
const { exchangeCode } = require('../utils/zohoApi')
const { authMiddleware } = require('../middleware/auth')
const { getDatastore } = require('../utils/datastore')

const router = express.Router()

function decodeIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return {}
  }
}

// POST /auth/token — exchange OAuth code for access token, auto-register user
router.post('/token', async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body
  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const tokens = await exchangeCode(code, code_verifier, redirect_uri)
    if (!tokens.access_token) {
      return res.status(400).json({ error: 'Token exchange failed: ' + JSON.stringify(tokens) })
    }

    // Extract user info from id_token JWT (no extra API call needed)
    const profile = decodeIdToken(tokens.id_token || '')
    const email = (profile.email || '').toLowerCase()
    if (!email) return res.status(400).json({ error: 'Could not get user email from token' })

    const name = profile.name || profile.first_name || email.split('@')[0]

    const db = getDatastore(req)
    const zcql = db.zcql()

    const existing = await zcql.executeZCQLQuery(
      `SELECT * FROM user_roles WHERE email = '${email}' LIMIT 1`
    )

    let role = 'VIEWER'
    if (!existing?.length) {
      const allUsers = await zcql.executeZCQLQuery('SELECT ROWID FROM user_roles LIMIT 1')
      role = allUsers?.length ? 'VIEWER' : 'SUPER_ADMIN'

      const table = db.datastore().table('user_roles')
      await table.insertRow({
        data: {
          email,
          name,
          role,
          added_by: role === 'SUPER_ADMIN' ? 'system' : 'auto',
          added_date: new Date().toISOString(),
        },
      })
    } else {
      role = existing[0].user_roles?.role || 'VIEWER'
    }

    res.json({ user: { email, name, role }, access_token: tokens.access_token })
  } catch (err) {
    console.error('Token exchange error:', err.message)
    res.status(500).json({ error: 'Authentication failed: ' + err.message })
  }
})

// GET /auth/me — get current user info
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

module.exports = router
