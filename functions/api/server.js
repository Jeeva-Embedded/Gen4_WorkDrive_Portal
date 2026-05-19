require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { initDb, seedDb } = require('./utils/datastore')
const app = require('./index')

const PORT = process.env.PORT || 3001

// Init DB schema then seed, then start server
initDb()
  .then(() => seedDb())
  .catch(console.error)
  .finally(() => {
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
  })
