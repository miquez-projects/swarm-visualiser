# Daily Automatic Sync Design

**Date:** 2025-11-04
**Status:** Approved
**Author:** System Design

## Overview

Implement daily automatic synchronization of Foursquare check-ins for all active users. The system will run at 2:00 AM UTC daily, queuing individual import jobs for each user with staggered execution to respect API rate limits.

## Requirements

### Functional Requirements
- Automatically sync check-ins for all active users daily
- Run during low-traffic hours (2-4 AM UTC)
- Stagger user syncs with 2-minute delays between each user
- Retry failed syncs with exponential backoff (3 attempts)
- Skip users inactive for more than 30 days
- Reuse existing incremental sync logic (only fetch new check-ins)

### Non-Functional Requirements
- Reduce wasteful database connections from ~8,640/day to ~144/day
- Minimize impact on Foursquare API rate limits
- Handle up to 5 users initially (design scales to more)
- Idempotent execution (safe to run multiple times)

## Architecture

### Approach: Single Orchestrator Job

**Selected from alternatives:**
1. ✅ **Single orchestrator job** - Simple, reuses existing handler, natural retry handling
2. ❌ Recurring jobs per user - Complex user lifecycle management
3. ❌ Hybrid batch processor - Unnecessary complexity for current scale

### Core Components

```
2:00 AM UTC
    ↓
[Daily Orchestrator Job]
    ↓
Query active users
    ↓
┌─────────────────────────────┐
│ Queue import-checkins jobs  │
│ • User 1: startAfter 0 min  │
│ • User 2: startAfter 2 min  │
│ • User 3: startAfter 4 min  │
│ • User 4: startAfter 6 min  │
│ • User 5: startAfter 8 min  │
└─────────────────────────────┘
    ↓
[Existing import-checkins handler] × 5
    ↓
Incremental sync per user
```

## Implementation Details

### 1. New File: `server/jobs/dailySyncOrchestrator.js`

**Purpose:** Orchestrator handler that queues individual user syncs

**Logic:**
- Fetch active users via `User.findActive()`
- Calculate staggered delays (0, 2, 4, 6, 8 minutes...)
- Queue `import-checkins` job for each user with `startAfter` delay
- Log summary: "Queued N users for daily sync"

**Key Code Pattern:**
```javascript
const users = await User.findActive();
const queue = getQueue();

for (let i = 0; i < users.length; i++) {
  const delayMinutes = i * 2;
  await queue.send('import-checkins',
    { jobId, userId: users[i].id },
    { startAfter: `${delayMinutes} minutes` }
  );
}
```

### 2. Update: `server/models/user.js`

**New Method:** `findActive()`

```javascript
static async findActive() {
  const query = `
    SELECT * FROM users
    WHERE access_token_encrypted IS NOT NULL
    AND last_login_at > NOW() - INTERVAL '30 days'
  `;
  const result = await db.query(query);
  return result.rows;
}
```

**Assumption:** `last_login_at` column exists (will create migration if needed)

### 3. Update: `server/jobs/queue.js`

**Configuration Changes:**

```javascript
const { pool } = require('../db/connection');

boss = new PgBoss({
  db: pool,  // ← Use shared connection pool (was connectionString)
  maintenanceIntervalSeconds: 600,  // 10 minutes (was 300)
  retentionDays: 1,
  monitorStateIntervalSeconds: 60,  // 1 minute (was 10)
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true
});
```

**Register Handler:**
```javascript
await queue.work('daily-sync-orchestrator', orchestratorHandler);
```

**Schedule Job:**
```javascript
await queue.schedule('daily-sync-orchestrator', '0 2 * * *', {}, { tz: 'UTC' });
```

### 4. Update: Auth Middleware

**Track User Activity:**
- Update `last_login_at` timestamp in `authenticateToken` middleware
- Ensures activity tracking for 30-day filter

## Data Model

### Required Changes

**Migration:** Add `last_login_at` column if not exists

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
UPDATE users SET last_login_at = NOW() WHERE last_login_at IS NULL;
```

**No changes to existing tables:** ImportJob and Checkins tables work as-is

## Error Handling

### Error Scenarios

| Scenario | Detection | Recovery | User Impact |
|----------|-----------|----------|-------------|
| Expired OAuth token | 401 from Foursquare API | Retry 3x (will fail), mark job failed | User must re-authenticate |
| API rate limit | 429 from Foursquare API | Retry with backoff | Delayed sync, eventual success |
| Network timeout | Connection error | Retry 3x with backoff | Delayed sync, eventual success |
| Orchestrator crash | Partial job queue | Next day catches up | 1-day delay for some users |
| Duplicate run | Detect existing jobs | Skip already-running imports | No duplicates |

### Retry Configuration

- **Attempts:** 3 retries after initial attempt
- **Delays:** 1 minute, 2 minutes, 4 minutes (exponential backoff)
- **Outcome:** Job marked as failed if all retries exhausted
- **Handled by:** pg-boss built-in retry mechanism

### Logging

**Structured Logging Pattern:**
```javascript
console.log('[DAILY-SYNC]', {
  event: 'orchestrator_started',
  activeUsers: count,
  timestamp: new Date().toISOString()
});
```

**Key Log Points:**
- Orchestrator start/completion
- User count queued
- Individual job start/failure
- Sync summary per user (count of new check-ins)

## Monitoring

### Health Checks

**Orchestrator Health:**
```sql
SELECT * FROM pgboss.job
WHERE name = 'daily-sync-orchestrator'
ORDER BY createdon DESC LIMIT 10;
```

**Daily Success Rate:**
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM import_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

**Repeated Failures:**
```sql
SELECT user_id, COUNT(*) as failure_count
FROM import_jobs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) >= 3;
```

### Database Connection Metrics

**Before:** ~8,640 connections/day (every 10 seconds)
**After:** ~144 connections/day (every 10 minutes)
**Reduction:** 98.3%

## Testing Strategy

### Local Testing

1. **Manual Trigger:**
   ```javascript
   const queue = getQueue();
   await queue.send('daily-sync-orchestrator');
   ```

2. **Verify Job Queue:**
   - Check 5 import-checkins jobs created
   - Confirm staggered `startAfter` values (0, 2, 4, 6, 8 min)
   - Monitor job progression in pgboss.job table

3. **Edge Cases:**
   - User with no new check-ins
   - User inactive 31 days (should skip)
   - Concurrent manual import (should handle gracefully)

### Production Testing

1. Deploy to Render
2. Monitor first scheduled run at 2:00 AM UTC
3. Check logs for all 5 users completing
4. Verify database connection reduction in Render logs
5. Confirm check-ins imported successfully

## Configuration Values

**For 5 Users:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Schedule | `0 2 * * *` (2:00 AM UTC) | Low-traffic hours |
| Stagger delay | 2 minutes | 10 minutes total for 5 users |
| Monitor interval | 60 seconds | Adequate for daily jobs |
| Maintenance interval | 600 seconds (10 min) | Reduced from 5 min |
| Retry attempts | 3 | Handles transient errors |
| Retry backoff | Exponential (1, 2, 4 min) | Progressive delay |
| Inactive threshold | 30 days | Balance freshness vs resources |

## Deployment Checklist

- [ ] Create migration for `last_login_at` column (if needed)
- [ ] Update pg-boss configuration (shared pool, reduced intervals)
- [ ] Add `User.findActive()` method
- [ ] Create `server/jobs/dailySyncOrchestrator.js`
- [ ] Register orchestrator handler in queue.js
- [ ] Schedule daily job in initQueue()
- [ ] Update auth middleware to track `last_login_at`
- [ ] Deploy to Render
- [ ] Monitor first scheduled run
- [ ] Verify database connection reduction

## Future Enhancements

**Not in Scope for Initial Release:**

- Email notifications for failed syncs
- Admin dashboard for sync monitoring
- Dynamic stagger interval based on user count
- Per-user sync preferences (frequency, time)
- Webhook callbacks on sync completion
- Pause/resume sync for specific users

## Success Criteria

✅ All active users synced daily
✅ Database connections reduced by >95%
✅ No duplicate imports during scheduled syncs
✅ Failed syncs retry automatically
✅ Inactive users (>30 days) skipped
✅ Existing manual import functionality unchanged
