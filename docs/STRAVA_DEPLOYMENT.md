# Strava Integration - Deployment Checklist

**Date:** January 14, 2025
**Status:** Ready for Production Deployment

## Prerequisites

### 1. Strava API Credentials

✅ **Required:** Create a Strava API application at https://www.strava.com/settings/api

You need:
- **Client ID**
- **Client Secret**
- **Authorization Callback Domain:** Set to `https://swarm-visualiser.vercel.app` in Strava settings

### 2. Environment Variables

Add these to **Render** (Backend):

```bash
STRAVA_CLIENT_ID=<your_strava_client_id>
STRAVA_CLIENT_SECRET=<your_strava_client_secret>
```

**Note:** No frontend environment variables needed - all Strava config is backend-only.

## Deployment Steps

### ✅ Step 1: Database Migrations (COMPLETED)

All 4 migrations have been run on production:
- ✅ `009_add_strava_activities.sql` - Creates strava_activities table
- ✅ `010_add_strava_activity_photos.sql` - Creates strava_activity_photos table
- ✅ `011_add_strava_auth.sql` - Adds Strava OAuth columns to users table
- ✅ `012_add_data_source_to_import_jobs.sql` - Adds data_source column to import_jobs table

**Verification:**
```sql
-- Verify tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'strava%';

-- Should return:
-- strava_activities
-- strava_activity_photos

-- Verify user columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE 'strava%';

-- Should return:
-- strava_oauth_tokens_encrypted
-- strava_athlete_id
-- strava_connected_at
```

### ✅ Step 2: Code Deployment (COMPLETED)

All commits pushed to GitHub:
- ✅ 9 commits for Strava integration
- ✅ Backend code deployed to Render automatically
- ✅ Frontend code deployed to Vercel automatically

### Step 3: Environment Variables

**Action Required:**

1. Go to Render Dashboard → swarm-visualizer-api → Environment
2. Add these variables:
   ```
   STRAVA_CLIENT_ID=<your_client_id>
   STRAVA_CLIENT_SECRET=<your_client_secret>
   ```
3. Save and trigger redeploy

**Important:** Make sure `API_URL` environment variable is set correctly:
```
API_URL=https://swarm-visualizer-api.onrender.com
```

### Step 4: Test Deployment

After environment variables are added and service redeployed:

1. **Navigate to Data Sources page:**
   https://swarm-visualiser.vercel.app/data-sources

2. **Test Strava Connection:**
   - Click "Connect Strava" button
   - Should redirect to Strava OAuth page
   - Authorize the application
   - Should return to Data Sources page with success message
   - Should automatically queue initial import job

3. **Verify Database:**
   ```sql
   -- Check user's Strava connection
   SELECT id, strava_athlete_id, strava_connected_at, last_strava_sync_at
   FROM users
   WHERE strava_oauth_tokens_encrypted IS NOT NULL;

   -- Check import job created
   SELECT * FROM import_jobs
   WHERE data_source = 'strava'
   ORDER BY created_at DESC LIMIT 1;
   ```

4. **Monitor Import Job:**
   - Check Render logs for sync progress
   - Look for `[STRAVA SYNC]` log entries
   - Verify activities being imported

5. **Verify Activities Imported:**
   ```sql
   -- Count activities
   SELECT user_id, COUNT(*) as activity_count
   FROM strava_activities
   GROUP BY user_id;

   -- Check for tracklogs
   SELECT COUNT(*) as mapped_activities
   FROM strava_activities
   WHERE tracklog IS NOT NULL;

   -- Check for photos
   SELECT COUNT(*) as photos_imported
   FROM strava_activity_photos;
   ```

## Rollback Plan

If deployment fails:

1. **Remove environment variables from Render**
2. **Revert database migrations:**
   ```sql
   DROP TABLE IF EXISTS strava_activity_photos CASCADE;
   DROP TABLE IF EXISTS strava_activities CASCADE;
   ALTER TABLE users DROP COLUMN IF EXISTS strava_oauth_tokens_encrypted;
   ALTER TABLE users DROP COLUMN IF EXISTS strava_athlete_id;
   ALTER TABLE users DROP COLUMN IF EXISTS strava_connected_at;
   ALTER TABLE users DROP COLUMN IF EXISTS last_strava_sync_at;
   ```
3. **Revert code to previous commit:**
   ```bash
   git revert HEAD~10..HEAD  # Reverts last 10 commits
   git push
   ```

## Monitoring

### Key Metrics to Watch

1. **OAuth Success Rate**
   - Monitor `[STRAVA ROUTE]` logs for OAuth failures
   - Check for "Successfully connected Strava" messages

2. **Sync Job Completion**
   - Watch for "Sync complete" in logs
   - Monitor `import_jobs` table for failed jobs

3. **API Rate Limiting**
   - Watch for 429 errors in logs
   - Monitor retry attempts and backoff

4. **Database Growth**
   - Monitor `strava_activities` table size
   - Check for duplicate activities (should be 0 due to UNIQUE constraint)

### Log Queries

```bash
# Watch Strava-related logs
grep "STRAVA" logs/render-stream.log | tail -100

# Check for errors
grep -i "error" logs/render-stream.log | grep -i "strava"

# Monitor sync progress
grep "Sync complete" logs/render-stream.log | tail -20
```

## Post-Deployment Verification

### Checklist

- [ ] Environment variables added to Render
- [ ] Service redeployed successfully
- [ ] Can connect Strava account via UI
- [ ] OAuth callback returns to correct page
- [ ] Initial sync job queued automatically
- [ ] Activities importing successfully
- [ ] GPS tracklogs present for mapped activities
- [ ] Photos importing for activities with photos
- [ ] Manual sync button works
- [ ] Disconnect button works
- [ ] Can reconnect after disconnect
- [ ] Garmin activity toggle still works
- [ ] No errors in Render logs

## Known Limitations

1. **Rate Limits:** Strava limits to 100 requests per 15 minutes
   - For large initial imports (>1000 activities), expect longer sync times
   - Automatic retry with exponential backoff implemented

2. **Batch Processing:** Activities fetched in batches of 10 concurrent requests
   - Optimized for rate limits while maintaining performance
   - ~100 seconds for 1000 activities (vs ~1000 seconds sequential)

3. **Photos:** Only fetches photos for activities with `photo_count > 0`
   - Separate API call per activity with photos
   - May hit rate limits on accounts with many photo activities

## Troubleshooting

### Issue: "Failed to connect Strava"

**Check:**
1. Environment variables set correctly in Render
2. Strava callback URL matches in both Strava API settings and environment
3. Check Render logs for specific error

### Issue: "Sync job never completes"

**Check:**
1. Render logs for errors
2. Check `import_jobs` table status
3. Look for rate limit errors (429)
4. Verify OAuth tokens not expired

### Issue: "No activities imported"

**Check:**
1. Verify Strava account has activities
2. Check date range (default: 5 years back)
3. Look for `[STRAVA SYNC]` errors in logs
4. Check if activities were deduplicated (already existed)

## Success Criteria

✅ Deployment is successful when:

1. Users can connect their Strava account via OAuth
2. Initial full sync completes and imports activities
3. Mapped activities have GPS tracklogs stored as PostGIS LINESTRING
4. Photos imported for activities with photos
5. Manual sync works and uses 7-day lookback
6. Both Strava and Garmin can be connected simultaneously
7. Garmin activity toggle prevents duplicates
8. No errors in production logs
9. All sync jobs complete successfully

---

**Deployment Owner:** Claude + User
**Deployment Date:** January 14, 2025
**Version:** 1.0.0
