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

module.exports = { getDatastore }
