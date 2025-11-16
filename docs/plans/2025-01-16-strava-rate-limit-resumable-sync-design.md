# Strava Rate-Limited Resumable Sync Design

**Date:** 2025-01-16
**Status:** Approved

## Problem Statement

The current Strava sync implementation has two critical issues:

### 1. Retry Storm on Rate Limits
- Concurrent batch processing (`Promise.allSettled` with 10 requests)
- Each request retries 3 times on 429 errors
- Creates storms of 30+ requests when hitting rate limits
- Wastes API quota and delays completion

### 2. Cannot Complete Large Historical Imports
- Strava limits: **100 requests per 15 minutes**, **1000 per day**
- Full historical sync of active athlete = 500+ API calls
- When job hits rate limit and fails:
  - Some activities already imported
  - `last_strava_sync_at` stays NULL (to retry full sync)
  - Next sync starts from beginning → duplicates
- Creates catch-22: can't resume, can't complete

## Design Goals

1. **Eliminate retry storms** - proactive quota checking, not reactive
2. **Support multi-day imports** - auto-resume after rate limit cooldowns
3. **Track progress** - cursor-based resumption from where we left off
4. **Preserve data** - no lost activities due to partial imports
5. **User transparency** - clear status when waiting for rate limits

## Solution Overview

Implement rate-limited resumable sync with:
- Database-tracked API usage quotas
- Cursor-based sync position tracking
- Sequential request processing with proactive quota checks
- Automatic retry scheduling via pg-boss delayed jobs

## Architecture

### 1. Rate Limit Tracking (Database-First)

**New Table: `strava_api_requests`**

```sql
CREATE TABLE strava_api_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strava_requests_time ON strava_api_requests(requested_at);
CREATE INDEX idx_strava_requests_user ON strava_api_requests(user_id, requested_at);
```

**Purpose:**
- Log every Strava API call
- Query quota usage for both time windows
- Calculate when quota resets
- Works even if Strava headers missing/incorrect

**New Service: `stravaRateLimitService.js`**

```javascript
class StravaRateLimitService {
  async checkQuota(userId) {
    // Count requests in last 15 minutes
    const shortWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1 AND requested_at > NOW() - INTERVAL '15 minutes'
    `, [userId]);

    // Count requests in last 24 hours
    const dailyWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1 AND requested_at > NOW() - INTERVAL '24 hours'
    `, [userId]);

    // Conservative limits: 95/950 (leave 5% buffer)
    if (shortWindow.rows[0].count >= 95) {
      return {
        allowed: false,
        limitType: '15min',
        resetAt: await this.getResetTime('15min', userId)
      };
    }

    if (dailyWindow.rows[0].count >= 950) {
      return {
        allowed: false,
        limitType: 'daily',
        resetAt: await this.getResetTime('daily', userId)
      };
    }

    return { allowed: true };
  }

  async recordRequest(userId, endpoint) {
    await db.query(`
      INSERT INTO strava_api_requests (user_id, endpoint, requested_at)
      VALUES ($1, $2, NOW())
    `, [userId, endpoint]);
  }

  async getResetTime(limitType, userId) {
    const query = limitType === '15min'
      ? `SELECT requested_at FROM strava_api_requests
         WHERE user_id = $1
         ORDER BY requested_at ASC
         LIMIT 1 OFFSET 95`
      : `SELECT requested_at FROM strava_api_requests
         WHERE user_id = $1 AND requested_at > NOW() - INTERVAL '24 hours'
         ORDER BY requested_at ASC
         LIMIT 1`;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return new Date(Date.now() + (limitType === '15min' ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000));
    }

    const oldestRequest = new Date(result.rows[0].requested_at);
    const windowDuration = limitType === '15min' ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return new Date(oldestRequest.getTime() + windowDuration);
  }
}
```

### 2. Cursor-Based Sync Position Tracking

**Enhanced `import_jobs` table:**

```sql
ALTER TABLE import_jobs ADD COLUMN sync_cursor JSONB;
ALTER TABLE import_jobs ADD COLUMN retry_after TIMESTAMP;
```

**Cursor Format:**

```json
{
  "before": 1672531200,
  "activities_imported": 150,
  "photos_imported": 45,
  "last_activity_id": "123456789"
}
```

**Fields:**
- `before`: Unix timestamp of oldest imported activity (for Strava API pagination)
- `activities_imported`: Running total for progress tracking
- `photos_imported`: Running total for progress tracking
- `last_activity_id`: Debugging/verification (not used for sync logic)

**Sync Flow:**

1. **Start sync** → Check for existing job with cursor
   - Cursor exists → Resume from `sync_cursor.before` timestamp
   - No cursor → Start from beginning (no `before` param)

2. **During sync** → Save cursor every 50 activities
   - Update `sync_cursor` with oldest activity timestamp
   - Use Strava API: `GET /activities?before={timestamp}`

3. **Hit rate limit** → Determine cooldown period
   - 15-min limit → Schedule retry in 15 minutes
   - Daily limit → Schedule retry in 24 hours
   - Set `retry_after` timestamp
   - Mark job as `'rate_limited'`

4. **Auto-resume** → pg-boss delayed job fires
   - Load job with cursor
   - Continue from `sync_cursor.before`
   - Repeat until complete

### 3. Sequential Request Processing

**Current Problem:**
```javascript
// Concurrent batch - creates retry storms
await Promise.allSettled(
  batch.map(summary => stravaOAuth.makeAuthenticatedRequest(...))
);
```

**New Approach:**

```javascript
// In stravaSync.js
async fetchActivityDetailsWithRateLimit(activityIds, encryptedTokens, userId) {
  const detailed = [];

  for (const id of activityIds) {
    // Check quota BEFORE making request
    const canProceed = await rateLimitService.checkQuota(userId);

    if (!canProceed.allowed) {
      // Quota exhausted - throw with retry info
      throw new RateLimitError({
        window: canProceed.limitType,
        retryAfter: canProceed.resetAt
      });
    }

    // Make request
    const activity = await stravaOAuth.makeAuthenticatedRequest(
      encryptedTokens,
      `/activities/${id}`,
      {}
    );

    // Record successful request
    await rateLimitService.recordRequest(userId, '/activities/*');

    detailed.push(activity.data || activity);
  }

  return detailed;
}
```

**Benefits:**
- No retry storms - single check before each request
- Proactive (catch before 429) instead of reactive
- Can calculate exact "retry after" time
- Sequential = slower but respectful of limits

**Remove Existing Retry Logic:**

```javascript
// In stravaOAuth.js - REMOVE exponential backoff retry loop
// Replace with immediate failure on 429
if (error.response?.status === 429) {
  throw new Error('Rate limit exceeded');
}
```

Rate limit handling moves to sync service, not OAuth client.

### 4. Auto-Retry Job Scheduling

**Enhanced Job Handler (`importStravaData.js`):**

```javascript
async function importStravaDataHandler(job) {
  const { jobId, userId, syncType = 'incremental' } = job.data;

  try {
    await ImportJob.markStarted(jobId);
    const encryptedTokens = await User.getStravaTokens(userId);

    // Check for existing cursor (resuming partial import)
    const existingJob = await ImportJob.findById(jobId);
    const cursor = existingJob.sync_cursor;

    let result;

    if (syncType === 'full') {
      result = await stravaSync.fullHistoricalSync(
        encryptedTokens,
        userId,
        cursor,  // Pass cursor for resume
        async (progress) => {
          // Update cursor on progress
          await ImportJob.updateCursor(jobId, {
            before: progress.oldestActivityTimestamp,
            activities_imported: progress.inserted,
            photos_imported: progress.photosInserted
          });
        }
      );
    } else {
      // Incremental sync
      const user = await User.findById(userId);
      result = await stravaSync.incrementalSync(
        encryptedTokens,
        userId,
        user.last_strava_sync_at,
        async (progress) => {
          await ImportJob.updateCursor(jobId, {
            activities_imported: progress.inserted
          });
        }
      );
    }

    // Completed successfully
    await ImportJob.markCompleted(jobId);

    // Only update last_sync if items imported AND no more to fetch
    const totalImported = (result.activities?.imported || 0) + (result.photos?.photosInserted || 0);
    if (totalImported > 0 && !cursor) {
      await User.updateLastStravaSync(userId);
    }

  } catch (error) {
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

      return; // Exit cleanly, no throw
    }

    // Other errors - fail the job
    await ImportJob.markFailed(jobId, error.message);
    throw error;
  }
}
```

**New Job Status: `'rate_limited'`**

Add to job status enum:
- `queued` → waiting to start
- `started` → currently running
- `rate_limited` → paused, auto-retry scheduled
- `completed` → finished successfully
- `failed` → error occurred

**New Model Methods:**

```javascript
// In models/importJob.js
static async markRateLimited(jobId, retryAfter) {
  return db.query(`
    UPDATE import_jobs
    SET status = 'rate_limited', retry_after = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [jobId, retryAfter]);
}

static async updateCursor(jobId, cursor) {
  return db.query(`
    UPDATE import_jobs
    SET sync_cursor = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [jobId, JSON.stringify(cursor)]);
}
```

### 5. Updated Sync Service

**Key Changes to `stravaSync.js`:**

```javascript
async syncActivities(encryptedTokens, userId, afterDate = null, cursor = null, onProgress = null) {
  console.log(`[STRAVA SYNC] Starting activity sync for user ${userId}`);
  console.log(`[STRAVA SYNC] afterDate: ${afterDate}, cursor: ${JSON.stringify(cursor)}`);

  // Determine starting point
  let beforeTimestamp = null;
  if (cursor && cursor.before) {
    beforeTimestamp = cursor.before;
    console.log(`[STRAVA SYNC] Resuming from cursor: ${new Date(beforeTimestamp * 1000).toISOString()}`);
  }

  const after = afterDate ? Math.floor(afterDate.getTime() / 1000) : null;

  let allActivities = [];
  let page = 1;
  const perPage = 200;

  try {
    // Fetch activities in pages
    while (true) {
      const params = { page, per_page: perPage };

      if (after) params.after = after;
      if (beforeTimestamp) params.before = beforeTimestamp;

      // Check quota before fetching
      const canProceed = await rateLimitService.checkQuota(userId);
      if (!canProceed.allowed) {
        throw new RateLimitError({
          window: canProceed.limitType,
          retryAfter: canProceed.resetAt
        });
      }

      const response = await stravaOAuth.makeAuthenticatedRequest(
        encryptedTokens,
        '/athlete/activities',
        params
      );

      await rateLimitService.recordRequest(userId, '/athlete/activities');

      let activities;
      if (response && typeof response === 'object' && response.data) {
        activities = response.data;
      } else {
        activities = response;
      }

      if (!activities || activities.length === 0) break;

      allActivities = allActivities.concat(activities);
      page++;

      if (onProgress) {
        await onProgress({ fetched: allActivities.length });
      }

      if (allActivities.length >= 10000) {
        console.log(`[STRAVA SYNC] Reached safety limit`);
        break;
      }

      if (activities.length < perPage) break;
    }

    console.log(`[STRAVA SYNC] Fetched ${allActivities.length} activities from API`);

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

    // Insert remaining activities
    if (detailedActivities.length > 0) {
      const activitiesToInsert = detailedActivities.map(a =>
        this.transformActivity(a, userId)
      );
      const insertedCount = await StravaActivity.bulkInsert(activitiesToInsert);
      totalInserted += insertedCount;

      console.log(`[STRAVA SYNC] Final batch saved: ${insertedCount}/${activitiesToInsert.length}`);
    }

    console.log(`[STRAVA SYNC] Activity sync complete: ${totalInserted} imported`);

    return { imported: totalInserted, fetched: allActivities.length };
  } catch (error) {
    if (error.name === 'RateLimitError') {
      throw error; // Re-throw to be caught by job handler
    }
    console.error(`[STRAVA SYNC] Activity sync error:`, error.message);
    throw error;
  }
}
```

## Comparison: Foursquare vs Strava

| Service | Short Window | Daily Limit | Strategy |
|---------|-------------|-------------|----------|
| **Foursquare** | None (or very high) | ~500 calls | Fail fast, no auto-retry |
| **Strava** | 100 / 15 min | 1000 / day | Auto-retry with delays |

**Why Different Strategies:**

**Foursquare:**
- Higher daily budget relative to typical imports
- Checkin import usually completes in one session
- Rate limit = likely bug or excessive use
- Strategy: Fail immediately, let user investigate

**Strava:**
- Low 15-minute window (100 requests)
- Full historical sync of active athlete = easily 500+ requests
- Rate limits are **expected** for large imports
- Strategy: Auto-retry across hours/days until complete

## User Experience

**Happy Path (Small Import):**
1. User clicks "Sync Strava"
2. Job starts, imports 50 activities in 3 minutes
3. Status: "Completed: 50 activities imported"

**Rate-Limited Path (Large Import):**
1. User clicks "Sync Strava"
2. Job starts, imports 95 activities (hits 15-min limit)
3. Status: "Rate limited, resuming at 2:15 PM"
4. Job auto-resumes at 2:15 PM
5. Imports another 95 activities (hits limit again)
6. Status: "Rate limited, resuming at 2:30 PM"
7. Continues until complete
8. Final status: "Completed: 847 activities imported"

**Daily Limit Reached:**
1. Import in progress, hits 950 requests
2. Status: "Rate limited, resuming tomorrow at 8:00 AM"
3. Auto-resumes next day
4. Completes remaining activities

## Implementation Checklist

1. **Database schema:**
   - [ ] Create `strava_api_requests` table
   - [ ] Add `sync_cursor` JSONB column to `import_jobs`
   - [ ] Add `retry_after` TIMESTAMP column to `import_jobs`
   - [ ] Add `'rate_limited'` to job status enum

2. **New service:**
   - [ ] Create `stravaRateLimitService.js`
   - [ ] Implement `checkQuota(userId)`
   - [ ] Implement `recordRequest(userId, endpoint)`
   - [ ] Implement `getResetTime(limitType, userId)`

3. **Update sync service:**
   - [ ] Add cursor parameter to `syncActivities()`
   - [ ] Replace concurrent batching with sequential
   - [ ] Add quota checks before each request
   - [ ] Update cursor in onProgress callback
   - [ ] Throw `RateLimitError` with retry info

4. **Update job handler:**
   - [ ] Load cursor from job
   - [ ] Pass cursor to sync functions
   - [ ] Catch `RateLimitError`
   - [ ] Mark job as `'rate_limited'`
   - [ ] Schedule delayed retry via pg-boss

5. **Update model:**
   - [ ] Add `ImportJob.markRateLimited(jobId, retryAfter)`
   - [ ] Add `ImportJob.updateCursor(jobId, cursor)`

6. **Remove old retry logic:**
   - [ ] Remove exponential backoff from `stravaOAuth.js`
   - [ ] Remove `handleRateLimit()` method
   - [ ] Simplify error handling to immediate throw

7. **Testing:**
   - [ ] Test small import (< 100 activities)
   - [ ] Test large import with 15-min limit
   - [ ] Test daily limit scenario
   - [ ] Test cursor resumption after interrupt
   - [ ] Verify no duplicate activities

## Success Criteria

- [ ] Full historical sync completes across multiple days
- [ ] No retry storms (at most 1 request per activity)
- [ ] No duplicate activities imported
- [ ] Clear job status during rate limit pauses
- [ ] Automatic resumption without user intervention
- [ ] Both 15-minute and daily limits respected

## Notes

- **Conservative quota buffers:** Use 95/950 instead of 100/1000 to avoid edge cases
- **Cursor saves incrementally:** Every 50 activities to preserve progress
- **Sequential only for detail requests:** Activity list fetching can still be paginated normally
- **Singleton jobs:** Use `singletonKey` to prevent duplicate retry jobs
- **Don't update `last_sync` until complete:** Prevents data loss on partial imports
