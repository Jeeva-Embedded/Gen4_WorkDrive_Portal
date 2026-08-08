# Gen4 WorkDrive Portal

An internal document portal for Gen4 that sits on top of **Zoho WorkDrive**. It gives the team a role-based web UI for browsing, uploading, organizing and requesting deletion of files stored in Zoho WorkDrive team folders, backed by a small Express API and a React (Vite) frontend. Built to deploy on **Zoho Catalyst**, but also runs standalone against a **PostgreSQL** (e.g. Neon) database or a local JSON file for development.

## How it works

```
┌────────────────────┐        ┌──────────────────────┐        ┌───────────────────┐
│  React SPA (app/)   │  REST  │  Express API           │  API   │  Zoho WorkDrive     │
│  Vite + React Router│ ─────► │  (functions/api/)      │ ─────► │  Zoho Accounts (OAuth)│
└────────────────────┘  /api  └──────────────────────┘        └───────────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │ Datastore (pluggable)       │
                          │  • Zoho Catalyst DataStore   │
                          │  • PostgreSQL (DATABASE_URL) │
                          │  • local .local-db.json      │
                          └───────────────────────────┘
```

- **Frontend** (`app/`) — React 18 + Vite + React Router. Talks to the backend only through `/api/*` (proxied to `localhost:3001` in dev by `app/vite.config.js`, served statically by the same Express app in production).
- **Backend** (`functions/api/`) — a single Express app (`functions/api/index.js`) that Zoho Catalyst runs as an "Advanced I/O" function (`functions/api/server.js` is the standalone entry point for local/non-Catalyst runs).
- **Zoho WorkDrive** stores the actual files. The API talks to it with a **Self Client** OAuth app (refresh token, server-to-server) for admin operations like upload/delete/move, and can act with the **logged-in user's own token** for listing folders they can see.
- **Login** uses Zoho's OAuth (Web Based Client) + PKCE from the browser (`app/src/components/Login.jsx` → `AuthCallback.jsx`), the API exchanges the code for tokens and decodes the identity from the returned `id_token`, so no extra profile call is needed on login.
- **Metadata** (documents, users, categories, permissions, delete requests, download logs) lives in a small key/value style datastore layer (`functions/api/utils/datastore.js`) that transparently picks, in order: Zoho Catalyst SDK → PostgreSQL (`DATABASE_URL`) → local JSON file `.local-db.json`. Routes always query it through a tiny SQL-like `zcql().executeZCQLQuery(...)` shim, so the same route code works on Catalyst or Postgres.

## Features

- **Google/Zoho-style OAuth login** — first user to sign in becomes `SUPER_ADMIN` automatically (or via `SUPER_ADMIN_EMAILS`/`SUPER_ADMIN_EMAIL` env vars); everyone after that starts as `VIEWER`.
- **Role-based access control** — 4 roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `VIEWER`, enforced both in the UI (`app/src/utils/roles.js`, `ProtectedRoute.jsx`) and in the API (`requireRole` middleware). Individual documents can also be locked to a minimum role via `access_role`.
- **Document library** (`Documents.jsx`) — portal-managed documents with category/sub-category, notes, author, per-document access level, and download counters.
- **Direct upload to WorkDrive** (`UploadPage.jsx` → `POST /api/upload`) — files are streamed via `multer` straight to a Zoho WorkDrive folder (mapped by category, or an explicit `folder_id`), and the resulting file metadata is recorded as a `documents` row.
- **WorkDrive file browser** (`WorkDriveFiles.jsx`) — browse the real team-workspace folder tree, with per-folder access control (`folder_permissions`), access requests for locked folders, rename/move/copy, folder creation, and download tracking.
- **Delete approval workflow** — non-admins can't delete directly; they raise a delete request (portal documents via `delete_requests`, WorkDrive files via `wd_delete_requests`) that a `SUPER_ADMIN`/`ADMIN` approves or rejects from `DeleteRequests.jsx`, with email notifications either way.
- **Access requests for locked folders** — `MyRequests.jsx` / `WorkDriveFiles.jsx` let a user request access to a restricted folder; approval grants them a per-folder role.
- **User management** (`UserManagement.jsx`) — admins add/remove users and change roles.
- **Model Tree generator** (`ModelTree.jsx`) — generates a folder-structure tree for a chosen WorkDrive folder.
- **Reports & activity log** (`Reports.jsx` → `GET /api/reports`) — merges uploads, modifications, delete requests (portal + WorkDrive), user additions and WorkDrive download events into one filterable activity feed with summary counts.
- **Email notifications** (`functions/api/utils/mailer.js`, SMTP via Zoho Mail) for uploads, delete requests/approvals, access requests/approvals, and new members.
- **Dashboard stats** (`Dashboard.jsx`) — live counts and total downloads across the portal and WorkDrive.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, React Router 6, Vite 5, `@tabler/icons-react` |
| Backend | Node.js 18, Express 4, Multer, Axios, Nodemailer |
| Auth | Zoho OAuth 2.0 (Self Client for API, Web Based Client + PKCE for user login) |
| Storage | Zoho WorkDrive (files) |
| Metadata DB | Zoho Catalyst DataStore, or PostgreSQL (Neon-compatible), or local JSON fallback |
| Hosting | Zoho Catalyst (Advanced I/O function + static web app) |

## Project structure

```
Gen4_workdrive_portal/
├── app/                        # React frontend (Vite)
│   ├── src/
│   │   ├── components/         # Login, Dashboard, Documents, UploadPage, WorkDriveFiles,
│   │   │                       # UserManagement, DeleteRequests, MyRequests, ModelTree, Reports, ...
│   │   ├── context/AuthContext.jsx
│   │   └── utils/{api.js, roles.js}
│   └── vite.config.js          # dev proxy: /api -> http://localhost:3001
├── functions/api/              # Express backend (Catalyst "Advanced I/O" function)
│   ├── index.js                 # app + route wiring
│   ├── server.js                 # standalone local entry point
│   ├── middleware/auth.js        # Zoho token verification + role gate
│   ├── routes/                   # auth, documents, upload, workdrive, users, categories,
│   │                             # delete-requests, reports
│   └── utils/{zohoApi.js, datastore.js, mailer.js}
├── catalyst.json                # Catalyst project/function/web config
├── package.json                  # root build/start scripts
├── .env.example                  # backend env vars
├── app/.env.example               # frontend env vars
└── SETUP.md                       # step-by-step Zoho/Catalyst setup guide
```

## Getting started (local development)

### 1. Prerequisites
- Node.js >= 18
- A Zoho WorkDrive team account and a Zoho API Console project (see [SETUP.md](SETUP.md) for the full click-by-click walkthrough of OAuth credentials, folder IDs, and DataStore tables)

### 2. Configure environment variables

```bash
cp .env.example .env
cp app/.env.example app/.env
```

Fill in `.env` (backend) — key variables:

| Variable | Purpose |
|---|---|
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | Self Client credentials used server-to-server for WorkDrive file operations |
| `ZOHO_WEB_CLIENT_ID` / `ZOHO_WEB_CLIENT_SECRET` / `ZOHO_REDIRECT_URI` | Web Based Client used for user login (PKCE code exchange) |
| `ZOHO_ACCOUNTS_URL` | Zoho accounts domain (defaults to the India DC, `accounts.zoho.in`) |
| `ZOHO_WORKDRIVE_TEAM_ID` / `ZOHO_WORKDRIVE_ROOT_FOLDER_ID` | Target WorkDrive team + default upload folder |
| `ZOHO_FOLDER_MECHANICAL` / `ZOHO_FOLDER_ELECTRONICS` / `ZOHO_FOLDER_SOFTWARE` | Optional per-category upload folders |
| `SUPER_ADMIN_EMAILS` / `SUPER_ADMIN_EMAIL` | Emails that always get `SUPER_ADMIN` (bootstraps a fresh deployment / seeds Postgres) |
| `DATABASE_URL` | Optional Postgres connection string (Neon etc.) — omit to use the local JSON fallback outside Catalyst |
| `FRONTEND_URL` | CORS origin for the API |
| `PORT` | API port (default `3001`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `NOTIFY_EMAILS` | Zoho Mail SMTP for notification emails |

Fill in `app/.env` (frontend):

| Variable | Purpose |
|---|---|
| `VITE_ZOHO_CLIENT_ID` | Same Web Based Client ID used for the OAuth login redirect |
| `VITE_ZOHO_REDIRECT_URI` | Must match a redirect URI registered on the Zoho API Console (`http://localhost:5173/auth/callback` for local dev) |

### 3. Install & run

```bash
# Backend API (http://localhost:3001)
cd functions/api
npm install
node index.js        # or: node server.js (loads .env and inits/seeds the DB first)

# Frontend (http://localhost:5173), in a second terminal
cd app
npm install
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so just open `http://localhost:5173`.

Without `DATABASE_URL` set, the backend automatically falls back to a local `.local-db.json` file at the project root (git-ignored) — handy for running the whole app without any external database.

### 4. Production build

```bash
npm run build     # builds functions/api deps + app, outputs app/dist
npm start          # serves the Express API and the built SPA together
```

### 5. Deploy to Zoho Catalyst

```bash
npm install -g @zohocloud/catalyst-cli
catalyst login
catalyst init        # link to the project defined in catalyst.json
catalyst deploy
```

See [SETUP.md](SETUP.md) for creating the Catalyst project, DataStore tables, and getting Zoho OAuth grant/refresh tokens step by step.

## API overview

All routes are mounted under `/api` and (except `/health`, `/test-email`, and `/auth/token`) require a Zoho access token as `Authorization: Bearer <token>`, verified against Zoho's userinfo endpoint by `authMiddleware`.

| Route | Description |
|---|---|
| `POST /api/auth/token` | Exchange OAuth code (PKCE) for an access token; auto-registers the user |
| `GET /api/auth/me` | Current authenticated user + role |
| `GET /api/documents` | List portal documents (filtered by category and the caller's `access_role`) |
| `POST /api/documents` / `PUT /api/documents/:id` | Create/update a document record |
| `PATCH /api/documents/:id/permissions` | Set a document's minimum viewing role (admin+) |
| `DELETE /api/documents/:id` | Delete (admin+) or raise a delete request (editor/viewer) |
| `POST /api/documents/:id/download` | Increment download counter |
| `POST /api/upload` | Upload a file straight to WorkDrive + record it as a document (editor+) |
| `GET /api/workdrive/folders` | List team workspaces |
| `GET /api/workdrive/files/:folderId` | List files in a folder, with permission + role gating |
| `GET/POST /api/workdrive/permissions/:folderId` | View/set folder access lists (admin+) |
| `GET/POST/PATCH /api/workdrive/access-requests` | Request / approve / reject access to a locked folder |
| `POST/GET/PATCH /api/workdrive/delete-requests`, `DELETE /api/workdrive/files/:fileId` | WorkDrive file delete request workflow |
| `PATCH /api/workdrive/files/:fileId/rename` / `/move` | Rename or move a WorkDrive file |
| `POST /api/workdrive/folders/create` | Create a new WorkDrive folder (admin+) |
| `POST /api/workdrive/track-download` | Log a WorkDrive file download |
| `GET/POST/PUT/DELETE /api/users` | Manage portal users and roles (admin+) |
| `GET/POST/DELETE /api/categories` | Manage document categories |
| `GET/PATCH /api/delete-requests` | Approve/reject portal document delete requests (admin+) |
| `GET /api/reports` | Combined activity feed (uploads, deletes, downloads, user changes) with summary counts (admin+) |
| `GET /api/stats` | Portal + WorkDrive download totals |
| `GET /api/health` | Health check |

## Roles & permissions

| Role | Can do |
|---|---|
| `SUPER_ADMIN` | Everything, including direct WorkDrive file deletion and changing other users' roles |
| `ADMIN` | Upload, edit, manage categories/users (except role changes), approve/reject delete & access requests, view reports |
| `EDITOR` | Upload, edit own documents/files, request deletion |
| `VIEWER` | View documents/files they have access to, request deletion or folder access |

The first user ever to log in (or any email listed in `SUPER_ADMIN_EMAILS`) is bootstrapped as `SUPER_ADMIN`; all subsequent sign-ins default to `VIEWER` until an admin changes their role.
In Render the Profile users details available.Check The electronics Login or Jeeva Render account.
