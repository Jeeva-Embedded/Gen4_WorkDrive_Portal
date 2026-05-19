const axios = require('axios')

// India data center
const ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in'
const WD_BASE      = 'https://workdrive.zoho.in/api/v1'

let cachedToken = null
let tokenExpiry = 0

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken

  const res = await axios.post(`${ACCOUNTS_URL}/oauth/v2/token`, null, {
    params: {
      grant_type:    'refresh_token',
      client_id:     process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    },
  })

  if (!res.data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(res.data))
  cachedToken = res.data.access_token
  tokenExpiry = Date.now() + (res.data.expires_in || 3600) * 1000
  return cachedToken
}

async function zoho(method, url, opts = {}) {
  const token = await getAccessToken()
  return axios({
    method, url, ...opts,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(opts.headers || {}),
    },
  })
}

// Same as zoho() but uses the logged-in user's own token
function zohoAs(userToken, method, url, opts = {}) {
  return axios({
    method, url, ...opts,
    headers: {
      Authorization: `Zoho-oauthtoken ${userToken}`,
      ...(opts.headers || {}),
    },
  })
}

// Verify a user-supplied access token and get their profile
async function verifyUserToken(accessToken) {
  const res = await axios.get(`${ACCOUNTS_URL}/oauth/v2/userinfo`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  return res.data
}

// Exchange auth code for tokens using PKCE
async function exchangeCode(code, codeVerifier, redirectUri) {
  const params = {
    grant_type:    'authorization_code',
    client_id:     process.env.ZOHO_WEB_CLIENT_ID,
    client_secret: process.env.ZOHO_WEB_CLIENT_SECRET,
    redirect_uri:  redirectUri,
    code,
  }
  if (codeVerifier) params.code_verifier = codeVerifier

  const res = await axios.post(`${ACCOUNTS_URL}/oauth/v2/token`, null, { params })
  return res.data
}

async function listFolderFiles(folderId, userToken) {
  const call = userToken
    ? zohoAs(userToken, 'GET', `${WD_BASE}/files/${folderId}/files`)
    : zoho('GET', `${WD_BASE}/files/${folderId}/files`)
  const res = await call
  return res.data?.data || []
}

async function uploadFile(folderId, fileBuffer, fileName, mimeType) {
  const FormData = require('form-data')
  const form = new FormData()
  form.append('content', fileBuffer, { filename: fileName, contentType: mimeType })
  form.append('filename', fileName)
  form.append('parent_id', folderId)
  form.append('override-name-exist', 'true')

  const token = await getAccessToken()
  const res = await axios.post(`${WD_BASE}/upload`, form, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...form.getHeaders(),
    },
  })
  // WorkDrive upload returns { data: [ item ] } — extract first element
  const raw = res.data?.data
  return Array.isArray(raw) ? raw[0] : raw
}

async function createFolder(parentId, name) {
  // WorkDrive creates a folder when only name+parent_id are sent (no is_folder key)
  const res = await zoho('POST', `${WD_BASE}/files`, {
    data: { data: { type: 'files', attributes: { name, parent_id: parentId } } },
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
  return res.data?.data
}

async function copyFile(fileId, targetFolderId) {
  const res = await zoho('POST', `${WD_BASE}/files/${fileId}/copy`, {
    data: { data: { type: 'files', attributes: { parent_id: targetFolderId } } },
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
  return res.data?.data
}

async function deleteFile(fileId) {
  // WorkDrive v1 does not support HTTP DELETE — move to trash via status:51
  await zoho('PATCH', `${WD_BASE}/files/${fileId}`, {
    data: { data: { type: 'files', id: fileId, attributes: { status: 51 } } },
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
}

async function renameFile(fileId, newName) {
  const res = await zoho('PATCH', `${WD_BASE}/files/${fileId}`, {
    data: { data: { type: 'files', id: fileId, attributes: { name: newName } } },
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
  return res.data
}

async function moveFile(fileId, targetFolderId) {
  const res = await zoho('PATCH', `${WD_BASE}/files/${fileId}`, {
    data: { data: { type: 'files', id: fileId, attributes: { parent_id: targetFolderId } } },
    headers: { 'Content-Type': 'application/vnd.api+json' },
  })
  return res.data
}

async function getFileInfo(fileId) {
  const res = await zoho('GET', `${WD_BASE}/files/${fileId}`)
  return res.data?.data
}

async function listTeamFolders(userToken) {
  const teamId = process.env.ZOHO_WORKDRIVE_TEAM_ID
  const call = userToken
    ? zohoAs(userToken, 'GET', `${WD_BASE}/teams/${teamId}/workspaces`)
    : zoho('GET', `${WD_BASE}/teams/${teamId}/workspaces`)
  const res = await call
  return res.data?.data || []
}

module.exports = { getAccessToken, exchangeCode, verifyUserToken, listFolderFiles, uploadFile, deleteFile, renameFile, moveFile, copyFile, getFileInfo, listTeamFolders, createFolder }
