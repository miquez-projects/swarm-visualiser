# Strava Rate-Limited Resumable Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement rate-limited resumable sync for Strava that handles 100 req/15min and 1000 req/day limits with automatic retry scheduling and cursor-based resumption.

**Architecture:** Database-tracked API usage with proactive quota checks, cursor-based sync position stored in import_jobs, sequential request processing to eliminate retry storms, automatic retry scheduling via pg-boss delayed jobs.

**Tech Stack:** Node.js, PostgreSQL, pg-boss, existing stravaOAuth/stravaSync services

---

## Task 1: Database Schema - API Request Tracking Table

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/db/migrations/013_create_strava_api_requests.sql`

**Step 1: Write migration for strava_api_requests table**

```sql
-- Track Strava API requests for rate limit management
-- Supports both 15-minute (100 req) and daily (1000 req) windows

CREATE TABLE strava_api_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strava_requests_time ON strava_api_requests(requested_at);
CREATE INDEX idx_strava_requests_user ON strava_api_requests(user_id, requested_at);

INSERT INTO schema_migrations (version, name)
VALUES (13, '013_create_strava_api_requests');
```

**Step 2: Run migration on local database**

Run: `node server/db/run-migration.js server/db/migrations/013_create_strava_api_requests.sql`

Expected: Migration 13 applied successfully

**Step 3: Verify table created**

Run: `psql $DATABASE_URL -c "\d strava_api_requests"`

Expected: Table structure displayed with indexes

**Step 4: Commit**

```bash
git add server/db/migrations/013_create_strava_api_requests.sql
git commit -m "feat(strava): add API request tracking table for rate limits"
```

---

## Task 2: Database Schema - Import Jobs Cursor Fields

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/db/migrations/014_add_import_jobs_cursor.sql`

**Step 1: Write migration for cursor tracking fields**

```sql
-- Add cursor tracking and retry scheduling to import_jobs
-- Enables resumable sync after rate limit pauses

ALTER TABLE import_jobs ADD COLUMN sync_cursor JSONB;
ALTER TABLE import_jobs ADD COLUMN retry_after TIMESTAMP;

-- Add 'rate_limited' to status enum
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rate_limited';

INSERT INTO schema_migrations (version, name)
VALUES (14, '014_add_import_jobs_cursor');
```

**Step 2: Run migration on local database**

Run: `node server/db/run-migration.js server/db/migrations/014_add_import_jobs_cursor.sql`

Expected: Migration 14 applied successfully

**Step 3: Verify columns added**

Run: `psql $DATABASE_URL -c "\d import_jobs"`

Expected: Shows sync_cursor (jsonb) and retry_after (timestamp) columns

**Step 4: Commit**

```bash
git add server/db/migrations/014_add_import_jobs_cursor.sql
git commit -m "feat(import): add cursor and retry_after to import_jobs"
```

---

## Task 3: Rate Limit Service - Core Service File

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/services/stravaRateLimitService.js`

**Step 1: Create service skeleton with checkQuota**

```javascript
const db = require('../db/connection');

/**
 * Custom error for rate limit exceeded
 */
class RateLimitError extends Error {
  constructor({ window, retryAfter }) {
    super(`Rate limit exceeded: ${window} window`);
    this.name = 'RateLimitError';
    this.window = window;
    this.retryAfter = retryAfter;
  }
}

/**
 * Strava Rate Limit Service
 *
 * Tracks API usage and enforces rate limits:
 * - 100 requests per 15 minutes
 * - 1000 requests per 24 hours
 *
 * Uses conservative limits (95/950) to leave buffer for edge cases.
 */
class StravaRateLimitService {
  constructor() {
    this.limits = {
      short: { max: 95, windowMs: 15 * 60 * 1000 },
      daily: { max: 950, windowMs: 24 * 60 * 60 * 1000 }
    };
  }

  /**
   * Check if user can make a Strava API request
   * @param {number} userId - User ID
   * @returns {Promise<{allowed: boolean, limitType?: string, resetAt?: Date}>}
   */
  async checkQuota(userId) {
    // Count requests in last 15 minutes
    const shortWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '15 minutes'
    `, [userId]);

    const shortCount = parseInt(shortWindow.rows[0].count, 10);

    if (shortCount >= this.limits.short.max) {
      const resetAt = await this.getResetTime('short', userId);
      return {
        allowed: false,
        limitType: '15min',
        resetAt
      };
    }

    // Count requests in last 24 hours
    const dailyWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '24 hours'
    `, [userId]);

    const dailyCount = parseInt(dailyWindow.rows[0].count, 10);

    if (dailyCount >= this.limits.daily.max) {
      const resetAt = await this.getResetTime('daily', userId);
      return {
        allowed: false,
        limitType: 'daily',
        resetAt
      };
    }

    return { allowed: true };
  }

  /**
   * Record a successful API request
   * @param {number} userId - User ID
   * @param {string} endpoint - API endpoint called
   */
  async recordRequest(userId, endpoint) {
    await db.query(`
      INSERT INTO strava_api_requests (user_id, endpoint, requested_at)
      VALUES ($1, $2, NOW())
    `, [userId, endpoint]);
  }

  /**
   * Calculate when rate limit will reset
   * @param {string} limitType - 'short' or 'daily'
   * @param {number} userId - User ID
   * @returns {Promise<Date>}
   */
  async getResetTime(limitType, userId) {
    const isShort = limitType === 'short';
    const limit = isShort ? this.limits.short : this.limits.daily;
    const interval = isShort ? '15 minutes' : '24 hours';

    // Find the oldest request in the current window
    const query = `
      SELECT requested_at
      FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '${interval}'
      ORDER BY requested_at ASC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      // No requests in window, reset is now
      return new Date();
    }

    const oldestRequest = new Date(result.rows[0].requested_at);
    const resetTime = new Date(oldestRequest.getTime() + limit.windowMs);

    return resetTime;
  }
}

module.exports = {
  StravaRateLimitService,
  RateLimitError
};
```

**Step 2: Verify syntax**

Run: `node -c server/services/stravaRateLimitService.js`

Expected: No errors

**Step 3: Commit**

```bash
git add server/services/stravaRateLimitService.js
git commit -m "feat(strava): add rate limit tracking service"
```

---

## Task 4: Import Job Model - Cursor Methods

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/models/importJob.js`

**Step 1: Add markRateLimited method**

Add after the `markFailed` method (around line 70):

```javascript
  /**
   * Mark job as rate limited with retry time
   */
  static async markRateLimited(jobId, retryAfter) {
    const query = `
      UPDATE import_jobs
      SET status = 'rate_limited', retry_after = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [jobId, retryAfter]);
    return result.rows[0];
  }
```

**Step 2: Add updateCursor method**

Add after `markRateLimited`:

```javascript
  /**
   * Update sync cursor for resumable imports
   */
  static async updateCursor(jobId, cursor) {
    const query = `
      UPDATE import_jobs
      SET sync_cursor = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [jobId, JSON.stringify(cursor)]);
    return result.rows[0];
  }
```

**Step 3: Verify syntax**

Run: `node -c server/models/importJob.js`

Expected: No errors

**Step 4: Commit**

```bash
git add server/models/importJob.js
git commit -m "feat(import): add cursor tracking methods to ImportJob model"
```

---

## Task 5: Strava Sync Service - Add Rate Limit Integration

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/stravaSync.js`

**Step 1: Add rate limit service import**

At top of file (line 2, after stravaOAuth import):

```javascript
const { StravaRateLimitService, RateLimitError } = require('./stravaRateLimitService');
const rateLimitService = new StravaRateLimitService();
```

**Step 2: Update syncActivities signature to accept cursor**

Change line 13 from:
```javascript
async syncActivities(encryptedTokens, userId, afterDate = null, onProgress = null) {
```

To:
```javascript
async syncActivities(encryptedTokens, userId, afterDate = null, cursor = null, onProgress = null) {
```

**Step 3: Add cursor handling at start of syncActivities**

After line 14 (`console.log(...)`), add:

```javascript
    // Determine starting point from cursor if resuming
    let beforeTimestamp = null;
    if (cursor && cursor.before) {
      beforeTimestamp = cursor.before;
      console.log(`[STRAVA SYNC] Resuming from cursor: ${new Date(beforeTimestamp * 1000).toISOString()}`);
    }
```

**Step 4: Add quota check before fetching activity list**

Inside the `while (true)` loop (around line 30), before the API request, add:

```javascript
        // Check quota before fetching
        const canProceed = await rateLimitService.checkQuota(userId);
        if (!canProceed.allowed) {
          throw new RateLimitError({
            window: canProceed.limitType,
            retryAfter: canProceed.resetAt
          });
        }
```

**Step 5: Add beforeTimestamp to params**

After line 31 (`if (after) params.after = after;`), add:

```javascript
        if (beforeTimestamp) params.before = beforeTimestamp;
```

**Step 6: Record request after successful fetch**

After line 47 (`activities = response;`), add:

```javascript
        await rateLimitService.recordRequest(userId, '/athlete/activities');
```

**Step 7: Commit**

```bash
git add server/services/stravaSync.js
git commit -m "feat(strava): add rate limit checks to activity list fetching"
```

---

## Task 6: Strava Sync Service - Sequential Detail Fetching

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/stravaSync.js`

**Step 1: Replace concurrent batch processing with sequential**

Replace the entire section from line 82 (`for (let i = 0; i < allActivities.length; i += batchSize)`) to line 136 (end of outer for loop) with:

```javascript
      // Fetch detailed data SEQUENTIALLY with quota checks
      console.log(`[STRAVA SYNC] Fetching and saving ${allActivities.length} activities...`);
      const insertBatchSize = 50;
      let totalInserted = 0;
      const detailedActivities = [];

      for (let i = 0; i < allActivities.length; i++) {
        const summary = allActivities[i];

        // Check quota before each detail request
        const canProceed = await rateLimitService.checkQuota(userId);
        if (!canProceed.allowed) {
          // Save progress so far
          if (detailedActivities.length > 0) {
            const activitiesToInsert = detailedActivities.map(a =>
              this.transformActivity(a, userId)
            );
            const insertedCount = await StravaActivity.bulkInsert(activitiesToInsert);
            totalInserted += insertedCount;
            console.log(`[STRAVA SYNC] Pre-pause save: ${insertedCount} activities`);
            detailedActivities.length = 0;
          }

          throw new RateLimitError({
            window: canProceed.limitType,
            retryAfter: canProceed.resetAt
          });
        }

        try {
          const response = await stravaOAuth.makeAuthenticatedRequest(
            encryptedTokens,
            `/activities/${summary.id}`,
            {}
          );

          await rateLimitService.recordRequest(userId, '/activities/*');

          const activity = response?.data || response;
          detailedActivities.push(activity);
        } catch (error) {
          console.log(`[STRAVA SYNC] Failed to fetch details for activity ${summary.id}, using summary`);
          detailedActivities.push(summary);
        }

        // Insert every insertBatchSize activities
        if (detailedActivities.length >= insertBatchSize) {
          const activitiesToInsert = detailedActivities.map(a =>
            this.transformActivity(a, userId)
          );

          const insertedCount = await StravaActivity.bulkInsert(activitiesToInsert);
          totalInserted += insertedCount;

          console.log(`[STRAVA SYNC] Batch saved: ${insertedCount}/${activitiesToInsert.length} (total: ${totalInserted})`);

          // Update progress with oldest activity timestamp for cursor
          const oldestActivity = detailedActivities[detailedActivities.length - 1];
          const oldestTimestamp = Math.floor(new Date(oldestActivity.start_date).getTime() / 1000);

          if (onProgress) {
            await onProgress({
              detailed: i + 1,
              fetched: allActivities.length,
              inserted: totalInserted,
              oldestActivityTimestamp: oldestTimestamp
            });
          }

          detailedActivities.length = 0;
        }
      }
```

**Step 2: Update catch block to re-throw RateLimitError**

Replace the catch block (around line 153) with:

```javascript
  } catch (error) {
    if (error.name === 'RateLimitError') {
      throw error; // Re-throw to be caught by job handler
    }
    console.error(`[STRAVA SYNC] Activity sync error:`, error.message);
    throw error;
  }
```

**Step 3: Verify syntax**

Run: `node -c server/services/stravaSync.js`

Expected: No errors

**Step 4: Commit**

```bash
git add server/services/stravaSync.js
git commit -m "feat(strava): replace concurrent batching with sequential quota-checked fetching"
```

---

## Task 7: Strava Sync Service - Update fullHistoricalSync and incrementalSync

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/stravaSync.js`

**Step 1: Update fullHistoricalSync to accept and pass cursor**

Change signature (around line 253) from:
```javascript
async fullHistoricalSync(encryptedTokens, userId, onProgress = null) {
```

To:
```javascript
async fullHistoricalSync(encryptedTokens, userId, cursor = null, onProgress = null) {
```

**Step 2: Pass cursor to syncActivities in fullHistoricalSync**

Change the syncActivities call (around line 257) from:
```javascript
const activityResult = await this.syncActivities(encryptedTokens, userId, null, onProgress);
```

To:
```javascript
const activityResult = await this.syncActivities(encryptedTokens, userId, null, cursor, onProgress);
```

**Step 3: Update incrementalSync to accept and pass cursor**

Change signature (around line 272) from:
```javascript
async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null) {
```

To:
```javascript
async incrementalSync(encryptedTokens, userId, lastSyncDate, cursor = null, onProgress = null) {
```

**Step 4: Pass cursor to syncActivities in incrementalSync**

Change the syncActivities call (around line 278) from:
```javascript
const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
```

To:
```javascript
const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, cursor, onProgress);
```

**Step 5: Verify syntax**

Run: `node -c server/services/stravaSync.js`

Expected: No errors

**Step 6: Commit**

```bash
git add server/services/stravaSync.js
git commit -m "feat(strava): thread cursor through sync methods"
```

---

## Task 8: Job Handler - Rate Limit Handling and Auto-Retry

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/jobs/importStravaData.js`

**Step 1: Add RateLimitError import**

At top of file (line 3), add:

```javascript
const { RateLimitError } = require('../services/stravaRateLimitService');
```

**Step 2: Load cursor before sync**

After line 22 (`const encryptedTokens = await User.getStravaTokens(userId);`), add:

```javascript
    // Check for existing cursor (resuming partial import)
    const existingJob = await ImportJob.findById(jobId);
    const cursor = existingJob.sync_cursor;

    if (cursor) {
      console.log(`[STRAVA JOB] Resuming job ${jobId} from cursor:`, cursor);
    }
```

**Step 3: Pass cursor to fullHistoricalSync**

Change the fullHistoricalSync call (around line 31) from:
```javascript
result = await stravaSync.fullHistoricalSync(encryptedTokens, userId, async (progress) => {
```

To:
```javascript
result = await stravaSync.fullHistoricalSync(encryptedTokens, userId, cursor, async (progress) => {
```

**Step 4: Update progress callback to save cursor**

Replace the progress callback content (lines 32-36) with:

```javascript
        console.log(`Strava import ${jobId}: Progress update`, progress);

        // Update cursor if we have timestamp
        if (progress.oldestActivityTimestamp) {
          await ImportJob.updateCursor(jobId, {
            before: progress.oldestActivityTimestamp,
            activities_imported: progress.inserted || 0,
            photos_imported: 0
          });
        }

        await ImportJob.update(jobId, {
          totalImported: progress.inserted || 0,
          currentBatch: progress.detailed || 0
        });
```

**Step 5: Pass cursor to incrementalSync**

Change the incrementalSync call (around line 44) from:
```javascript
result = await stravaSync.incrementalSync(encryptedTokens, userId, lastSyncDate, async (progress) => {
```

To:
```javascript
result = await stravaSync.incrementalSync(encryptedTokens, userId, lastSyncDate, cursor, async (progress) => {
```

**Step 6: Update incremental progress callback**

Replace the incremental progress callback content (lines 45-49) with same as full sync:

```javascript
        console.log(`Strava import ${jobId}: Progress update`, progress);

        // Update cursor if we have timestamp
        if (progress.oldestActivityTimestamp) {
          await ImportJob.updateCursor(jobId, {
            before: progress.oldestActivityTimestamp,
            activities_imported: progress.inserted || 0,
            photos_imported: 0
          });
        }

        await ImportJob.update(jobId, {
          totalImported: progress.inserted || 0,
          currentBatch: progress.detailed || 0
        });
```

**Step 7: Add RateLimitError catch block**

After the existing catch block (after line 88), replace it with:

```javascript
  } catch (error) {
    console.error(`Strava import job ${jobId} failed:`, error);

    if (error.name === 'RateLimitError') {
      // Don't fail - schedule retry
      console.log(`[STRAVA JOB] Rate limit hit (${error.window}). Auto-retry at ${error.retryAfter}`);

      await ImportJob.markRateLimited(jobId, error.retryAfter);

      // Schedule delayed retry via pg-boss
      const delayMs = new Date(error.retryAfter) - new Date();
      const boss = getQueue();
      await boss.send('import-strava-data', job.data, {
        startAfter: delayMs,
        singletonKey: `strava-sync-${userId}` // Prevent duplicate jobs
      });

      console.log(`[STRAVA JOB] Scheduled retry in ${Math.round(delayMs / 1000)} seconds`);
      return; // Exit cleanly, no throw
    }

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    // CRITICAL: Don't re-throw rate limit errors - they need permanent failure, not retry
    // Rate limits will not be resolved by retrying immediately
    if (error.message && error.message.includes('Rate limit')) {
      console.log(`[STRAVA JOB] Rate limit error - not retrying job ${jobId}`);
      return; // Exit cleanly so pg-boss doesn't retry
    }

    // For other errors, re-throw to trigger pg-boss retry
    throw error;
  }
```

**Step 8: Verify syntax**

Run: `node -c server/jobs/importStravaData.js`

Expected: No errors

**Step 9: Commit**

```bash
git add server/jobs/importStravaData.js
git commit -m "feat(strava): add auto-retry on rate limit with cursor resumption"
```

---

## Task 9: Remove Old Retry Logic from OAuth Client

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/stravaOAuth.js`

**Step 1: Remove handleRateLimit method**

Delete the entire `handleRateLimit` method (lines 191-212).

**Step 2: Simplify makeAuthenticatedRequest rate limit handling**

Find the rate limit handling section (around line 296-304) and replace it with:

```javascript
        // Handle rate limiting - throw immediately, no retry
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        }
```

**Step 3: Remove retry loop**

Find the retry loop section (lines 265-268) and change:

From:
```javascript
    // Retry logic with exponential backoff for rate limits
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
```

To:
```javascript
    try {
```

**Step 4: Remove retry counter increment**

Delete the `retryCount++` and `continue` statements inside the rate limit handling.

**Step 5: Remove final error after loop**

Delete the final `throw new Error('Request failed after maximum retries');` at the end (line 355).

**Step 6: Verify syntax**

Run: `node -c server/services/stravaOAuth.js`

Expected: No errors

**Step 7: Commit**

```bash
git add server/services/stravaOAuth.js
git commit -m "refactor(strava): remove retry logic from OAuth client, defer to sync service"
```

---

## Task 10: Run Migrations on Production

**Files:**
- None (database operation)

**Step 1: Commit all changes before deployment**

Run: `git status`

Expected: Working tree clean

**Step 2: Push to GitHub**

Run: `git push origin main`

Expected: Push successful, triggers Render deployment

**Step 3: Wait for Render deployment**

Check Render dashboard or run: `npm run logs:view`

Expected: Deployment completes successfully

**Step 4: Run migration 013 on production**

Run: `node server/db/run-migration.js server/db/migrations/013_create_strava_api_requests.sql`

With production DATABASE_URL environment variable.

Expected: Migration 13 applied

**Step 5: Run migration 014 on production**

Run: `node server/db/run-migration.js server/db/migrations/014_add_import_jobs_cursor.sql`

Expected: Migration 14 applied

**Step 6: Verify migrations**

Run: `psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"`

Expected: Shows versions 14, 13, 12, 11, 10

---

## Task 11: Testing - Small Import (No Rate Limit)

**Files:**
- None (manual testing)

**Step 1: Reset last_strava_sync_at**

Run: `node server/scripts/reset-strava-sync.js`

Expected: Reset successful for user 1

**Step 2: Trigger sync from UI**

Navigate to app data sources page, click "Sync Strava"

Expected: Job starts

**Step 3: Monitor logs**

Run: `npm run logs:view`

Expected to see:
- `[STRAVA SYNC] Starting activity sync`
- `[STRAVA SYNC] Fetched X activities from API`
- `[STRAVA SYNC] Batch saved: X/Y activities`
- `[STRAVA SYNC] Activity sync complete: X imported`
- `Strava import job N completed: X items imported`

**Step 4: Check job status**

Query: `SELECT id, status, sync_cursor, retry_after FROM import_jobs ORDER BY id DESC LIMIT 1;`

Expected: status = 'completed', sync_cursor = null (or with data), retry_after = null

**Step 5: Verify no rate limit errors**

Run: `grep -i "rate limit" logs/render-stream.log | tail -20`

Expected: No "Rate limit exceeded" errors (may see "Rate limit" in comments)

---

## Task 12: Testing - Verify Rate Limit Detection (Manual Trigger)

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/scripts/test-rate-limit.js`

**Step 1: Create test script to exhaust quota**

```javascript
const { StravaRateLimitService } = require('../services/stravaRateLimitService');
const db = require('../db/connection');

async function testRateLimit() {
  const rateLimitService = new StravaRateLimitService();
  const testUserId = 1;

  console.log('Testing rate limit detection...');

  // Insert 96 fake requests (exceeds 95 limit)
  console.log('Inserting 96 fake API requests...');
  for (let i = 0; i < 96; i++) {
    await db.query(`
      INSERT INTO strava_api_requests (user_id, endpoint, requested_at)
      VALUES ($1, $2, NOW() - INTERVAL '1 minute')
    `, [testUserId, '/test']);
  }

  // Check quota
  const result = await rateLimitService.checkQuota(testUserId);
  console.log('Quota check result:', result);

  if (!result.allowed && result.limitType === '15min') {
    console.log('✅ Rate limit correctly detected!');
    console.log('Reset time:', result.resetAt);
  } else {
    console.log('❌ Rate limit NOT detected (expected to be blocked)');
  }

  // Cleanup
  await db.query('DELETE FROM strava_api_requests WHERE user_id = $1', [testUserId]);
  console.log('Cleaned up test data');

  process.exit(0);
}

testRateLimit().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

**Step 2: Run test script**

Run: `node server/scripts/test-rate-limit.js`

Expected:
- "Inserting 96 fake API requests..."
- "Quota check result: { allowed: false, limitType: '15min', resetAt: ... }"
- "✅ Rate limit correctly detected!"

**Step 3: Commit test script**

```bash
git add server/scripts/test-rate-limit.js
git commit -m "test(strava): add rate limit detection test script"
```

---

## Task 13: Documentation - Update CHANGELOG

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/CHANGELOG.md`

**Step 1: Add entry to CHANGELOG**

At the top of the file, add:

```markdown
## [Unreleased]

### Added
- **Strava rate-limited resumable sync** - Automatic handling of Strava API rate limits (100 req/15min, 1000 req/day)
  - Database-tracked API usage with proactive quota checks
  - Cursor-based sync position tracking for multi-day imports
  - Sequential request processing eliminates retry storms
  - Automatic retry scheduling via pg-boss delayed jobs
  - New 'rate_limited' job status for transparent UX
  - See design doc: `docs/plans/2025-01-16-strava-rate-limit-resumable-sync-design.md`

### Changed
- Strava sync now processes activity details sequentially instead of concurrently
- Removed exponential backoff retry logic from `stravaOAuth.js` (handled by sync service)
- Import jobs now track sync cursor and retry schedule

### Fixed
- Strava full historical imports no longer fail on rate limits
- Eliminated concurrent request retry storms
- Sync properly resumes from last position after rate limit pause
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for rate-limited resumable sync"
```

---

## Task 14: Final Verification and Deployment

**Files:**
- None (verification)

**Step 1: Verify all files committed**

Run: `git status`

Expected: Working tree clean (or only untracked test files)

**Step 2: Review commit history**

Run: `git log --oneline -15`

Expected: See all commits from this plan

**Step 3: Push to production**

Run: `git push origin main`

Expected: Push successful, Render deployment triggered

**Step 4: Monitor deployment**

Run: `npm run logs:view`

Expected: Deployment succeeds, server restarts cleanly

**Step 5: Verify production health**

Check app status in browser, verify no errors in logs

Expected: App loads, no startup errors

---

## Success Criteria

- [ ] Migrations 013 and 014 applied to production
- [ ] `strava_api_requests` table exists with indexes
- [ ] `import_jobs` has `sync_cursor` and `retry_after` columns
- [ ] Rate limit service correctly detects quota exhaustion
- [ ] Small imports complete without rate limit errors
- [ ] Rate limit errors trigger auto-retry (verify in logs)
- [ ] Cursor saves incrementally during sync
- [ ] Jobs resume from cursor after rate limit pause
- [ ] No retry storms in logs (sequential processing)
- [ ] Production deployment successful

## Notes

- **Conservative buffers:** 95/950 limits leave 5% safety margin
- **Cursor format:** `{before: unixTimestamp, activities_imported: N, photos_imported: N}`
- **Rate limit windows:** 15 minutes for short, 24 hours for daily
- **pg-boss singleton:** `singletonKey` prevents duplicate retry jobs
- **Don't update last_sync:** Keep NULL until fully complete to enable cursor resume

## Rollback Plan

If issues occur in production:

1. Revert to previous commit: `git revert HEAD~14..HEAD`
2. Push revert: `git push origin main`
3. Migrations 013/014 are additive (safe to leave in place)
4. Or drop tables if needed: `DROP TABLE strava_api_requests;`
