# Strava Rate Limit Testing Guide

This guide documents how to test the newly implemented Strava rate-limited resumable sync feature.

## Prerequisites

Before testing, ensure:
1. All code changes have been deployed to production (commit `38317e6`)
2. Database migrations 013 and 014 have been applied
3. You have a Strava account connected to the app
4. You have access to the Render logs via `npm run logs:view`

## Migration Verification

First, verify that the new database tables and columns exist:

```bash
# Connect to production database
psql $DATABASE_URL

# Check migrations applied
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;
# Expected: Should show versions 14, 13, and earlier

# Verify strava_api_requests table
\d strava_api_requests
# Expected: Table with id, user_id, endpoint, requested_at columns and indexes

# Verify import_jobs updates
\d import_jobs
# Expected: Should show sync_cursor (jsonb) and retry_after (timestamp) columns

# Check job_status enum includes new value
SELECT unnest(enum_range(NULL::job_status));
# Expected: Should include 'rate_limited' among the values

\q
```

## Task 11: Testing - Small Import (No Rate Limit)

This test verifies normal operation when rate limits are NOT hit.

### Step 1: Trigger a Small Sync

**Option A: Via UI**
1. Navigate to https://swarm-visualiser.vercel.app
2. Go to Data Sources page
3. Click "Sync Strava" button

**Option B: Via API** (if you prefer)
```bash
# Get your session token from browser cookies
curl -X POST https://swarm-visualizer-api.onrender.com/api/strava/sync \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -H "Content-Type: application/json"
```

### Step 2: Monitor the Sync

Watch the logs in real-time:
```bash
npm run logs:view
```

### Step 3: Expected Log Output

You should see logs similar to:
```
[STRAVA SYNC] Starting activity sync for user 1
[STRAVA SYNC] Fetched X activities from API
[STRAVA SYNC] Fetching and saving X activities...
[STRAVA SYNC] Batch saved: 50/50 (total: 50)
[STRAVA SYNC] Batch saved: 50/50 (total: 100)
...
[STRAVA SYNC] Activity sync complete: X imported
Strava import job N completed: X items imported
```

### Step 4: Verify Job Status

Check the database:
```sql
-- Get latest import job
SELECT id, status, sync_cursor, retry_after, total_imported
FROM import_jobs
WHERE source = 'strava'
ORDER BY id DESC
LIMIT 1;
```

**Expected Results:**
- `status` = `'completed'`
- `sync_cursor` = NULL or contains cursor data (indicates progress was tracked)
- `retry_after` = NULL
- `total_imported` = number of activities imported

### Step 5: Verify API Request Tracking

```sql
-- Check that requests were tracked
SELECT COUNT(*), endpoint
FROM strava_api_requests
WHERE user_id = 1
  AND requested_at > NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY COUNT(*) DESC;
```

**Expected Results:**
- Should show counts for `/athlete/activities` and `/activities/*`
- Counts should match the number of API calls made during sync

### Step 6: Verify No Rate Limit Errors

```bash
# Search logs for rate limit messages
grep -i "rate limit" logs/render-stream.log | tail -20
```

**Expected Results:**
- No "Rate limit exceeded" errors
- May see "Rate limit" in code comments or service initialization (that's fine)

---

## Task 12: Testing - Verify Rate Limit Detection

This test verifies the system correctly detects and handles rate limits.

### Option A: Using Test Script (Recommended)

A test script was created to simulate rate limit conditions without actually hitting Strava's API.

**Step 1: Run the test script**

```bash
# From project root
node server/scripts/test-rate-limit.js
```

**Expected Output:**
```
Testing rate limit detection...
Inserting 96 fake API requests...
Quota check result: { allowed: false, limitType: '15min', resetAt: [Date] }
✅ Rate limit correctly detected!
Reset time: [ISO timestamp]
Cleaned up test data
```

This confirms that:
- The rate limit service correctly counts requests
- It blocks when the threshold (95 requests) is exceeded
- It calculates the correct reset time

### Option B: Real-World Test (Only if you have many activities)

**WARNING:** Only attempt this if you have 200+ Strava activities and are willing to wait for rate limits.

**Step 1: Trigger a Full Historical Sync**

First, reset your sync status:
```sql
UPDATE users SET last_strava_sync_at = NULL WHERE id = 1;
```

Then trigger sync via UI or API.

**Step 2: Monitor for Rate Limit Hit**

Watch logs for these patterns:
```bash
npm run logs:view
```

**What to look for:**
```
[STRAVA SYNC] Fetching and saving X activities...
[STRAVA SYNC] Batch saved: 50/50 (total: 50)
...
[STRAVA JOB] Rate limit hit (15min). Auto-retry at [timestamp]
[STRAVA JOB] Scheduled retry in XXXX seconds
```

**Step 3: Verify Job Status During Rate Limit**

```sql
SELECT id, status, sync_cursor, retry_after, total_imported
FROM import_jobs
WHERE source = 'strava'
ORDER BY id DESC
LIMIT 1;
```

**Expected Results:**
- `status` = `'rate_limited'`
- `sync_cursor` = JSON object with `before` timestamp and counts
- `retry_after` = future timestamp (when retry will occur)
- `total_imported` = number imported before rate limit hit

**Step 4: Verify Auto-Retry**

After the `retry_after` time passes, check logs:

```bash
tail -100 logs/render-stream.log | grep -E "(Resuming|cursor)"
```

**Expected:**
```
[STRAVA JOB] Resuming job N from cursor: { before: [timestamp], ... }
[STRAVA SYNC] Resuming from cursor: [ISO date]
```

**Step 5: Verify Final Completion**

After all retries complete:
```sql
SELECT id, status, sync_cursor, retry_after, total_imported
FROM import_jobs
WHERE source = 'strava'
ORDER BY id DESC
LIMIT 1;
```

**Expected:**
- `status` = `'completed'`
- `retry_after` = NULL (cleared after completion)
- `total_imported` = full count of all activities

---

## Troubleshooting

### Issue: Migrations not applied

**Symptoms:** Errors like `column "sync_cursor" does not exist`

**Solution:**
```bash
# Run migrations manually
node server/db/run-migration.js server/db/migrations/013_create_strava_api_requests.sql
node server/db/run-migration.js server/db/migrations/014_add_import_jobs_cursor.sql
```

### Issue: Job stays in 'rate_limited' status forever

**Symptoms:** Job never resumes after retry_after time

**Possible causes:**
1. pg-boss queue not running
2. Delayed job not scheduled correctly

**Debug steps:**
```bash
# Check if pg-boss is running
grep "pg-boss" logs/render-stream.log | tail -10

# Check for scheduled jobs in database
psql $DATABASE_URL -c "SELECT * FROM pgboss.job WHERE name = 'import-strava-data' AND state = 'created' ORDER BY createdon DESC LIMIT 5;"
```

### Issue: Rate limit triggered too early

**Symptoms:** Rate limit hit after only 50-60 requests

**Possible causes:**
- Other Strava API activity happening concurrently
- Old requests still in 15-minute window

**Debug:**
```sql
-- Check request count
SELECT COUNT(*)
FROM strava_api_requests
WHERE user_id = 1
  AND requested_at > NOW() - INTERVAL '15 minutes';
```

---

## Success Criteria Checklist

After completing both tests, verify:

- [ ] Migrations 013 and 014 applied to production
- [ ] `strava_api_requests` table exists with indexes
- [ ] `import_jobs` has `sync_cursor` and `retry_after` columns
- [ ] Rate limit service correctly detects quota exhaustion (test script passes)
- [ ] Small imports complete without rate limit errors
- [ ] Rate limit errors trigger auto-retry (if tested with large import)
- [ ] Cursor saves incrementally during sync
- [ ] Jobs resume from cursor after rate limit pause
- [ ] No retry storms in logs (requests are sequential)
- [ ] Production deployment successful

---

## Cleanup (Optional)

After testing, you can clean up test data:

```sql
-- Clear test API request tracking
DELETE FROM strava_api_requests WHERE user_id = 1;

-- Optionally delete test import jobs
DELETE FROM import_jobs WHERE id = [test_job_id];
```

---

## Further Information

For detailed implementation information, see:
- Design doc: `/Users/gabormikes/swarm-visualizer/docs/plans/2025-01-16-strava-rate-limit-resumable-sync-design.md`
- Implementation plan: `/Users/gabormikes/swarm-visualizer/docs/plans/2025-01-16-strava-rate-limit-resumable-sync-implementation-plan.md`
- CHANGELOG: `/Users/gabormikes/swarm-visualizer/CHANGELOG.md`
