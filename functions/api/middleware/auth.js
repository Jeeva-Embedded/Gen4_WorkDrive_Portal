const { verifyUserToken } = require('../utils/zohoApi')
const { getDatastore } = require('../utils/datastore')

// Cache token → user for 5 min to avoid a Zoho userinfo call on every request
const tokenCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const accessToken = authHeader.slice(7)

  const cached = tokenCache.get(accessToken)
  if (cached && Date.now() < cached.expiresAt) {
    req.user = cached.user
    return next()
  }

  try {
    const profile = await verifyUserToken(accessToken)
    const email = (profile.email || profile.Email || '').toLowerCase()
    if (!email) return res.status(401).json({ error: 'Could not verify Zoho identity' })

    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery(
      `SELECT * FROM user_roles WHERE email = '${email}' LIMIT 1`
    )

    const userRecord = rows?.[0]?.user_roles
    req.user = {
      email,
      name: profile.name || profile.Display_Name || profile.first_name || email.split('@')[0],
      role: userRecord?.role || 'VIEWER',
      rowId: userRecord?.ROWID,
    }

    tokenCache.set(accessToken, { user: req.user, expiresAt: Date.now() + CACHE_TTL })
    next()
  } catch (err) {
    console.error('Auth error:', err.message)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    const allowed = roles.includes('*') || roles.includes(req.user.role)
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' })
    next()
  }
}

module.exports = { authMiddleware, requireRole }
