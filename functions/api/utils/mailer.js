const axios = require('axios')

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

function getSender() {
  return { name: 'Gen4 Portal', email: process.env.SMTP_USER || process.env.NOTIFICATION_EMAIL }
}

async function sendMail(to, subject, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.warn('[mailer] BREVO_API_KEY not set — skipping email')
    return
  }
  const toArr = (Array.isArray(to) ? to : String(to).split(',').map(e => e.trim()))
    .filter(Boolean)
    .map(email => ({ email }))

  try {
    const res = await axios.post(BREVO_URL, {
      sender: getSender(),
      to: toArr,
      subject,
      htmlContent,
    }, {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 10000,
    })
    console.log(`[mailer] ✓ sent "${subject}" → ${to} (${res.data?.messageId || 'ok'})`)
  } catch (err) {
    const detail = err.response?.data?.message || err.message
    console.error(`[mailer] ✗ Brevo failed for "${subject}": ${detail}`)
  }
}

async function testSmtp() {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY not set in environment variables')

  const to   = process.env.NOTIFY_EMAILS || process.env.SMTP_USER
  const from = getSender()

  const res = await axios.post(BREVO_URL, {
    sender: from,
    to: [{ email: to }],
    subject: 'Gen4 Portal — Email Test ✅',
    htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:20px;border-radius:10px 10px 0 0;text-align:center">
        <div style="color:#fff;font-size:22px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:13px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:20px;border:1px solid #dde3ea;border-radius:0 0 10px 10px">
        <h2 style="color:#15803d">✅ Email notifications are working!</h2>
        <p style="color:#5d6b7a">Sent via Brevo from <strong>${from.email}</strong> at ${new Date().toLocaleString()}</p>
      </div>
    </div>`,
  }, {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    timeout: 10000,
  })

  return { messageId: res.data?.messageId, to, from: from.email }
}

async function sendMemberAddedEmail(email, name, role, addedBy) {
  const portalUrl = process.env.FRONTEND_URL || 'https://gen4-workdrive-portal.onrender.com'
  return sendMail(email, 'You have been added to Gen4 WorkDrive Portal', `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:#1a2733">Welcome, ${name || email}!</h2>
        <p style="color:#5d6b7a;margin-top:8px">You have been added with the role <strong>${role}</strong>.</p>
        <p style="color:#5d6b7a;margin-top:8px">Added by: <strong>${addedBy}</strong></p>
        <a href="${portalUrl}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#7dba3a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
      </div>
    </div>`)
}

async function sendFileUploadedEmail(fileName, category, uploaderName, uploaderEmail) {
  const adminEmails = process.env.NOTIFY_EMAILS
  if (!adminEmails) return
  const portalUrl = process.env.FRONTEND_URL || 'https://gen4-workdrive-portal.onrender.com'
  return sendMail(adminEmails, `New file uploaded: ${fileName}`, `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:#1a2733">New File Uploaded</h2>
        <table style="margin-top:16px;width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#5d6b7a">File</td><td style="font-weight:600">${fileName}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Category</td><td>${category}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Uploaded by</td><td>${uploaderName} (${uploaderEmail})</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="${portalUrl}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#7dba3a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View Portal</a>
      </div>
    </div>`)
}

async function sendDeleteRequestEmail(docName, requestedByName, requestedByEmail) {
  const adminEmails = process.env.NOTIFY_EMAILS
  if (!adminEmails) return
  const portalUrl = process.env.FRONTEND_URL || 'https://gen4-workdrive-portal.onrender.com'
  return sendMail(adminEmails, `Delete Request: "${docName}"`, `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:#c0392b">⚠ Delete Request Submitted</h2>
        <table style="margin-top:16px;width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#5d6b7a">File</td><td style="font-weight:600">${docName}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Requested by</td><td>${requestedByName} (${requestedByEmail})</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="${portalUrl}/delete-requests" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c0392b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Review Request</a>
      </div>
    </div>`)
}

async function sendDeleteReviewedEmail(toEmail, docName, action, reviewedBy) {
  const approved = action === 'approve'
  const portalUrl = process.env.FRONTEND_URL || 'https://gen4-workdrive-portal.onrender.com'
  return sendMail(toEmail, `Delete Request ${approved ? 'Approved' : 'Rejected'}: "${docName}"`, `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:${approved ? '#15803d' : '#c0392b'}">${approved ? '✅ Delete Approved' : '❌ Delete Rejected'}</h2>
        <table style="margin-top:16px;width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#5d6b7a">File</td><td style="font-weight:600">${docName}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Status</td><td style="font-weight:600;color:${approved ? '#15803d' : '#c0392b'}">${approved ? 'Approved & Deleted' : 'Rejected'}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Reviewed by</td><td>${reviewedBy}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="${portalUrl}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#1a5276;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
      </div>
    </div>`)
}

module.exports = { sendMemberAddedEmail, sendFileUploadedEmail, sendDeleteRequestEmail, sendDeleteReviewedEmail, testSmtp }
