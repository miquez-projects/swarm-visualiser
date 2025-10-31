# Deployment Plan: Multi-User Features

This document provides a step-by-step guide to deploy the new multi-user authentication and Foursquare API integration features.

## Pre-Deployment Checklist

- [x] All code changes implemented
- [x] Database migration created and tested locally
- [x] Backend routes and services created
- [x] Frontend pages created
- [x] Documentation written
- [ ] Code committed to git
- [ ] Pushed to GitHub
- [ ] Environment variables configured
- [ ] Database migration run on production
- [ ] Foursquare OAuth configured

---

## Phase 1: Commit and Push to GitHub

### Step 1.1: Review Changes
```bash
cd /Users/gabormikes/swarm-visualizer
git status
git diff  # Review all changes
```

### Step 1.2: Add All Files
```bash
# Add all new and modified files
git add .

# Verify what will be committed
git status
```

### Step 1.3: Commit Changes
```bash
git commit -m "Add multi-user authentication and Foursquare API integration

Features:
- OAuth authentication with Foursquare
- Magic link user authentication (no passwords)
- Automatic check-in import from Foursquare API
- Background job processing with pg-boss
- User-specific data filtering
- Import progress tracking
- Multi-user database schema with encryption

Backend:
- Add users and import_jobs tables
- Add user_id to checkins table
- Create User and ImportJob models
- Add Foursquare API service
- Add encryption service for OAuth tokens
- Add auth, import routes
- Update checkins/stats routes for multi-user
- Add pg-boss job queue
- Add import job worker

Frontend:
- Add React Router
- Create ImportPage for OAuth and import progress
- Create HomePage with auth support
- Support magic link tokens in URL and localStorage

Documentation:
- Add MULTI_USER_IMPLEMENTATION.md
- Add DEPLOYMENT_PLAN.md"
```

### Step 1.4: Push to GitHub
```bash
git push origin main
```

**Expected Result:** Code pushed to https://github.com/miquez/swarm-visualiser

---

## Phase 2: Configure Foursquare OAuth

### Step 2.1: Create Foursquare Project

1. Go to https://foursquare.com/developers/apps
2. Click **"Create Project"**
3. Name: "Swarm Visualizer" (or your preferred name)
4. Submit

### Step 2.2: Configure OAuth Settings

1. Go to **Project Settings**
2. Under **OAuth Authentication** section:
   - **Add Redirect URI**: `https://swarm-visualiser.onrender.com/api/auth/callback`
     (Replace with your actual Render backend URL)
   - Save

### Step 2.3: Copy Credentials

Copy these values (you'll need them in the next phase):
- **Client ID**: (long alphanumeric string)
- **Client Secret**: (long alphanumeric string)

---

## Phase 3: Configure Production Environment Variables

### Step 3.1: Get Your Production URLs

You need to know:
- **Backend URL** (Render): `https://swarm-visualiser.onrender.com` (or your actual URL)
- **Frontend URL** (Vercel): `https://swarm-visualiser.vercel.app` (or your actual URL)

### Step 3.2: Configure Render (Backend)

1. Go to https://dashboard.render.com
2. Select your backend service
3. Go to **Environment** tab
4. Add/Update these environment variables:

```bash
# Existing (keep as is)
DATABASE_URL=<your_existing_postgres_url>
NODE_ENV=production
PORT=3001

# New variables to ADD:
FOURSQUARE_CLIENT_ID=<from_step_2.3>
FOURSQUARE_CLIENT_SECRET=<from_step_2.3>
FOURSQUARE_REDIRECT_URI=https://swarm-visualiser.onrender.com/api/auth/callback
FRONTEND_URL=https://swarm-visualiser.vercel.app
ENCRYPTION_KEY=f0a244f8ce5a555a6ed4abeef8539ca41e643d7167783338591ea7c1dbe04775
```

**Important:** Replace the URLs with your actual Render and Vercel URLs!

5. Click **Save Changes**
6. Render will automatically redeploy with new environment variables

### Step 3.3: Configure Vercel (Frontend)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add this variable (if not already present):

```bash
REACT_APP_API_URL=https://swarm-visualiser.onrender.com
```

5. Click **Save**
6. Go to **Deployments** tab
7. Click **Redeploy** on the latest deployment

---

## Phase 4: Run Database Migration on Production

### Step 4.1: Connect to Production Database

**Option A: Using Render Shell (Recommended)**

1. Go to Render Dashboard → Your service
2. Click **Shell** tab (terminal icon)
3. Run migration:
```bash
node server/db/run-migration.js migrations/001_add_multi_user_support.sql
```

**Option B: Using Local PostgreSQL Client**

1. Get your production DATABASE_URL from Render environment variables
2. Run locally:
```bash
psql "your_production_database_url" -f server/db/migrations/001_add_multi_user_support.sql
```

**Option C: Using Node Script Remotely**

1. In Render Shell:
```bash
cd server/db
node run-migration.js migrations/001_add_multi_user_support.sql
```

### Step 4.2: Verify Migration Success

Look for output: `✅ Migration completed successfully`

Check tables were created:
```bash
# In Render Shell or psql
psql $DATABASE_URL -c "\dt"
```

You should see:
- `users` table
- `import_jobs` table
- `checkins` table (with new `user_id` column)

---

## Phase 5: Deploy and Verify

### Step 5.1: Verify Backend Deployment

1. Wait for Render to finish deploying (green checkmark)
2. Check logs for:
   - "pg-boss job queue started"
   - "Job queue initialized and workers registered"
   - "Server running on port 3001"
3. Test health endpoint:
```bash
curl https://swarm-visualiser.onrender.com/health
```

Expected: `{"status":"ok","timestamp":"2025-..."}`

### Step 5.2: Verify Frontend Deployment

1. Wait for Vercel to finish deploying
2. Visit your frontend URL: `https://swarm-visualiser.vercel.app`
3. Should see the map interface

### Step 5.3: Test OAuth Flow

1. Visit: `https://swarm-visualiser.vercel.app/import`
2. Should see "Connect with Foursquare" button
3. Click button
4. Should redirect to Foursquare login
5. After authorizing, should redirect back to `/import?token=xxx`
6. Should see import interface

**If it works:** You're done! 🎉

**If it fails:** See Troubleshooting section below

---

## Phase 6: Post-Deployment Testing

### Test Checklist

- [ ] OAuth login redirects to Foursquare
- [ ] After auth, redirects back with token
- [ ] Import job starts successfully
- [ ] Progress updates in real-time
- [ ] Import completes successfully
- [ ] Check-ins appear on map
- [ ] Magic link URL works (copy and paste in new tab)
- [ ] User only sees their own data
- [ ] Second user can authenticate independently
- [ ] Re-import/refresh works

---

## Troubleshooting

### Issue: "Redirect URI mismatch" Error

**Cause:** Foursquare redirect URI doesn't match
**Fix:**
1. Check exact URL in Foursquare project settings
2. Must match: `https://your-backend-url.onrender.com/api/auth/callback`
3. No trailing slash!

### Issue: "Configuration error" on OAuth

**Cause:** Missing Foursquare credentials
**Fix:**
1. Check Render environment variables
2. Verify `FOURSQUARE_CLIENT_ID` and `FOURSQUARE_CLIENT_SECRET` are set
3. Redeploy if needed

### Issue: Import job stuck on "Pending"

**Cause:** Job queue not initialized or worker not running
**Fix:**
1. Check Render logs for "Job queue initialized" message
2. Verify pg-boss tables exist in database
3. Restart Render service

### Issue: "Database migration failed"

**Cause:** Tables might already exist or connection issue
**Fix:**
1. Check if tables already exist: `\dt` in psql
2. If tables exist but missing columns, run ALTER TABLE commands manually
3. Check DATABASE_URL is correct

### Issue: Frontend can't reach backend

**Cause:** CORS or wrong API URL
**Fix:**
1. Verify `REACT_APP_API_URL` in Vercel
2. Check CORS settings in server.js (should allow all origins)
3. Test backend health endpoint directly

### Issue: "Failed to decrypt token" errors

**Cause:** ENCRYPTION_KEY changed or not set
**Fix:**
1. Set ENCRYPTION_KEY in Render environment
2. All tokens encrypted before key change are invalid
3. Users need to re-authenticate

---

## Rollback Plan

If deployment fails and you need to rollback:

### Backend Rollback
1. Go to Render Dashboard → Your service
2. Go to **Deployments** tab
3. Find previous working deployment
4. Click **⋮** → **Redeploy**

### Database Rollback
```sql
-- Only if needed! This deletes all user data
DROP TABLE IF EXISTS import_jobs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
ALTER TABLE checkins DROP COLUMN IF EXISTS user_id;
```

### Frontend Rollback
1. Go to Vercel → Deployments
2. Find previous working deployment
3. Click **⋮** → **Promote to Production**

---

## Success Criteria

Deployment is successful when:

✅ Backend deploys without errors
✅ Frontend deploys without errors
✅ Database migration completes
✅ Health endpoint responds
✅ OAuth flow completes end-to-end
✅ Import job runs successfully
✅ User sees their check-ins on map
✅ Magic link works in new browser session

---

## Next Steps After Successful Deployment

1. **Test with Real Data**: Import your own check-ins
2. **Invite Beta Users**: Share `/import` URL with 2-3 friends
3. **Monitor Logs**: Watch for errors in Render logs
4. **Set Up Monitoring**: Consider adding error tracking (Sentry, etc.)
5. **Document Magic Links**: Save example magic link for support
6. **Plan Weekly Sync**: Decide when to implement automatic syncing

---

## Support Commands

### Check Backend Logs
```bash
# In Render Dashboard → Logs tab, or:
render logs -s your-service-name
```

### Check Database Contents
```bash
# In Render Shell:
psql $DATABASE_URL

# Then:
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM import_jobs;
SELECT COUNT(*) FROM checkins WHERE user_id IS NOT NULL;
```

### Restart Services
- **Backend:** Render → Manual Deploy → Deploy latest commit
- **Frontend:** Vercel → Redeploy
- **Database:** Should not need restart

---

## Estimated Timeline

- **Phase 1 (Git):** 5 minutes
- **Phase 2 (Foursquare):** 10 minutes
- **Phase 3 (Environment):** 15 minutes
- **Phase 4 (Migration):** 10 minutes
- **Phase 5 (Deploy & Verify):** 20 minutes
- **Phase 6 (Testing):** 30 minutes

**Total:** ~90 minutes

---

## Contact Information

- **GitHub Repo:** https://github.com/miquez/swarm-visualiser
- **Backend:** Render dashboard
- **Frontend:** Vercel dashboard
- **Foursquare:** https://foursquare.com/developers/apps

**Ready to deploy?** Start with Phase 1! 🚀
