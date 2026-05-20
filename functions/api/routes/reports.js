const express = require('express')
const { authMiddleware, requireRole } = require('../middleware/auth')
const { getDatastore, getWdDownloadTotal } = require('../utils/datastore')

const router = express.Router()
router.use(authMiddleware)
router.use(requireRole('SUPER_ADMIN', 'ADMIN'))

router.get('/', async (req, res) => {
  const { from, to } = req.query
  try {
    const db = getDatastore(req)
    const [docRows, delRows, userRows, wdDelRows, wdDlTotal] = await Promise.all([
      db.zcql().executeZCQLQuery('SELECT * FROM documents ORDER BY uploaded_date DESC'),
      db.zcql().executeZCQLQuery('SELECT * FROM delete_requests ORDER BY created_at DESC'),
      db.zcql().executeZCQLQuery('SELECT * FROM user_roles ORDER BY added_date DESC'),
      db.zcql().executeZCQLQuery('SELECT * FROM wd_delete_requests ORDER BY requested_at DESC'),
      getWdDownloadTotal(),
    ])

    const docs   = (docRows   || []).map(r => r.documents)
    const dels   = (delRows   || []).map(r => r.delete_requests)
    const users  = (userRows  || []).map(r => r.user_roles)
    const wdDels = (wdDelRows || []).map(r => r.wd_delete_requests)

    const activities = []

    // Uploads & modifications
    docs.forEach(d => {
      activities.push({
        date:         d.uploaded_date || '',
        type:         'Upload',
        file_name:    d.name || '',
        category:     d.category || '',
        sub_category: d.sub_category || '',
        size:         d.size || '',
        performed_by: d.author || '',
        reviewed_by:  '',
        status:       'Completed',
        downloads:    d.downloads ?? 0,
        notes:        d.notes || '',
        rowid:        d.ROWID,
      })
      if (d.last_modified && d.last_modified !== d.uploaded_date) {
        activities.push({
          date:         d.last_modified,
          type:         'Modification',
          file_name:    d.name || '',
          category:     d.category || '',
          sub_category: d.sub_category || '',
          size:         d.size || '',
          performed_by: d.modified_by || d.author || '',
          reviewed_by:  '',
          status:       'Completed',
          downloads:    '',
          notes:        '',
          rowid:        d.ROWID + '_mod',
        })
      }
    })

    // Delete requests
    dels.forEach(d => {
      const statusLabel = d.status === 'approved' ? 'Approved' : d.status === 'rejected' ? 'Rejected' : 'Pending'
      activities.push({
        date:         d.created_at || '',
        type:         'Delete Request',
        file_name:    d.doc_name || '',
        category:     '',
        sub_category: '',
        size:         '',
        performed_by: d.requested_by_name || d.requested_by || '',
        reviewed_by:  d.reviewed_by || '',
        status:       statusLabel,
        downloads:    '',
        notes:        d.reviewed_at ? `Reviewed: ${new Date(d.reviewed_at).toLocaleString()}` : '',
        rowid:        d.ROWID,
      })
    })

    // WorkDrive delete requests
    wdDels.forEach(d => {
      const statusLabel = d.status === 'approved' ? 'Approved' : d.status === 'rejected' ? 'Rejected' : 'Pending'
      activities.push({
        date:         d.requested_at || '',
        type:         'Delete Request',
        file_name:    d.file_name || '',
        category:     d.folder_name || '',
        sub_category: 'WorkDrive',
        size:         '',
        performed_by: d.requested_by_name || d.requested_by_email || '',
        reviewed_by:  d.reviewed_by || '',
        status:       statusLabel,
        downloads:    '',
        notes:        d.reviewed_at ? `Reviewed: ${new Date(d.reviewed_at).toLocaleString()}` : '',
        rowid:        'wd_' + d.ROWID,
      })
    })

    // User additions
    users.forEach(u => {
      activities.push({
        date:         u.added_date || '',
        type:         'User Added',
        file_name:    '',
        category:     '',
        sub_category: '',
        size:         '',
        performed_by: u.added_by || 'system',
        reviewed_by:  '',
        status:       u.role,
        downloads:    '',
        notes:        `${u.name || ''} <${u.email}>`,
        rowid:        u.ROWID,
      })
    })

    // Sort newest first
    activities.sort((a, b) => new Date(b.date) - new Date(a.date))

    // Date filter
    let filtered = activities
    if (from) {
      const f = new Date(from)
      f.setHours(0, 0, 0, 0)
      filtered = filtered.filter(a => a.date && new Date(a.date) >= f)
    }
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      filtered = filtered.filter(a => a.date && new Date(a.date) <= t)
    }

    // Summary counts
    const summary = {
      total:         filtered.length,
      uploads:       filtered.filter(a => a.type === 'Upload').length,
      modifications: filtered.filter(a => a.type === 'Modification').length,
      delete_reqs:   filtered.filter(a => a.type === 'Delete Request').length,
      users_added:   filtered.filter(a => a.type === 'User Added').length,
      total_downloads: filtered.filter(a => a.type === 'Upload').reduce((s, a) => s + (parseInt(a.downloads) || 0), 0) + (wdDlTotal || 0),
    }

    res.json({ activities: filtered, summary })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
