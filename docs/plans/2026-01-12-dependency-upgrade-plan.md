# Dependency Upgrade Plan - Tier 2/3

**Created**: 2026-01-12
**Status**: In Progress

This plan covers the remaining major dependency upgrades after merging tier 1 (minor/patch) updates.

---

## Overview

| PR | Package | Change | Tier | Risk |
|----|---------|--------|------|------|
| #4 | concurrently | 8→9 | 2 | Low |
| #10 | dotenv | 16→17 | 2 | Low |
| #14 | web-vitals | 2→5 | 2 | Low (code fixed) |
| #12 | client testing | patches | 1 | Low (awaiting rebase) |
| #7 | jest, supertest | 29→30, 6→7 | 2 | Medium |
| #3 | express, express-validator | 4→5 | 2 | Medium-High |
| #5 | pg-boss (root) | 11→12 | 3 | High |
| #11 | pg-boss (server) | 9→12 | 3 | High |

---

## Phase 1: Low-Risk Major Upgrades

### Step 1.1: Merge #4 (concurrently 8→9)

**Breaking changes**: Minimal - CLI tool for dev only

```bash
gh pr merge 4 --squash --delete-branch
```

**Verification**: Run `npm run dev` and confirm both client/server start.

---

### Step 1.2: Merge #10 (dotenv 16→17)

**Breaking changes**:
- New runtime logging by default (can silence with `DOTENV_CONFIG_QUIET=true`)
- No API changes

```bash
gh pr merge 10 --squash --delete-branch
```

**Verification**:
```bash
cd server && npm run dev
# Check logs for any dotenv warnings
```

---

### Step 1.3: Push web-vitals fix, then merge #14

The web-vitals code has been updated to use the v5 API:
- `getFID` → `onINP` (FID deprecated, INP is the new Core Web Vital)
- `get*` → `on*` function naming convention

```bash
git push
gh pr merge 14 --squash --delete-branch
```

**Verification**:
```bash
cd client && npm start
# Open browser console, check for web-vitals errors
```

---

### Step 1.4: Merge #12 (client testing) after rebase

Dependabot is rebasing this PR. Once ready:

```bash
gh pr merge 12 --squash --delete-branch
```

**Verification**: `cd client && npm test`

---

## Phase 2: Testing Framework Upgrade

### Step 2.1: Merge #7 (Jest 29→30, Supertest 6→7)

**Breaking changes in Jest 30**:
- `jest.useFakeTimers()` API changes
- Snapshot format changes (may need snapshot updates)
- Node 18.12+ required (we're on 22, OK)

**Breaking changes in Supertest 7**:
- Drops Node 14/16 support (we're on 22, OK)
- Minor API refinements

```bash
gh pr merge 7 --squash --delete-branch
```

**Verification**:
```bash
cd server && npm test
```

**If tests fail**:
1. Check for `jest.useFakeTimers()` usage - may need `{ legacyFakeTimers: true }`
2. Update snapshots if format changed: `npm test -- -u`
3. Check supertest assertions for any API changes

---

## Phase 3: Express 5 Migration

### Step 3.1: Review Express 5 Breaking Changes

**Critical changes**:
1. **Removed `app.del()`** - Use `app.delete()` instead
2. **Path matching changes** - Regex in paths handled differently
3. **`req.query` is getter-only** - Can't modify directly
4. **Removed deprecated methods**: `res.send(status, body)` → `res.status(status).send(body)`
5. **Promise rejection handling** - Async errors auto-caught
6. **Removed `app.param(fn)`** - Only `app.param(name, fn)` works

### Step 3.2: Audit Current Express Usage

Before merging, check for these patterns:

```bash
# Check for deprecated app.del()
grep -r "app\.del(" server/

# Check for res.send(status, body) pattern
grep -rn "res\.send([0-9]" server/

# Check for direct query modification
grep -rn "req\.query\s*=" server/

# Check for path regex patterns
grep -rn "app\.\(get\|post\|put\|delete\).*[:\*]" server/routes/
```

### Step 3.3: Merge and Test

```bash
gh pr merge 3 --squash --delete-branch
```

**Verification**:
```bash
cd server && npm test

# Manual API testing
npm run dev
# Test key endpoints:
# - GET /api/checkins
# - POST /api/strava/sync
# - GET /api/copilot (Gemini endpoint)
# - Auth flow
```

**If issues**:
- Check route handlers for async error handling
- Verify middleware order still works
- Test all OAuth flows (Foursquare, Strava)

---

## Phase 4: pg-boss Migration (Most Critical)

### Step 4.1: Understand the pg-boss Situation

**Current state**:
- Root package.json: `pg-boss@11.1.1`
- Server package.json: `pg-boss@9.0.3`

This is a version conflict. We should consolidate to v12.

**Strategy**:
1. Close PR #5 (root pg-boss) - will handle via server
2. Merge PR #11 (server pg-boss 9→12)
3. Update root package.json to remove pg-boss or align versions

### Step 4.2: pg-boss 9→12 Breaking Changes

**Major changes across 3 versions**:

**v10 (from v9)**:
- `boss.start()` no longer auto-creates schema - must call `boss.createQueue()` explicitly
- Job state changes: `created` → `pending`
- Removed `teamSize` option → use `batchSize`

**v11 (from v10)**:
- Queue-centric API: `boss.send('queue', data)` → `boss.send({ name: 'queue', data })`
- `work()` function signature changes
- Removed `subscribe()` → use `work()`

**v12 (from v11)**:
- Further queue API refinements
- Performance improvements
- TypeScript improvements

### Step 4.3: Current pg-boss Usage (Audited)

**Import location**: Only `server/jobs/queue.js`

**Usage patterns found**:
```javascript
// Initialization (queue.js:24)
boss = new PgBoss({ connectionString, maintenanceIntervalSeconds, ... });

// Start (queue.js:50)
await boss.start();

// Register worker (queue.js:54)
await boss.work('daily-sync-orchestrator', handler);

// Schedule recurring job (queue.js:58)
await boss.schedule('daily-sync-orchestrator', '0 2 * * *', {}, { tz: 'UTC' });

// Send jobs (strava.js, garmin.js, syncAll.js)
await boss.send('import-strava-data', { jobId, userId, ... });
await boss.send('import-strava-data', job.data, { startAfter: retryDate });

// Stop (queue.js:81)
await boss.stop();
```

**Good news**: This usage is compatible with v12. The `send(name, data, options)`
signature is still supported. No code changes needed for the upgrade.

### Step 4.4: Migration Checklist

Before merging #11:

- [ ] Review `server/jobs/*.js` for `boss.send()` calls
- [ ] Review `boss.work()` or `boss.subscribe()` usage
- [ ] Check queue creation patterns
- [ ] Update job handlers if needed
- [ ] Test job queue functionality locally

### Step 4.5: Execute Migration

```bash
# First, close the root pg-boss PR (we'll handle it differently)
gh pr close 5 --comment "Consolidating pg-boss versions via server package"

# Merge server pg-boss update
gh pr merge 11 --squash --delete-branch
```

### Step 4.6: Post-Migration Verification

```bash
cd server && npm test

# Test job functionality
npm run dev
# Trigger a Strava sync and watch logs for job processing
```

### Step 4.7: Clean Up Root pg-boss

**Finding**: pg-boss is only imported in `server/jobs/queue.js`. The root `package.json`
has a redundant pg-boss dependency that should be removed.

After server migration works:

```bash
# Remove pg-boss from root package.json
npm uninstall pg-boss
git add package.json package-lock.json
git commit -m "chore: remove redundant pg-boss from root package.json"
git push
```

---

## Post-Upgrade Verification Checklist

After all upgrades complete:

- [ ] `npm run dev` starts both client and server
- [ ] `cd server && npm test` - all tests pass
- [ ] `cd client && npm test` - all tests pass
- [ ] OAuth flows work (Foursquare, Strava)
- [ ] Copilot/Gemini endpoint works
- [ ] Job queue processes jobs (Strava sync)
- [ ] Map renders correctly
- [ ] Day in Life page loads
- [ ] No console errors in browser

---

## Rollback Plan

If any upgrade causes production issues:

1. Identify the breaking PR from git log
2. Revert the merge commit:
   ```bash
   git revert -m 1 <merge-commit-sha>
   git push
   ```
3. Open an issue documenting the failure
4. Address the root cause before re-attempting

---

## Timeline Recommendation

Execute in order, verifying each phase before proceeding:

1. **Phase 1** (Low-risk): Can merge immediately
2. **Phase 2** (Testing): Merge and fix any snapshot issues
3. **Phase 3** (Express): Review code first, then merge
4. **Phase 4** (pg-boss): Most work - review migration guide thoroughly
