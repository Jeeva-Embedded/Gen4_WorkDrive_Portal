/**
 * Run this ONCE to generate a new refresh token with ZohoMail scopes.
 *
 * Steps:
 * 1. Go to https://api-console.zoho.in
 * 2. Open your Self Client
 * 3. Click "Generate Code" tab
 * 4. Paste this in the Scope field:
 *      WorkDrive.workspace.ALL,WorkDrive.files.ALL,WorkDrive.team.READ,ZohoMail.messages.CREATE,ZohoMail.accounts.READ
 * 5. Set duration to "10 minutes", click Create
 * 6. Copy the authorization code shown
 * 7. Run:  node add-mail-scope.js <YOUR_AUTH_CODE>
 *
 * The script will print the new refresh token — paste it into .env as ZOHO_REFRESH_TOKEN
 */

const axios = require('axios')
require('dotenv').config({ path: './.env' })

const code = process.argv[2]
if (!code) { console.error('Usage: node add-mail-scope.js <AUTH_CODE>'); process.exit(1) }

axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
  params: {
    grant_type:    'authorization_code',
    client_id:     process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri:  'https://api-console.zoho.in/v2/oauth/tokenrequest',
    code,
  },
}).then((res) => {
  if (res.data.refresh_token) {
    console.log('\n✅ New refresh token (add to .env as ZOHO_REFRESH_TOKEN):')
    console.log(res.data.refresh_token)
  } else {
    console.error('Token exchange failed:', res.data)
  }
}).catch((e) => console.error('Error:', e.response?.data || e.message))
