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

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'gen4-workdrive-portal' }))

app.use('/api/auth',           authRoutes)
app.use('/api/documents',      documentRoutes)
app.use('/api/upload',         uploadRoutes)
app.use('/api/workdrive',      workdriveRoutes)
app.use('/api/users',          userRoutes)
app.use('/api/categories',     categoryRoutes)
app.use('/api/delete-requests', deleteRequestRoutes)

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
