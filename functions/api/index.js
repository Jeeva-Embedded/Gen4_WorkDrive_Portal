const express = require('express')
const cors = require('cors')
const path = require('path')

const authRoutes          = require('./routes/auth')
const documentRoutes      = require('./routes/documents')
const uploadRoutes        = require('./routes/upload')
const workdriveRoutes     = require('./routes/workdrive')
const userRoutes          = require('./routes/users')
const categoryRoutes      = require('./routes/categories')
const deleteRequestRoutes = require('./routes/delete-requests')
const reportRoutes        = require('./routes/reports')

const { getDatastore, getWdDownloadTotal } = require('./utils/datastore')
const { authMiddleware } = require('./middleware/auth')
const { testSmtp } = require('./utils/mailer')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'gen4-workdrive-portal' }))

app.get('/api/test-email', async (req, res) => {
  const guard = setTimeout(() => {
    if (!res.headersSent) res.status(408).json({ success: false, error: 'SMTP connection timed out — check credentials and SMTP access in Zoho Mail settings.' })
  }, 12000)
  try {
    const result = await testSmtp()
    clearTimeout(guard)
    if (!res.headersSent) res.json({ success: true, ...result, smtp_user: process.env.SMTP_USER, to: process.env.NOTIFY_EMAILS })
  } catch (err) {
    clearTimeout(guard)
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message, smtp_user: process.env.SMTP_USER || '(not set)' })
  }
})

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const db = getDatastore(req)
    const rows = await db.zcql().executeZCQLQuery('SELECT * FROM documents')
    const portalDl = (rows || []).reduce((a, r) => a + (parseInt(r.documents?.downloads) || 0), 0)
    const wdDl = await getWdDownloadTotal()
    res.json({ total_downloads: portalDl + wdDl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.use('/api/auth',           authRoutes)
app.use('/api/documents',      documentRoutes)
app.use('/api/upload',         uploadRoutes)
app.use('/api/workdrive',      workdriveRoutes)
app.use('/api/users',          userRoutes)
app.use('/api/categories',     categoryRoutes)
app.use('/api/delete-requests', deleteRequestRoutes)
app.use('/api/reports',        reportRoutes)

app.use((err, req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// Serve built React app in production
const DIST = path.join(__dirname, '../../app/dist')
if (require('fs').existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

module.exports = app
