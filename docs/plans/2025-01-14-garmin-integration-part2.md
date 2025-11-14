# Garmin Integration Part 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Garmin integration by adding background jobs, routes, and frontend UI to sync activities and daily metrics.

**Architecture:** Follows the same pattern as Foursquare sync using pg-boss background jobs. Database schema, models, and sync service are already implemented (Part 1, commit 368b8a2).

**Tech Stack:** Node.js, Express, pg-boss, React, Material-UI, garmin-connect library

**Lessons Applied from Foursquare Sync Issues:**
- ✅ Only update `last_garmin_sync_at` when items actually imported
- ✅ Use bulkInsert return value for accurate counts
- ✅ Composite unique constraints prevent duplicates
- ✅ Go back 7 days on incremental sync to catch missed data

---

## What's Already Done (Part 1)

**Commit 368b8a2 completed:**
- ✅ Migration 006: Garmin tables (activities, daily steps, HR, sleep)
- ✅ Migration 007: Garmin auth columns (token, connected_at, last_garmin_sync_at)
- ✅ Models: GarminActivity, GarminDailySteps, GarminDailyHeartRate, GarminDailySleep
- ✅ Services: garminAuth, garminSync
- ✅ Package: garmin-connect installed

**What's Left to Build:**
1. Background job handler (`importGarminData.js`)
2. Routes (`/api/garmin/*`)
3. User model updates (`updateLastGarminSync`)
4. Frontend UI (Data Sources page)
5. Testing + deployment

---

## Task 1: Create Garmin Background Job Handler

**Files:**
- Create: `server/jobs/importGarminData.js`
- Reference: `server/jobs/importCheckins.js` (Foursquare example)

**Step 1: Create job handler file**

```javascript
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { decrypt } = require('../services/encryption');
const garminSync = require('../services/garminSync');

/**
 * Background job handler for importing Garmin data
 * @param {Object} job - pg-boss job object
 * @param {number} job.data.jobId - Import job ID
 * @param {number} job.data.userId - User ID
 * @param {string} job.data.syncType - 'full' or 'incremental'
 */
async function importGarminDataHandler(job) {
  const { jobId, userId, syncType = 'incremental' } = job.data;

  console.log(`Starting Garmin import job ${jobId} for user ${userId} (${syncType})`);

  try {
    // Mark job as started
    await ImportJob.markStarted(jobId);

    // Get user with encrypted Garmin token
    const user = await User.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.garmin_session_token_encrypted) {
      throw new Error('User has no Garmin session token');
    }

    // Decrypt session token
    const sessionToken = user.garmin_session_token_encrypted;

    let result;

    if (syncType === 'full') {
      // Full historical sync (5 years)
      result = await garminSync.fullHistoricalSync(sessionToken, userId, 5, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    } else {
      // Incremental sync
      const lastSyncDate = user.last_garmin_sync_at;
      console.log(`[GARMIN JOB] User ${userId}: last_garmin_sync_at = ${lastSyncDate}`);

      result = await garminSync.incrementalSync(sessionToken, userId, lastSyncDate, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    }

    const totalImported = (result.activities?.imported || 0) + (result.dailyMetrics?.totalInserted || 0);

    console.log(`Garmin import job ${jobId} completed: ${totalImported} items imported`);

    // Mark job as completed
    await ImportJob.markCompleted(jobId);

    // CRITICAL: Only update last_garmin_sync_at when items were actually imported
    // This prevents the vicious cycle we had with Foursquare
    if (totalImported > 0) {
      await User.updateLastGarminSync(userId);
    } else {
      console.log(`[GARMIN JOB] No items imported - NOT updating last_garmin_sync_at`);
    }

  } catch (error) {
    console.error(`Garmin import job ${jobId} failed:`, error);

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    throw error; // Re-throw so pg-boss knows it failed
  }
}

module.exports = importGarminDataHandler;
```

**Step 2: Verify file syntax**

Run: `node -c server/jobs/importGarminData.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/jobs/importGarminData.js
git commit -m "feat(garmin): add background job handler with sync cycle fixes"
```

---

## Task 2: Add User Model Method for Garmin Sync

**Files:**
- Modify: `server/models/user.js`

**Step 1: Add updateLastGarminSync method**

Add this method to the User class:

```javascript
  /**
   * Update user's last Garmin sync timestamp
   * CRITICAL: Only call this when items are actually imported
   */
  static async updateLastGarminSync(userId) {
    const query = `
      UPDATE users
      SET last_garmin_sync_at = NOW()
      WHERE id = $1
      RETURNING last_garmin_sync_at
    `;
    const result = await db.query(query, [userId]);
    console.log(`[USER MODEL] Updated last_garmin_sync_at for user ${userId} to ${result.rows[0]?.last_garmin_sync_at}`);
    return result.rows[0];
  }
```

**Step 2: Verify the file still loads**

Run: `node -c server/models/user.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/models/user.js
git commit -m "feat(user): add updateLastGarminSync method"
```

---

## Task 3: Register Garmin Job with pg-boss

**Files:**
- Modify: `server/worker.js`

**Step 1: Import Garmin job handler**

Add to imports section:

```javascript
const importGarminDataHandler = require('./jobs/importGarminData');
```

**Step 2: Register the job**

Add after the existing job registration:

```javascript
  // Register Garmin import job
  await boss.work('import-garmin-data', { teamSize: 2, teamConcurrency: 1 }, importGarminDataHandler);
  console.log('Registered job: import-garmin-data');
```

**Step 3: Verify syntax**

Run: `node -c server/worker.js`
Expected: No output (success)

**Step 4: Commit**

```bash
git add server/worker.js
git commit -m "feat(worker): register Garmin import job with pg-boss"
```

---

## Task 4: Create Garmin Routes

**Files:**
- Create: `server/routes/garmin.js`
- Modify: `server/server.js` (register routes)

**Step 1: Create routes file**

```javascript
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const garminAuth = require('../services/garminAuth');
const boss = require('../services/jobQueue');

/**
 * POST /api/garmin/connect
 * Connect Garmin account with username/password
 */
router.post('/connect', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Authenticate with Garmin
    const { encrypted } = await garminAuth.authenticate(username, password);

    // Save encrypted session token
    await User.update(user.id, {
      garmin_session_token_encrypted: encrypted,
      garmin_connected_at: new Date()
    });

    res.json({
      success: true,
      message: 'Garmin connected successfully'
    });
  } catch (error) {
    console.error('Garmin connect error:', error);
    res.status(500).json({
      error: 'Failed to connect Garmin',
      message: error.message
    });
  }
});

/**
 * POST /api/garmin/sync
 * Start Garmin data sync (queues background job)
 */
router.post('/sync', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user.garmin_session_token_encrypted) {
      return res.status(400).json({ error: 'Garmin not connected' });
    }

    const { syncType = 'incremental' } = req.body;

    // Create import job
    const job = await ImportJob.create({
      user_id: user.id,
      data_source: 'garmin',
      status: 'queued'
    });

    // Queue background job
    await boss.send('import-garmin-data', {
      jobId: job.id,
      userId: user.id,
      syncType
    });

    console.log(`Queued Garmin sync job ${job.id} for user ${user.id} (${syncType})`);

    res.json({
      success: true,
      jobId: job.id,
      message: 'Garmin sync queued. Check progress in import history.'
    });
  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({
      error: 'Failed to start Garmin sync',
      message: error.message
    });
  }
});

/**
 * DELETE /api/garmin/disconnect
 * Disconnect Garmin account
 */
router.delete('/disconnect', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await User.update(user.id, {
      garmin_session_token_encrypted: null,
      garmin_connected_at: null,
      last_garmin_sync_at: null
    });

    res.json({
      success: true,
      message: 'Garmin disconnected successfully'
    });
  } catch (error) {
    console.error('Garmin disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect Garmin',
      message: error.message
    });
  }
});

module.exports = router;
```

**Step 2: Register routes in server.js**

Add to imports:

```javascript
const garminRoutes = require('./routes/garmin');
```

Add to routes section:

```javascript
app.use('/api/garmin', garminRoutes);
```

**Step 3: Verify syntax**

Run:
```bash
node -c server/routes/garmin.js
node -c server/server.js
```
Expected: No output (success)

**Step 4: Commit**

```bash
git add server/routes/garmin.js server/server.js
git commit -m "feat(garmin): add routes for connect, sync, and disconnect"
```

---

## Task 5: Update syncAll Service to Include Garmin

**Files:**
- Modify: `server/services/syncAll.js`

**Step 1: Add Garmin to syncAllDataSources**

Find the function and add Garmin sync:

```javascript
  // Sync Garmin if connected
  if (user.garmin_session_token_encrypted) {
    try {
      const garminJob = await ImportJob.create({
        user_id: userId,
        data_source: 'garmin',
        status: 'queued'
      });

      await boss.send('import-garmin-data', {
        jobId: garminJob.id,
        userId,
        syncType: 'incremental'
      });

      results.garmin = { jobId: garminJob.id, status: 'queued' };
    } catch (error) {
      console.error('Failed to queue Garmin sync:', error);
      results.garmin = { error: error.message };
    }
  } else {
    results.garmin = { skipped: 'Not connected' };
  }
```

**Step 2: Verify syntax**

Run: `node -c server/services/syncAll.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/services/syncAll.js
git commit -m "feat(sync): include Garmin in syncAllDataSources"
```

---

## Task 6: Run Migrations Locally

**Files:**
- Database: Apply migrations 006 and 007

**Step 1: Run migration 006 (Garmin tables)**

Run:
```bash
node server/db/run-migration.js server/db/migrations/006_add_garmin_tables.sql
```

Expected output:
```
Migration 006_add_garmin_tables.sql applied successfully
```

**Step 2: Run migration 007 (Garmin auth columns)**

Run:
```bash
node server/db/run-migration.js server/db/migrations/007_add_garmin_auth.sql
```

Expected output:
```
Migration 007_add_garmin_auth.sql applied successfully
```

**Step 3: Verify tables exist**

Run:
```bash
psql $DATABASE_URL -c "\dt garmin*"
```

Expected: List of 4 tables (garmin_activities, garmin_daily_steps, garmin_daily_heart_rate, garmin_daily_sleep)

**Step 4: Commit checkpoint**

```bash
git add -A
git commit -m "chore: migrations 006-007 applied locally"
```

---

## Task 7: Frontend - Add Garmin UI to Data Sources Page

**Files:**
- Modify: `client/src/pages/DataSourcesPage.jsx`

**Step 1: Add Garmin state**

Add to component state:

```javascript
const [garminConnected, setGarminConnected] = useState(false);
const [garminUsername, setGarminUsername] = useState('');
const [garminPassword, setGarminPassword] = useState('');
const [garminConnecting, setGarminConnecting] = useState(false);
```

**Step 2: Add Garmin connect handler**

```javascript
const handleGarminConnect = async () => {
  if (!garminUsername || !garminPassword) {
    alert('Please enter Garmin username and password');
    return;
  }

  setGarminConnecting(true);

  try {
    const response = await fetch(`${API_URL}/api/garmin/connect?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: garminUsername,
        password: garminPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      setGarminConnected(true);
      setGarminPassword(''); // Clear password
      alert('Garmin connected successfully!');
    } else {
      alert(`Failed to connect: ${data.message || data.error}`);
    }
  } catch (error) {
    console.error('Garmin connect error:', error);
    alert('Failed to connect to Garmin');
  } finally {
    setGarminConnecting(false);
  }
};

const handleGarminDisconnect = async () => {
  if (!confirm('Disconnect Garmin?')) return;

  try {
    const response = await fetch(`${API_URL}/api/garmin/disconnect?token=${token}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      setGarminConnected(false);
      setGarminUsername('');
      alert('Garmin disconnected');
    }
  } catch (error) {
    console.error('Garmin disconnect error:', error);
    alert('Failed to disconnect Garmin');
  }
};
```

**Step 3: Add Garmin UI card**

Add after Foursquare card:

```jsx
<Card sx={{ mb: 3 }}>
  <CardContent>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <FitnessCenter sx={{ mr: 1, color: 'primary.main' }} />
      <Typography variant="h6">Garmin</Typography>
    </Box>

    {!garminConnected ? (
      <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sync activities, steps, heart rate, and sleep data from Garmin Connect
        </Typography>

        <TextField
          fullWidth
          label="Garmin Username"
          value={garminUsername}
          onChange={(e) => setGarminUsername(e.target.value)}
          sx={{ mb: 2 }}
          size="small"
        />

        <TextField
          fullWidth
          type="password"
          label="Garmin Password"
          value={garminPassword}
          onChange={(e) => setGarminPassword(e.target.value)}
          sx={{ mb: 2 }}
          size="small"
        />

        <Button
          variant="contained"
          onClick={handleGarminConnect}
          disabled={garminConnecting}
        >
          {garminConnecting ? 'Connecting...' : 'Connect Garmin'}
        </Button>
      </>
    ) : (
      <>
        <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
          ✓ Connected
        </Typography>

        <Button
          variant="outlined"
          color="error"
          onClick={handleGarminDisconnect}
          size="small"
        >
          Disconnect
        </Button>
      </>
    )}
  </CardContent>
</Card>
```

**Step 4: Add FitnessCenter icon import**

Add to imports:

```javascript
import { FitnessCenter } from '@mui/icons-material';
```

**Step 5: Verify syntax**

Run: `npm run build` in client directory
Expected: Build succeeds with no errors

**Step 6: Commit**

```bash
git add client/src/pages/DataSourcesPage.jsx
git commit -m "feat(ui): add Garmin connect/disconnect UI to Data Sources"
```

---

## Task 8: Test Locally

**Step 1: Start server**

Run: `npm run dev` (in root directory)
Expected: Server starts on port 3001, worker connects to pg-boss

**Step 2: Start client**

Run: `npm start` (in client directory)
Expected: Client starts on port 3000

**Step 3: Manual test checklist**

- [ ] Navigate to Data Sources page
- [ ] Enter Garmin credentials (test account or your own)
- [ ] Click "Connect Garmin"
- [ ] Verify "Connected" status appears
- [ ] Check server logs for "Garmin connected successfully"
- [ ] Click "Sync all data" from context menu
- [ ] Check server logs for "Queued Garmin sync job"
- [ ] Wait for sync to complete
- [ ] Check database: `SELECT COUNT(*) FROM garmin_activities WHERE user_id = 1;`
- [ ] Verify activities were imported

**Step 4: Document test results**

Create: `docs/testing/garmin-integration-test-results.md`

```markdown
# Garmin Integration Test Results

**Date:** [Date]
**Tester:** [Name]

## Test Cases

1. ✅/❌ Connect Garmin with valid credentials
2. ✅/❌ Sync triggers background job
3. ✅/❌ Activities imported to database
4. ✅/❌ Daily metrics imported to database
5. ✅/❌ last_garmin_sync_at updated correctly
6. ✅/❌ Incremental sync works (run twice)
7. ✅/❌ Disconnect removes credentials

## Issues Found

[List any issues]

## Database Counts

- Activities: [count]
- Steps: [count]
- Heart Rate: [count]
- Sleep: [count]
```

**Step 5: Commit test results**

```bash
git add docs/testing/garmin-integration-test-results.md
git commit -m "docs: add Garmin integration test results"
```

---

## Task 9: Deploy to Production

**Step 1: Push to GitHub**

Run:
```bash
git push origin main
```

Expected: GitHub push succeeds, Render deployment triggers

**Step 2: Monitor Render deployment**

Check logs:
```bash
npm run logs:view
```

Wait for: "Deployment successful"

**Step 3: Run migrations on production**

Connect to production database:
```bash
psql [PRODUCTION_DATABASE_URL]
```

Run:
```sql
-- Migration 006
-- (paste migration 006 SQL)

-- Migration 007
-- (paste migration 007 SQL)
```

**Step 4: Verify deployment**

- [ ] Check production logs for errors
- [ ] Test Garmin connect on production
- [ ] Verify background jobs are processing

**Step 5: Commit deployment notes**

```bash
git add docs/deployment/
git commit -m "docs: Garmin integration deployed to production"
git push
```

---

## Critical Reminders

**From Foursquare Sync Issues:**

1. ✅ **NEVER update `last_garmin_sync_at` when 0 items imported**
   - Location: `server/jobs/importGarminData.js:77-81`
   - Check: `if (totalImported > 0) { await User.updateLastGarminSync(userId); }`

2. ✅ **Use bulkInsert return value, not array length**
   - Location: All model bulkInsert methods
   - Check: `const insertedCount = await GarminActivity.bulkInsert(...)` then use `insertedCount`

3. ✅ **Composite unique constraints prevent duplicates**
   - Location: `server/db/migrations/006_add_garmin_tables.sql:15`
   - Check: `UNIQUE(user_id, garmin_activity_id)`

4. ✅ **Incremental sync goes back 7 days**
   - Location: `server/services/garminSync.js:235`
   - Check: `startDate.setDate(startDate.getDate() - 7);`

---

## Success Criteria

- [ ] Garmin can be connected via UI
- [ ] Sync triggers background job
- [ ] Activities imported to database
- [ ] Daily metrics imported to database
- [ ] `last_garmin_sync_at` updates correctly
- [ ] Incremental sync works without duplicates
- [ ] No vicious cycle issues
- [ ] Deployed to production
- [ ] Migrations run on production

---

## Estimated Time

- Tasks 1-5: 2 hours (backend)
- Task 6: 15 minutes (migrations)
- Task 7: 1 hour (frontend)
- Task 8: 1 hour (testing)
- Task 9: 30 minutes (deployment)

**Total: ~5 hours**
