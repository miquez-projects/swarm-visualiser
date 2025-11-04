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
