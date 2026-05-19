const nodemailer = require('nodemailer')

let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.in',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: parseInt(process.env.SMTP_PORT) !== 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return _transporter
}

async function sendMail(to, subject, htmlContent) {
  const from = process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP credentials not set — skipping email')
    return
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"Gen4 Portal" <${from}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html: htmlContent,
    })
    console.log(`[mailer] sent "${subject}" → ${to} (${info.messageId})`)
  } catch (err) {
    console.warn('[mailer] SMTP send failed:', err.message)
  }
}

async function sendMemberAddedEmail(email, name, role, addedBy) {
  const subject = 'You have been added to Gen4 WorkDrive Portal'
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:#1a2733">Welcome, ${name || email}!</h2>
        <p style="color:#5d6b7a;margin-top:8px">You have been added to the Gen4 WorkDrive Portal with the role <strong>${role}</strong>.</p>
        <p style="color:#5d6b7a;margin-top:8px">Added by: <strong>${addedBy}</strong></p>
        <p style="color:#5d6b7a;margin-top:16px">Log in with your Zoho account to access company documents.</p>
        <a href="${process.env.FRONTEND_URL || '#'}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#7dba3a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
      </div>
    </div>`
  return sendMail(email, subject, html)
}

async function sendFileUploadedEmail(fileName, category, uploaderName, uploaderEmail) {
  const adminEmails = process.env.NOTIFY_EMAILS
  if (!adminEmails) return
  const subject = `New file uploaded: ${fileName}`
  const html = `
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
        <a href="${process.env.FRONTEND_URL || '#'}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#7dba3a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View Portal</a>
      </div>
    </div>`
  return sendMail(adminEmails, subject, html)
}

async function sendDeleteRequestEmail(docName, requestedByName, requestedByEmail) {
  const adminEmails = process.env.NOTIFY_EMAILS
  if (!adminEmails) return
  const subject = `Delete Request: "${docName}"`
  const portalUrl = process.env.FRONTEND_URL || '#'
  const html = `
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
        <p style="color:#5d6b7a;margin-top:16px">Please review and approve or reject this request in the portal.</p>
        <a href="${portalUrl}/delete-requests" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#c0392b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Review Request</a>
      </div>
    </div>`
  return sendMail(adminEmails, subject, html)
}

async function sendDeleteReviewedEmail(toEmail, docName, action, reviewedBy) {
  const approved = action === 'approve'
  const subject = `Delete Request ${approved ? 'Approved' : 'Rejected'}: "${docName}"`
  const portalUrl = process.env.FRONTEND_URL || '#'
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto">
      <div style="background:#1a5276;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <div style="color:#fff;font-size:24px;font-weight:800">G4</div>
        <div style="color:#a9d46e;font-size:14px">Gen4 Manufacturing WorkDrive Portal</div>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde3ea;border-radius:0 0 12px 12px">
        <h2 style="color:${approved ? '#15803d' : '#c0392b'}">${approved ? '✅ Delete Request Approved' : '❌ Delete Request Rejected'}</h2>
        <table style="margin-top:16px;width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#5d6b7a">File</td><td style="font-weight:600">${docName}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Status</td><td style="font-weight:600;color:${approved ? '#15803d' : '#c0392b'}">${approved ? 'Approved & Deleted' : 'Rejected'}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Reviewed by</td><td>${reviewedBy}</td></tr>
          <tr><td style="padding:6px 0;color:#5d6b7a">Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="${portalUrl}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#1a5276;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
      </div>
    </div>`
  return sendMail(toEmail, subject, html)
}

module.exports = { sendMemberAddedEmail, sendFileUploadedEmail, sendDeleteRequestEmail, sendDeleteReviewedEmail }
