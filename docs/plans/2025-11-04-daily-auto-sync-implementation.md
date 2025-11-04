# Daily Auto-Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement daily automatic synchronization of Foursquare check-ins for all active users.

**Architecture:** Single orchestrator job runs at 2:00 AM UTC, queries active users, and queues individual import-checkins jobs with 2-minute stagger delays. Reuses existing import handler with incremental sync logic. Uses shared connection pool to reduce database connections from ~8,640/day to ~144/day.

**Tech Stack:** pg-boss (job queue), PostgreSQL, Node.js, Express

**Design Document:** See `docs/plans/2025-11-04-daily-auto-sync-design.md`

---

## Task 1: Add Database Migration for last_login_at Column

**Files:**
- Create: `server/db/migrations/002_add_last_login_at.sql`

**Step 1: Create migration file**

Create `server/db/migrations/002_add_last_login_at.sql`:

```sql
-- Migration: Add last_login_at column to users table
-- Date: 2025-11-04
-- Description: Tracks user activity for daily sync filtering (skip users inactive > 30 days)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Set initial value to NOW() for existing users
UPDATE users
SET last_login_at = NOW()
WHERE last_login_at IS NULL;

-- Create index for performance (filtering by last_login_at in daily sync)
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
```

**Step 2: Verify migration file syntax**

Run: `cat server/db/migrations/002_add_last_login_at.sql`
Expected: File contents display without errors

**Step 3: Commit migration**

```bash
git add server/db/migrations/002_add_last_login_at.sql
git commit -m "feat: add migration for last_login_at column

Adds last_login_at timestamp to track user activity.
Used to filter active users for daily sync (skip inactive > 30 days).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Update User Model with findActive Method

**Files:**
- Modify: `server/models/user.js:125-135`

**Step 1: Add findActive method**

Add after the `findAll()` method (line 134):

```javascript
  /**
   * Get all active users (for daily sync)
   * Active = has access token AND logged in within last 30 days
   * @returns {Promise<Array>}
   */
  static async findActive() {
    const query = `
      SELECT * FROM users
      WHERE access_token_encrypted IS NOT NULL
      AND last_login_at > NOW() - INTERVAL '30 days'
      ORDER BY id ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }
```

**Step 2: Update findAll comment**

Update the comment at line 127 from "for weekly sync cron job" to "for admin purposes":

```javascript
  /**
   * Get all users (for admin purposes)
   * @returns {Promise<Array>}
   */
```

**Step 3: Verify syntax**

Run: `node -c server/models/user.js`
Expected: No output (syntax valid)

**Step 4: Commit**

```bash
git add server/models/user.js
git commit -m "feat: add User.findActive method for daily sync

Returns users with tokens who logged in within last 30 days.
Used by daily sync orchestrator to filter active users.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Auth Middleware to Track last_login_at

**Files:**
- Modify: `server/middleware/auth.js:19-32`

**Step 1: Add last_login_at update in authenticateToken**

After line 19 (`const user = await User.findBySecretToken(token);`), add last_login_at update:

```javascript
    const user = await User.findBySecretToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired'
      });
    }

    // Update last login timestamp for activity tracking
    await User.update(user.id, { lastLoginAt: new Date() });

    // Attach user to request
    req.user = user;
    req.token = token;
```

**Step 2: Add last_login_at update in optionalAuth**

After line 51 (`if (user) {`), add update:

```javascript
    if (token) {
      const user = await User.findBySecretToken(token);
      if (user) {
        // Update last login timestamp
        await User.update(user.id, { lastLoginAt: new Date() });

        req.user = user;
        req.token = token;
      }
    }
```

**Step 3: Verify syntax**

Run: `node -c server/middleware/auth.js`
Expected: No output (syntax valid)

**Step 4: Commit**

```bash
git add server/middleware/auth.js
git commit -m "feat: track user login activity in auth middleware

Updates last_login_at timestamp on each authenticated request.
Enables filtering active users for daily sync.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create Daily Sync Orchestrator Handler

**Files:**
- Create: `server/jobs/dailySyncOrchestrator.js`

**Step 1: Create orchestrator handler**

Create `server/jobs/dailySyncOrchestrator.js`:

```javascript
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('./queue');

/**
 * Daily sync orchestrator job handler
 * Runs once per day to queue check-in imports for all active users
 *
 * Active users = users with tokens who logged in within last 30 days
 * Jobs are staggered with 2-minute delays to respect API rate limits
 *
 * @param {Object} job - pg-boss job object
 */
async function dailySyncOrchestrator(job) {
  console.log('[DAILY-SYNC] Orchestrator started');

  try {
    // Fetch all active users
    const activeUsers = await User.findActive();

    console.log(`[DAILY-SYNC] Found ${activeUsers.length} active users`);

    if (activeUsers.length === 0) {
      console.log('[DAILY-SYNC] No active users to sync');
      return;
    }

    const queue = getQueue();
    let queuedCount = 0;

    // Queue import job for each user with staggered delays
    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      const delayMinutes = i * 2; // 0, 2, 4, 6, 8... minutes

      // Check if user already has a running import
      const existingJobs = await ImportJob.findByUserId(user.id);
      const runningJob = existingJobs.find(
        j => j.status === 'running' || j.status === 'pending'
      );

      if (runningJob) {
        console.log(
          `[DAILY-SYNC] Skipping user ${user.id} - import already in progress (job ${runningJob.id})`
        );
        continue;
      }

      // Create import job record
      const importJob = await ImportJob.create({
        userId: user.id,
        status: 'pending'
      });

      // Queue the import with delay
      await queue.send(
        'import-checkins',
        {
          jobId: importJob.id,
          userId: user.id
        },
        {
          startAfter: delayMinutes > 0 ? `${delayMinutes} minutes` : '0 seconds'
        }
      );

      queuedCount++;

      console.log(
        `[DAILY-SYNC] Queued user ${user.id} (${user.display_name}) - starts in ${delayMinutes} min`
      );
    }

    console.log(`[DAILY-SYNC] Orchestrator completed - queued ${queuedCount}/${activeUsers.length} users`);

  } catch (error) {
    console.error('[DAILY-SYNC] Orchestrator failed:', error);
    throw error; // Re-throw so pg-boss marks as failed
  }
}

module.exports = dailySyncOrchestrator;
```

**Step 2: Verify syntax**

Run: `node -c server/jobs/dailySyncOrchestrator.js`
Expected: No output (syntax valid)

**Step 3: Commit**

```bash
git add server/jobs/dailySyncOrchestrator.js
git commit -m "feat: add daily sync orchestrator handler

Orchestrates daily check-in imports for all active users.
Queries active users and queues import jobs with 2-min stagger.
Skips users with running imports to prevent duplicates.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update pg-boss Configuration and Register Handlers

**Files:**
- Modify: `server/jobs/queue.js:1-67`

**Step 1: Update imports**

At the top of the file (line 1), update imports:

```javascript
const PgBoss = require('pg-boss');
const { pool } = require('../db/connection');
const dailySyncOrchestrator = require('./dailySyncOrchestrator');
```

**Step 2: Update pg-boss configuration**

Replace the configuration block (lines 14-22) with:

```javascript
  boss = new PgBoss({
    db: pool,  // Use shared connection pool instead of connectionString
    // Run maintenance every 10 minutes
    maintenanceIntervalSeconds: 600,
    // Delete completed jobs after 1 day
    retentionDays: 1,
    // Monitor state changes every 60 seconds (was 10)
    monitorStateIntervalSeconds: 60,
    // Retry configuration
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });
```

**Step 3: Register orchestrator handler**

After line 34 (`await boss.start();`), add handler registration and scheduling:

```javascript
  await boss.start();
  console.log('pg-boss job queue started');

  // Register daily sync orchestrator handler
  await boss.work('daily-sync-orchestrator', dailySyncOrchestrator);
  console.log('Registered handler: daily-sync-orchestrator');

  // Schedule daily sync at 2:00 AM UTC
  await boss.schedule('daily-sync-orchestrator', '0 2 * * *', {}, { tz: 'UTC' });
  console.log('Scheduled daily-sync-orchestrator: 2:00 AM UTC daily');

  return boss;
```

**Step 4: Verify syntax**

Run: `node -c server/jobs/queue.js`
Expected: No output (syntax valid)

**Step 5: Commit**

```bash
git add server/jobs/queue.js
git commit -m "feat: optimize pg-boss config and add daily sync scheduling

Changes:
- Use shared connection pool (reduces connections 98.3%)
- Increase monitor interval to 60s (was 10s)
- Increase maintenance interval to 600s (was 300s)
- Add retry configuration (3 attempts, exponential backoff)
- Register daily-sync-orchestrator handler
- Schedule daily sync at 2:00 AM UTC

Reduces DB connections from ~8,640/day to ~144/day.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Run Migration Locally (Testing)

**Files:**
- None (database operation)

**Step 1: Run migration**

Run: `node server/db/run-migration.js migrations/002_add_last_login_at.sql`

Expected output:
```
Running migration: migrations/002_add_last_login_at.sql
Executing SQL...
✅ Migration completed successfully
```

**Step 2: Verify column exists**

Run query to check column:
```bash
psql $DATABASE_URL -c "\d users"
```

Expected: `last_login_at | timestamp without time zone` in column list

---

## Task 7: Manual Test - Trigger Orchestrator Locally

**Files:**
- None (manual testing)

**Step 1: Start server**

Run: `npm run dev:server`
Expected: Server starts, pg-boss initializes, daily-sync-orchestrator registered

**Step 2: Manually trigger orchestrator**

In Node REPL or separate script:
```javascript
const { getQueue } = require('./server/jobs/queue');

async function test() {
  const queue = getQueue();
  await queue.send('daily-sync-orchestrator');
  console.log('Orchestrator job queued');
}

test();
```

**Step 3: Monitor logs**

Expected logs:
```
[DAILY-SYNC] Orchestrator started
[DAILY-SYNC] Found N active users
[DAILY-SYNC] Queued user 1 (...) - starts in 0 min
[DAILY-SYNC] Queued user 2 (...) - starts in 2 min
[DAILY-SYNC] Orchestrator completed - queued N/N users
```

**Step 4: Verify import jobs created**

Query: `SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 10;`
Expected: New pending/running jobs for active users

**Step 5: Verify jobs execute**

Wait 5-10 minutes and check:
- import-checkins jobs run successfully
- Check-ins imported for users
- No errors in logs

---

## Task 8: Update Documentation

**Files:**
- Modify: `README.md`

**Step 1: Add daily sync section**

After line 10 (features section), add:

```markdown
- **Daily Auto-Sync**: Automatic check-in synchronization at 2 AM UTC
```

**Step 2: Add setup note**

In the "Getting Started" section after the database setup, add:

```markdown
### Database Migrations

Run all migrations to ensure schema is up-to-date:
```bash
node server/db/run-migration.js migrations/001_add_multi_user_support.sql
node server/db/run-migration.js migrations/002_add_last_login_at.sql
```
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add daily auto-sync feature to README

Documents new daily sync feature and migration setup.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Deployment Preparation

**Files:**
- Create: `DEPLOYMENT_NOTES.md` (in docs/)

**Step 1: Create deployment notes**

Create `docs/DEPLOYMENT_NOTES_DAILY_SYNC.md`:

```markdown
# Daily Auto-Sync Deployment Notes

## Pre-Deployment Checklist

- [ ] Review design document: `docs/plans/2025-11-04-daily-auto-sync-design.md`
- [ ] All tests passing locally
- [ ] Migration tested locally
- [ ] Manual orchestrator test successful

## Deployment Steps

### 1. Run Migration on Production Database

```bash
# SSH into Render or use database console
node server/db/run-migration.js migrations/002_add_last_login_at.sql
```

### 2. Verify Migration

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'last_login_at';
```

Expected: Returns one row with column info.

### 3. Deploy Code to Render

```bash
git push origin feature/daily-auto-sync
# Then merge to main and push
```

### 4. Monitor First Scheduled Run

- Check Render logs at 2:00 AM UTC next day
- Verify orchestrator runs and queues users
- Verify import jobs execute successfully
- Check database logs for connection reduction

### 5. Verify Database Connection Reduction

**Before:** ~8,640 connections/day (every 10 seconds)
**After:** ~144 connections/day (every 10 minutes)

Check Render database metrics 24 hours after deployment.

## Rollback Plan

If issues occur:

1. Remove schedule: Comment out `boss.schedule()` in queue.js
2. Redeploy without scheduling
3. Daily sync stops, manual imports still work
4. Investigate and fix issues
5. Re-enable when ready

## Monitoring Queries

### Check Orchestrator Runs
```sql
SELECT * FROM pgboss.job
WHERE name = 'daily-sync-orchestrator'
ORDER BY createdon DESC
LIMIT 10;
```

### Check Import Success Rate
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success
FROM import_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

## Expected Behavior

- Orchestrator runs daily at 2:00 AM UTC
- Queries 5 active users (current scale)
- Queues 5 import jobs with 0, 2, 4, 6, 8 minute delays
- Total sync window: ~10-15 minutes
- Each user imports only new check-ins (incremental)
- Failed syncs retry 3 times with backoff

## Success Criteria

✅ Orchestrator runs daily without errors
✅ All active users synced within 30 minutes
✅ Database connections reduced >95%
✅ No duplicate imports
✅ Manual imports still work
```

**Step 2: Commit**

```bash
git add docs/DEPLOYMENT_NOTES_DAILY_SYNC.md
git commit -m "docs: add deployment notes for daily auto-sync

Includes pre-flight checklist, deployment steps, rollback plan,
and monitoring queries for production deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

**Tasks Completed:**
1. ✅ Database migration for `last_login_at` column
2. ✅ User model `findActive()` method
3. ✅ Auth middleware tracks user login activity
4. ✅ Daily sync orchestrator handler
5. ✅ pg-boss configuration optimization
6. ✅ Handler registration and scheduling
7. ✅ Local testing instructions
8. ✅ Documentation updates
9. ✅ Deployment notes

**Key Configuration Changes:**
- Monitor interval: 10s → 60s (6x reduction)
- Maintenance interval: 300s → 600s (2x reduction)
- Connection strategy: New per-poll → Shared pool
- **Result:** 98.3% reduction in database connections

**Testing Before Merge:**
1. Run migration locally
2. Start server and verify pg-boss initializes
3. Manually trigger orchestrator
4. Verify import jobs queued with delays
5. Wait for jobs to execute
6. Confirm check-ins imported successfully

**Production Deployment:**
1. Run migration on production DB
2. Deploy code to Render
3. Monitor first scheduled run at 2:00 AM UTC
4. Verify connection reduction in database logs

**Post-Deployment:**
- Monitor orchestrator runs daily
- Check import success rates
- Verify no user complaints about stale data
- Confirm database connection metrics improved
