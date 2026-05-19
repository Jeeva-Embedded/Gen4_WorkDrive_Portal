// Load .env from project root (works locally; on Render env vars are injected directly)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { seedDb } = require('./utils/datastore')
seedDb()
const app = require('./index')

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
