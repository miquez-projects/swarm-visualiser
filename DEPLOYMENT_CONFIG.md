# Deployment Configuration Checklist

Your specific configuration values for the Swarm Visualizer deployment.

## Your Production URLs

- **Backend (Render):** https://swarm-visualizer-api.onrender.com
- **Frontend (Vercel):** https://swarm-visualiser.vercel.app

---

## Phase 2: Foursquare OAuth Configuration

### Step 1: Go to Foursquare Developers
Visit: https://foursquare.com/developers/apps

### Step 2: Create or Select Project
- If creating new: Click "Create Project"
- Name it: "Swarm Visualizer"

### Step 3: Configure OAuth Settings
In your project settings, under **OAuth Authentication**:

**Redirect URI (copy exactly):**
```
https://swarm-visualizer-api.onrender.com/api/auth/callback
```

⚠️ **Important:**
- No trailing slash
- Must be exact match
- Use HTTPS (not HTTP)

### Step 4: Copy Your Credentials
You'll need these in Phase 3:
- [ ] Client ID: ____________________
- [ ] Client Secret: ____________________

---

## Phase 3: Environment Variables Configuration

### Render Backend Environment Variables

Go to: https://dashboard.render.com → Your service → Environment

**Add these NEW variables:**

| Variable Name | Value |
|--------------|-------|
| `FOURSQUARE_CLIENT_ID` | (paste from Foursquare) |
| `FOURSQUARE_CLIENT_SECRET` | (paste from Foursquare) |
| `FOURSQUARE_REDIRECT_URI` | `https://swarm-visualizer-api.onrender.com/api/auth/callback` |
| `FRONTEND_URL` | `https://swarm-visualiser.vercel.app` |
| `ENCRYPTION_KEY` | `f0a244f8ce5a555a6ed4abeef8539ca41e643d7167783338591ea7c1dbe04775` |

**Keep existing variables:**
- `DATABASE_URL` (don't change)
- `NODE_ENV=production` (don't change)
- `PORT=3001` (keep if exists, or let Render set it)

After adding variables, click **Save Changes** - Render will auto-redeploy.

---

### Vercel Frontend Environment Variables

Go to: https://vercel.com/dashboard → Your project → Settings → Environment Variables

**Add this variable:**

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `REACT_APP_API_URL` | `https://swarm-visualizer-api.onrender.com` | Production, Preview, Development |

After adding, go to **Deployments** → Click **⋮** on latest → **Redeploy**.

---

## Phase 4: Run Database Migration

### Option A: Using Render Shell (Easiest)

1. Go to Render Dashboard → Your backend service
2. Click **Shell** tab (terminal icon at top)
3. Wait for shell to connect
4. Run:
```bash
node server/db/run-migration.js migrations/001_add_multi_user_support.sql
```
5. Look for: `✅ Migration completed successfully`

### Option B: Direct Database Connection

If you prefer to use a local PostgreSQL client:

1. Get DATABASE_URL from Render environment variables
2. Run locally:
```bash
cd /Users/gabormikes/swarm-visualizer
PGPASSWORD='your_password' psql -h your-host -U your-user -d your-database -f server/db/migrations/001_add_multi_user_support.sql
```

---

## Phase 5: Verification Checklist

### Backend Verification

Visit: https://swarm-visualizer-api.onrender.com/health

**Expected response:**
```json
{"status":"ok","timestamp":"2025-..."}
```

**Check Render Logs for:**
- [ ] "Database connected"
- [ ] "pg-boss job queue started"
- [ ] "Job queue initialized and workers registered"
- [ ] "Server running on port 3001"

### Frontend Verification

Visit: https://swarm-visualiser.vercel.app

**Should see:**
- [ ] Map loads
- [ ] No console errors

### OAuth Flow Test

1. Visit: https://swarm-visualiser.vercel.app/import
2. Should see: "Connect with Foursquare" button
3. Click button
4. Should redirect to: `https://foursquare.com/oauth2/authenticate...`
5. After authorizing, should redirect to: `https://swarm-visualiser.vercel.app/import?token=...`

---

## Testing URLs

Once everything is configured:

- **Import Page:** https://swarm-visualiser.vercel.app/import
- **Home Page:** https://swarm-visualiser.vercel.app/
- **Health Check:** https://swarm-visualizer-api.onrender.com/health
- **Auth Login:** https://swarm-visualizer-api.onrender.com/api/auth/login

---

## Quick Reference

### Your Encryption Key
```
f0a244f8ce5a555a6ed4abeef8539ca41e643d7167783338591ea7c1dbe04775
```

### OAuth Redirect URI
```
https://swarm-visualizer-api.onrender.com/api/auth/callback
```

### Frontend URL
```
https://swarm-visualiser.vercel.app
```

### Backend URL
```
https://swarm-visualizer-api.onrender.com
```

---

## Troubleshooting

### If OAuth fails with "redirect_uri_mismatch":
1. Check Foursquare project settings
2. Verify exact match: `https://swarm-visualizer-api.onrender.com/api/auth/callback`
3. No http:// (must be https://)
4. No trailing slash
5. No extra spaces

### If import doesn't start:
1. Check Render logs for pg-boss initialization
2. Verify database migration ran successfully
3. Restart Render service if needed

### If frontend shows wrong data:
1. Verify REACT_APP_API_URL in Vercel
2. Check browser console for CORS errors
3. Try hard refresh (Cmd+Shift+R)

---

## Timeline

- ⏱️ **Phase 2 (Foursquare setup):** 10 minutes
- ⏱️ **Phase 3 (Environment vars):** 15 minutes
- ⏱️ **Phase 4 (Migration):** 5 minutes
- ⏱️ **Phase 5 (Verification):** 10 minutes

**Total remaining:** ~40 minutes

---

## Current Status

✅ **Phase 1 Complete:** Code pushed to GitHub
⏳ **Phase 2:** Configure Foursquare (NEXT STEP)
⏳ **Phase 3:** Set environment variables
⏳ **Phase 4:** Run database migration
⏳ **Phase 5:** Test and verify

**Ready for Phase 2!** Go to https://foursquare.com/developers/apps
