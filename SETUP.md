# Gen4 WorkDrive Portal — Setup Guide

## Step 1: Zoho OAuth Credentials

1. Go to https://api-console.zoho.com
2. Click **Add Client** → **Self Client**
3. Click **Create** — you get **Client ID** and **Client Secret**
4. Click **Generate Code** tab:
   - Scope: `WorkDrive.files.ALL,WorkDrive.workspace.ALL,WorkDrive.team.ALL,AaaServer.profile.READ`
   - Time Duration: 10 minutes
   - Click **Create** → copy the **Grant Token**
5. Run this in browser or Postman to get Refresh Token:
   POST https://accounts.zoho.com/oauth/v2/token
   Body (form):
     grant_type=authorization_code
     client_id=YOUR_CLIENT_ID
     client_secret=YOUR_CLIENT_SECRET
     code=YOUR_GRANT_TOKEN
     redirect_uri=https://catalyst.zoho.com (for self client)

## Step 2: Zoho WorkDrive — Get Folder IDs

1. Open https://workdrive.zoho.com
2. Open your team workspace
3. The URL will show: workdrive.zoho.com/home/teams/TEAM_ID/ws/...
4. Copy the TEAM_ID
5. For each category folder, open it and copy the folder ID from the URL

## Step 3: Zoho Catalyst Project

1. Go to https://catalyst.zoho.com → Create Project → name it "gen4-workdrive-portal"
2. Note the Project ID
3. Install CLI: npm install -g @zohocloud/catalyst-cli
4. In this folder: catalyst login
5. Then: catalyst init → select your project

## Step 4: Create Catalyst DataStore Tables

In Catalyst Console → DataStore → Create these tables:

### documents
| Column | Type |
|--------|------|
| name | Text |
| workdrive_id | Text |
| url | Text |
| download_url | Text |
| category | Text |
| sub_category | Text |
| notes | Text |
| author | Text |
| modified_by | Text |
| size | Text |
| date | Text |
| modified_date | Text |
| downloads | Number |
| source | Text |

### user_roles
| Column | Type |
|--------|------|
| email | Text |
| name | Text |
| role | Text |
| added_by | Text |
| added_date | Text |

### categories
| Column | Type |
|--------|------|
| name | Text |
| created_by | Text |
| created_date | Text |

## Step 5: Environment Variables

Copy .env.example to .env in root and fill in:
- ZOHO_CLIENT_ID
- ZOHO_CLIENT_SECRET
- ZOHO_REFRESH_TOKEN
- ZOHO_WORKDRIVE_TEAM_ID
- ZOHO_WORKDRIVE_ROOT_FOLDER_ID
- ZOHO_FOLDER_MECHANICAL (optional, separate folder per category)
- ZOHO_FOLDER_ELECTRONICS
- ZOHO_FOLDER_SOFTWARE
- FRONTEND_URL=https://your-catalyst-app.com

Copy app/.env.example to app/.env and fill in:
- VITE_ZOHO_CLIENT_ID (same Client ID)
- VITE_ZOHO_REDIRECT_URI (your Catalyst app URL + /auth/callback)

## Step 6: Install & Run Locally

  cd app && npm install && npm run dev

For functions locally:
  cd functions/api && npm install && node index.js

## Step 7: Deploy to Catalyst

  npm run build (in app folder)
  catalyst deploy
