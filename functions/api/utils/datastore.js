const fs   = require('fs')
const path = require('path')

// ── LOCAL JSON FALLBACK (dev / no DATABASE_URL) ──────────────────────────────
const LOCAL_DB = path.join(__dirname, '../../../.local-db.json')

function readDb() {
  try { return JSON.parse(fs.readFileSync(LOCAL_DB, 'utf8')) }
  catch { return { user_roles: [], documents: [], categories: [], delete_requests: [] } }
}
function writeDb(db) { fs.writeFileSync(LOCAL_DB, JSON.stringify(db, null, 2)) }

function applyZcqlFilters(rows, query, tableName) {
  const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/i)
    || query.match(/WHERE\s+(\w+)\s*=\s*(\S+)/i)
  if (whereMatch) {
    const col = whereMatch[1], val = whereMatch[2]
    rows = rows.filter(r => String(r[col] ?? '').toLowerCase() === String(val).toLowerCase())
  }
  const orderMatch = query.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i)
  if (orderMatch) {
    const col = orderMatch[1], dir = (orderMatch[2] || 'ASC').toUpperCase()
    rows = [...rows].sort((a, b) => {
      const av = a[col] ?? '', bv = b[col] ?? ''
      return dir === 'DESC' ? (av < bv ? 1 : av > bv ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0)
    })
  }
  const limitMatch = query.match(/LIMIT\s+(\d+)/i)
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]))
  return rows.map(r => ({ [tableName]: r }))
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
          return applyZcqlFilters(db[tableName] || [], query, tableName)
        },
      }
    },
  }
}

// ── POSTGRESQL (Neon) ─────────────────────────────────────────────────────────
let _pool = null

function getPool() {
  if (!_pool) {
    const { Pool } = require('pg')
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return _pool
}

async function initDb() {
  if (!process.env.DATABASE_URL) return
  const client = await getPool().connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS kv_store (
        collection TEXT NOT NULL,
        row_id     TEXT NOT NULL,
        data       JSONB NOT NULL,
        PRIMARY KEY (collection, row_id)
      )
    `)
    console.log('[db] PostgreSQL schema ready')
  } finally {
    client.release()
  }
}

function pgDatastore() {
  const pool = getPool()

  async function getRows(collection) {
    const res = await pool.query('SELECT data FROM kv_store WHERE collection = $1', [collection])
    return res.rows.map(r => r.data)
  }

  return {
    table(collection) {
      return {
        async insertRow({ data }) {
          const row = { ROWID: Date.now().toString(), ...data }
          await pool.query(
            'INSERT INTO kv_store (collection, row_id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [collection, row.ROWID, JSON.stringify(row)]
          )
          return row
        },
        async updateRow({ data }) {
          await pool.query(
            'UPDATE kv_store SET data = data || $1::jsonb WHERE collection = $2 AND row_id = $3',
            [JSON.stringify(data), collection, data.ROWID]
          )
          return data
        },
        async deleteRow(rowid) {
          await pool.query(
            'DELETE FROM kv_store WHERE collection = $1 AND row_id = $2',
            [collection, String(rowid)]
          )
        },
      }
    },
    zcql() {
      return {
        async executeZCQLQuery(query) {
          const fromMatch = query.match(/FROM\s+(\w+)/i)
          if (!fromMatch) return []
          const tableName = fromMatch[1]
          const rows = await getRows(tableName)
          return applyZcqlFilters(rows, query, tableName)
        },
      }
    },
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
function getDatastore(req) {
  // Try Zoho Catalyst SDK (when running on Catalyst hosting)
  try {
    const catalyst = require('zcatalyst-sdk-node')
    const app = catalyst.initialize(req)
    return { datastore: () => app.datastore(), zcql: () => app.zcql() }
  } catch {}

  // PostgreSQL via DATABASE_URL (Neon / any Postgres)
  if (process.env.DATABASE_URL) {
    const pg = pgDatastore()
    return { datastore: () => pg, zcql: () => pg.zcql() }
  }

  // Local JSON file (development fallback)
  const local = localDatastore()
  return { datastore: () => local, zcql: () => local.zcql() }
}

async function seedDb() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim()
  if (!email) return

  if (process.env.DATABASE_URL) {
    const pool = getPool()
    const upsertUser = async (u) => {
      const exists = await pool.query(
        "SELECT row_id FROM kv_store WHERE collection = 'user_roles' AND data->>'email' = $1 LIMIT 1",
        [u.email]
      )
      if (exists.rows.length === 0) {
        const row = { ROWID: Date.now().toString() + Math.random(), ...u }
        await pool.query(
          'INSERT INTO kv_store (collection, row_id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          ['user_roles', row.ROWID, JSON.stringify(row)]
        )
        console.log(`[db] Seeded: ${u.email}`)
      }
    }
    await upsertUser({
      email,
      name: process.env.SUPER_ADMIN_NAME || email.split('@')[0],
      role: 'SUPER_ADMIN',
      added_by: 'system',
      added_date: new Date().toISOString(),
    })
    if (process.env.SEED_USERS) {
      try {
        for (const u of JSON.parse(process.env.SEED_USERS)) {
          if (u.email) await upsertUser({ ...u, email: u.email.toLowerCase().trim(), added_by: email, added_date: new Date().toISOString() })
        }
      } catch (e) { console.error('[db] SEED_USERS parse error:', e.message) }
    }
    return
  }

  // Local JSON seed
  const db = readDb()
  const add = (u) => { if (!db.user_roles.some(r => r.email === u.email)) { db.user_roles.push({ ROWID: Date.now().toString(), ...u }); console.log(`[db] Seeded: ${u.email}`) } }
  add({ email, name: process.env.SUPER_ADMIN_NAME || email.split('@')[0], role: 'SUPER_ADMIN', added_by: 'system', added_date: new Date().toISOString() })
  if (process.env.SEED_USERS) {
    try { for (const u of JSON.parse(process.env.SEED_USERS)) { if (u.email) add({ ...u, email: u.email.toLowerCase().trim(), added_by: email, added_date: new Date().toISOString() }) } }
    catch (e) { console.error('[db] SEED_USERS parse error:', e.message) }
  }
  writeDb(db)
}

async function incrementWdDownload(fileId) {
  if (process.env.DATABASE_URL) {
    const pool = getPool()
    const existing = await pool.query(
      "SELECT data FROM kv_store WHERE collection = 'wd_downloads' AND row_id = $1 LIMIT 1",
      [fileId]
    )
    if (existing.rows.length > 0) {
      const current = parseInt(existing.rows[0].data.count || 0)
      const newCount = current + 1
      await pool.query(
        "UPDATE kv_store SET data = data || jsonb_build_object('count', $1::int) WHERE collection = 'wd_downloads' AND row_id = $2",
        [newCount, fileId]
      )
      return newCount
    } else {
      await pool.query(
        'INSERT INTO kv_store (collection, row_id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        ['wd_downloads', fileId, JSON.stringify({ file_id: fileId, count: 1 })]
      )
      return 1
    }
  }
  const db = readDb()
  if (!db.wd_download_counts) db.wd_download_counts = {}
  db.wd_download_counts[fileId] = (db.wd_download_counts[fileId] || 0) + 1
  writeDb(db)
  return db.wd_download_counts[fileId]
}

async function getWdDownloadTotal() {
  if (process.env.DATABASE_URL) {
    const pool = getPool()
    const res = await pool.query(
      "SELECT COALESCE(SUM((data->>'count')::int), 0) AS total FROM kv_store WHERE collection = 'wd_downloads'"
    )
    return parseInt(res.rows[0]?.total || 0)
  }
  const db = readDb()
  return Object.values(db.wd_download_counts || {}).reduce((a, v) => a + v, 0)
}

async function logWdDownload({ file_id, file_name, folder_name, downloaded_by, downloaded_by_name }) {
  const rowId = `dl_${Date.now()}_${file_id}`
  const data = JSON.stringify({
    file_id, file_name, folder_name,
    downloaded_by, downloaded_by_name,
    downloaded_at: new Date().toISOString(),
  })
  if (process.env.DATABASE_URL) {
    const pool = getPool()
    await pool.query(
      'INSERT INTO kv_store (collection, row_id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      ['wd_download_logs', rowId, data]
    )
    return
  }
  const db = readDb()
  if (!db.wd_download_logs) db.wd_download_logs = []
  db.wd_download_logs.push({ row_id: rowId, data: JSON.parse(data) })
  writeDb(db)
}

async function getWdDownloadLogs() {
  if (process.env.DATABASE_URL) {
    const pool = getPool()
    const res = await pool.query(
      "SELECT data FROM kv_store WHERE collection = 'wd_download_logs' ORDER BY (data->>'downloaded_at') DESC"
    )
    return res.rows.map(r => r.data)
  }
  const db = readDb()
  return (db.wd_download_logs || []).map(r => r.data).sort((a, b) => new Date(b.downloaded_at) - new Date(a.downloaded_at))
}

module.exports = { getDatastore, initDb, seedDb, incrementWdDownload, getWdDownloadTotal, logWdDownload, getWdDownloadLogs }
