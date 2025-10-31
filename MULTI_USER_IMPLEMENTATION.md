# Multi-User Implementation Guide

This document describes the multi-user authentication and Foursquare API integration features implemented for the Swarm Visualizer.

## Overview

The app now supports:
- **Foursquare OAuth authentication** - Users connect their Foursquare account once to import data
- **Magic link authentication** - Users access their data via a secure token URL (no password required)
- **Automatic data import** - Check-ins are fetched directly from Foursquare API
- **Background job processing** - Import happens asynchronously with progress tracking
- **Multi-user isolation** - Each user only sees their own check-ins
- **Weekly sync capability** - Infrastructure ready for periodic data refreshes

## Architecture

### Database Schema

**users table:**
- `id` - Primary key
- `foursquare_user_id` - Unique Foursquare user ID
- `display_name` - User's name
- `avatar_url` - Profile photo URL
- `access_token_encrypted` - Encrypted OAuth access token
- `secret_token` - Unique 64-char token for magic link auth
- `last_sync_at` - Timestamp of last successful import
- `created_at`, `updated_at` - Audit timestamps

**import_jobs table:**
- `id` - Primary key
- `user_id` - Foreign key to users
- `status` - 'pending', 'running', 'completed', 'failed'
- `total_expected` - Expected number of check-ins
- `total_imported` - Number successfully imported
- `current_batch` - Current batch number
- `error_message` - Error details if failed
- `started_at`, `completed_at`, `created_at` - Timestamps

**checkins table (modified):**
- Added `user_id` column (foreign key to users)
- All existing columns remain the same

### Backend Services

#### 1. **Encryption Service** (`server/services/encryption.js`)
- Encrypts/decrypts OAuth access tokens using AES-256-GCM
- Uses environment variable `ENCRYPTION_KEY` (auto-generated from DATABASE_URL if not set)

#### 2. **Foursquare API Service** (`server/services/foursquare.js`)
- `fetchCheckins(accessToken, options)` - Fetches check-ins in batches of 100
- `getUserProfile(accessToken)` - Gets user profile data
- `transformCheckin(checkin, userId)` - Converts Foursquare format to our schema
- Handles rate limiting (500 requests/hour)
- Supports incremental sync via `afterTimestamp` parameter

#### 3. **Job Queue** (`server/jobs/queue.js`)
- Uses pg-boss (PostgreSQL-based job queue)
- No Redis dependency
- Handles job lifecycle (queue, process, complete/fail)
- Graceful shutdown support

#### 4. **Import Job Handler** (`server/jobs/importCheckins.js`)
- Background worker that processes import jobs
- Fetches check-ins from Foursquare
- Inserts to database in batches of 1000
- Updates job progress in real-time
- Handles duplicates gracefully

### Backend Routes

#### Authentication Routes (`/api/auth/*`)

**GET /api/auth/login**
- Redirects to Foursquare OAuth page

**GET /api/auth/callback**
- Handles OAuth callback
- Exchanges code for access token
- Creates or updates user
- Redirects to frontend with magic link token

**GET /api/auth/me?token=xxx**
- Returns current user info for a magic link token

#### Import Routes (`/api/import/*`)

**POST /api/import/start?token=xxx**
- Starts a new import job for authenticated user
- Queues background job
- Returns job ID

**GET /api/import/status/:jobId?token=xxx**
- Gets current status of an import job
- Returns progress, total imported, errors

**GET /api/import/latest?token=xxx**
- Gets the latest import job for the user

#### Data Routes (Modified)

**GET /api/checkins?token=xxx**
- If token provided, returns only that user's check-ins
- If no token, returns all check-ins (backward compatible)

**GET /api/stats?token=xxx**
- If token provided, returns stats for that user only
- If no token, returns stats for all data

### Frontend

#### Pages

**ImportPage** (`/import`)
- Login page (if no token) with "Connect with Foursquare" button
- Import interface (if token present) showing:
  - User info and last sync time
  - Current import job status and progress
  - Start/refresh import button
  - Magic link URL for bookmarking

**HomePage** (`/`)
- Existing map view
- Now supports `?token=xxx` query parameter
- Automatically filters data to authenticated user if token present
- Stores token in localStorage for persistence

## Setup Instructions

### 1. Environment Configuration

Update `.env` file with Foursquare credentials:

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/swarm_visualizer
PORT=3001
NODE_ENV=development

# Foursquare OAuth
FOURSQUARE_CLIENT_ID=your_client_id_here
FOURSQUARE_CLIENT_SECRET=your_client_secret_here
FOURSQUARE_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Encryption (optional - auto-generated if not set)
ENCRYPTION_KEY=
```

### 2. Get Foursquare OAuth Credentials

1. Go to https://foursquare.com/developers/apps
2. Create a new app or use existing
3. Set redirect URI to `http://localhost:3001/api/auth/callback`
4. Copy Client ID and Client Secret to `.env`

### 3. Run Database Migration

The migration has already been run, but for reference:

```bash
node server/db/run-migration.js migrations/001_add_multi_user_support.sql
```

### 4. Start the Server

```bash
cd server
npm install  # Already done
npm run dev
```

The server will:
- Initialize pg-boss job queue
- Register import job worker
- Start Express server on port 3001

### 5. Start the Frontend

```bash
cd client
npm install  # Already done if needed
npm start
```

Frontend runs on port 3000.

## User Flow

### First-Time User

1. User visits `http://localhost:3000/import`
2. Clicks "Connect with Foursquare"
3. Redirected to Foursquare OAuth page
4. Authorizes app
5. Redirected back to `/import?token=xxxxx`
6. Clicks "Start Import"
7. Watches progress bar as check-ins are imported
8. Clicks "View My Data" when complete
9. Redirected to `/?token=xxxxx` to see their map

### Returning User

Option 1: Use bookmarked magic link
- Visit `http://localhost:3000/?token=xxxxx`
- See their data immediately

Option 2: Re-import
- Visit `/import?token=xxxxx`
- Click "Refresh Data" to sync latest check-ins

## API Rate Limits

Foursquare API limits:
- 500 requests per hour (personalization APIs)
- With 100 check-ins per request, can fetch 50,000 check-ins/hour
- For a user with 27,000 check-ins: ~270 requests = ~32 minutes

The import handler adds 200ms delay between requests to stay under limits.

## Security Considerations

### Production Deployment

1. **Generate Strong Encryption Key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add to `.env` as `ENCRYPTION_KEY`

2. **Update OAuth Redirect URI:**
   - In Foursquare developer console
   - In `.env` as `FOURSQUARE_REDIRECT_URI=https://yourdomain.com/api/auth/callback`

3. **Update Frontend URL:**
   - In `.env` as `FRONTEND_URL=https://yourdomain.com`

4. **Secure Secret Tokens:**
   - 64-character random hex tokens (crypto.randomBytes(32).toString('hex'))
   - Indexed in database for fast lookup
   - Treat like passwords - never log or expose

5. **HTTPS Only:**
   - All OAuth flows must use HTTPS in production
   - Render/Vercel handle this automatically

## Future Enhancements

### Weekly Sync Cron Job

Add to server startup (not yet implemented):

```javascript
const cron = require('node-cron');

// Run every Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
  const users = await User.findAll();
  const queue = getQueue();

  for (const user of users) {
    await queue.send('import-checkins', {
      jobId: (await ImportJob.create({ userId: user.id })).id,
      userId: user.id
    });
  }
});
```

### Additional Features

- Email notifications when import completes
- Data export (CSV/JSON)
- Account deletion
- Share maps publicly
- Collaborative maps (multiple users)

## File Structure

### Backend
```
server/
├── db/
│   ├── connection.js
│   ├── migrations/
│   │   └── 001_add_multi_user_support.sql
│   └── run-migration.js
├── models/
│   ├── user.js
│   ├── importJob.js
│   └── checkin.js (modified)
├── services/
│   ├── encryption.js
│   └── foursquare.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── import.js
│   ├── checkins.js (modified)
│   └── stats.js (modified)
├── jobs/
│   ├── queue.js
│   └── importCheckins.js
└── server.js (modified)
```

### Frontend
```
client/src/
├── pages/
│   ├── HomePage.jsx (new)
│   └── ImportPage.jsx (new)
└── App.js (modified)
```

## Testing Checklist

- [ ] OAuth flow works (redirect to Foursquare and back)
- [ ] Import job starts and progresses
- [ ] Progress updates in real-time
- [ ] Import completes successfully
- [ ] User's check-ins appear on map
- [ ] Magic link URL works (bookmark and revisit)
- [ ] Token persists in localStorage
- [ ] User only sees their own data
- [ ] Multiple users can import independently
- [ ] Re-import updates existing data
- [ ] Error handling (invalid token, API errors, etc.)

## Troubleshooting

### "Failed to start import" Error
- Check Foursquare OAuth credentials in `.env`
- Verify DATABASE_URL is correct
- Check server logs for detailed error

### Import Stuck in "Pending"
- Check that server started successfully
- Look for "Job queue initialized" in logs
- Verify pg-boss tables created in database

### "Authentication required" Error
- Token may be expired or invalid
- Try re-authenticating via `/import`
- Check browser console for token value

### No Data After Import
- Check import job status for errors
- Verify user_id matches in checkins table
- Look for rate limit errors in server logs

## Summary

The multi-user implementation is complete and ready for testing. To get started:

1. Set up Foursquare OAuth credentials in `.env`
2. Restart the server
3. Visit `/import` and connect with Foursquare
4. Watch your check-ins import automatically!

The magic link token system makes it easy for users to access their data without managing passwords, while maintaining strong security through encrypted OAuth tokens and database-backed authentication.
