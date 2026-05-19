const fs = require('fs')
const path = require('path')

const LOCAL_DB = path.join(__dirname, '../../../.local-db.json')

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB, 'utf8'))
  } catch {
    return { user_roles: [], documents: [], categories: [], delete_requests: [] }
  }
}

function writeDb(db) {
  fs.writeFileSync(LOCAL_DB, JSON.stringify(db, null, 2))
}

function localDatastore() {
  return {
    table(name) {
      return {
        async insertRow({ data }) {
          const db = readDb()
          const row = { ROWID: Date.now().toString(), ...data }
          db[name] = db[name] || []
          db[name].push(row)
          writeDb(db)
          return row
        },
        async updateRow({ data }) {
          const db = readDb()
          db[name] = (db[name] || []).map(r => r.ROWID === data.ROWID ? { ...r, ...data } : r)
          writeDb(db)
          return data
        },
        async deleteRow(rowid) {
          const db = readDb()
          db[name] = (db[name] || []).filter(r => r.ROWID !== String(rowid))
          writeDb(db)
        },
      }
    },
    zcql() {
      return {
        async executeZCQLQuery(query) {
          const db = readDb()
          const fromMatch = query.match(/FROM\s+(\w+)/i)
          if (!fromMatch) return []

          const tableName = fromMatch[1]
          let rows = db[tableName] || []

          // WHERE col = 'val' or WHERE col = numval
          const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/i)
            || query.match(/WHERE\s+(\w+)\s*=\s*(\S+)/i)
          if (whereMatch) {
            const col = whereMatch[1]
            const val = whereMatch[2]
            rows = rows.filter(r => String(r[col] ?? '').toLowerCase() === String(val).toLowerCase())
          }

          // ORDER BY col DESC/ASC — sort in memory
          const orderMatch = query.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i)
          if (orderMatch) {
            const col = orderMatch[1]
            const dir = (orderMatch[2] || 'ASC').toUpperCase()
            rows = [...rows].sort((a, b) => {
              const av = a[col] ?? '', bv = b[col] ?? ''
              return dir === 'DESC' ? (av < bv ? 1 : av > bv ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0)
            })
          }

          // LIMIT
          const limitMatch = query.match(/LIMIT\s+(\d+)/i)
          if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]))

          return rows.map(r => ({ [tableName]: r }))
        },
      }
    },
  }
}

function getDatastore(req) {
  try {
    const catalyst = require('zcatalyst-sdk-node')
    const app = catalyst.initialize(req)
    return { datastore: () => app.datastore(), zcql: () => app.zcql() }
  } catch {
    const local = localDatastore()
    return { datastore: () => local, zcql: () => local.zcql() }
  }
}

function seedDb() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim()
  if (!email) return
  const db = readDb()
  if (!db.user_roles.some((u) => u.email === email)) {
    db.user_roles.push({
      ROWID: Date.now().toString(),
      email,
      name: process.env.SUPER_ADMIN_NAME || email.split('@')[0],
      role: 'SUPER_ADMIN',
      added_by: 'system',
      added_date: new Date().toISOString(),
    })
    console.log(`[db] Seeded super admin: ${email}`)
  }
  const seedJson = process.env.SEED_USERS
  if (seedJson) {
    try {
      const users = JSON.parse(seedJson)
      for (const u of users) {
        if (!u.email) continue
        const ue = u.email.toLowerCase().trim()
        if (!db.user_roles.some((r) => r.email === ue)) {
          db.user_roles.push({
            ROWID: (Date.now() + Math.floor(Math.random() * 9999)).toString(),
            email: ue,
            name: u.name || ue.split('@')[0],
            role: u.role || 'VIEWER',
            added_by: email,
            added_date: new Date().toISOString(),
          })
          console.log(`[db] Seeded user: ${ue}`)
        }
      }
    } catch (e) {
      console.error('[db] Failed to parse SEED_USERS:', e.message)
    }
  }
  writeDb(db)
}

function incrementWdDownload(fileId) {
  const db = readDb()
  if (!db.wd_download_counts) db.wd_download_counts = {}
  db.wd_download_counts[fileId] = (db.wd_download_counts[fileId] || 0) + 1
  writeDb(db)
  return db.wd_download_counts[fileId]
}

function getWdDownloadTotal() {
  const db = readDb()
  return Object.values(db.wd_download_counts || {}).reduce((a, v) => a + v, 0)
}

module.exports = { getDatastore, seedDb, incrementWdDownload, getWdDownloadTotal }
