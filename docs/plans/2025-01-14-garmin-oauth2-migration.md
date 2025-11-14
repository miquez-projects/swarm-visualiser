# Garmin Health API OAuth2 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from unofficial garmin-connect library to official Garmin Health API with OAuth2 authentication, enabling MFA-protected accounts.

**Architecture:** Replace direct credentials authentication with OAuth2 flow similar to Foursquare integration. User clicks "Connect Garmin" → redirects to Garmin OAuth → redirects back with code → exchange for tokens → store encrypted tokens → sync data via official API endpoints.

**Tech Stack:** Garmin Health API v2, OAuth2, Express routes, React UI, PostgreSQL (existing schema), axios for API calls

---

## Prerequisites

**Before starting:**
1. Register application at https://developer.garmin.com/
2. Obtain: Consumer Key, Consumer Secret
3. Set redirect URL: `https://swarm-visualiser-api.onrender.com/api/garmin/callback`
4. Add to `.env`: `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`

**Lessons Learned from Foursquare Sync (CRITICAL):**
- ✅ Only update `last_garmin_sync_at` when `totalImported > 0`
- ✅ Use `bulkInsert` return value (result.rowCount), NOT array length
- ✅ Composite unique constraints: `(user_id, garmin_activity_id)`, `(user_id, date)`
- ✅ `ON CONFLICT DO NOTHING` pattern throughout
- ✅ Incremental sync goes back 7 days to catch missed data
- ✅ Dedicated timestamp field, not derived from max date

---

## Task 1: Remove garmin-connect Library

**Files:**
- Modify: `server/package.json`
- Delete: `server/services/garminAuth.js`
- Modify: `server/services/garminSync.js` (will rewrite)
- Modify: `server/jobs/importGarminData.js`

**Step 1: Uninstall garmin-connect**

```bash
cd server
npm uninstall garmin-connect
```

**Step 2: Add OAuth and API dependencies**

```bash
npm install oauth@0.10.0
```

**Step 3: Verify package.json**

Run: `cat server/package.json | grep oauth`
Expected: `"oauth": "^0.10.0"`

**Step 4: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore(garmin): remove garmin-connect, add oauth library"
```

---

## Task 2: Create Garmin OAuth2 Service

**Files:**
- Create: `server/services/garminOAuth.js`
- Modify: `server/.env` (add credentials)

**Step 1: Create OAuth2 service file**

Create `server/services/garminOAuth.js`:

```javascript
const { OAuth2 } = require('oauth');
const axios = require('axios');
const { encrypt, decrypt } = require('./encryption');

class GarminOAuthService {
  constructor() {
    this.oauth2 = new OAuth2(
      process.env.GARMIN_CONSUMER_KEY,
      process.env.GARMIN_CONSUMER_SECRET,
      'https://connectapi.garmin.com/',
      'oauth-service/oauth/request_token',
      'oauth-service/oauth/access_token',
      null
    );

    this.baseURL = 'https://apis.garmin.com/wellness-api/rest';
  }

  /**
   * Get OAuth authorization URL
   * @param {string} callbackUrl - OAuth callback URL
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(callbackUrl) {
    const params = new URLSearchParams({
      oauth_consumer_key: process.env.GARMIN_CONSUMER_KEY,
      oauth_callback: callbackUrl
    });

    return `https://connect.garmin.com/oauthConfirm?${params.toString()}`;
  }

  /**
   * Exchange OAuth verifier for access token
   * @param {string} oauthToken - OAuth token from callback
   * @param {string} oauthVerifier - OAuth verifier from callback
   * @returns {Promise<{token: string, tokenSecret: string}>}
   */
  async getAccessToken(oauthToken, oauthVerifier) {
    return new Promise((resolve, reject) => {
      this.oauth2.getOAuthAccessToken(
        oauthToken,
        oauthVerifier,
        (error, oauth_access_token, oauth_access_token_secret) => {
          if (error) {
            console.error('[GARMIN OAUTH] Access token error:', error);
            reject(new Error('Failed to obtain access token'));
          } else {
            resolve({
              token: oauth_access_token,
              tokenSecret: oauth_access_token_secret
            });
          }
        }
      );
    });
  }

  /**
   * Get encrypted token bundle for storage
   * @param {string} token - OAuth access token
   * @param {string} tokenSecret - OAuth access token secret
   * @returns {string} Encrypted token bundle
   */
  encryptTokens(token, tokenSecret) {
    const tokenBundle = JSON.stringify({ token, tokenSecret });
    return encrypt(tokenBundle);
  }

  /**
   * Decrypt and parse token bundle
   * @param {string} encryptedTokens - Encrypted token bundle
   * @returns {{token: string, tokenSecret: string}}
   */
  decryptTokens(encryptedTokens) {
    const decrypted = decrypt(encryptedTokens);
    return JSON.parse(decrypted);
  }

  /**
   * Make authenticated API request
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @param {string} endpoint - API endpoint (e.g., '/activities')
   * @param {object} params - Query parameters
   * @returns {Promise<any>} API response data
   */
  async makeAuthenticatedRequest(encryptedTokens, endpoint, params = {}) {
    const { token, tokenSecret } = this.decryptTokens(encryptedTokens);

    // Build OAuth1.0a signature
    const url = `${this.baseURL}${endpoint}`;
    const authHeader = this.oauth2.authHeader(
      url,
      token,
      tokenSecret,
      'GET'
    );

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`[GARMIN API] Request failed:`, error.message);
      if (error.response?.status === 401) {
        throw new Error('OAuth token expired or invalid');
      }
      throw error;
    }
  }
}

module.exports = new GarminOAuthService();
```

**Step 2: Add environment variables**

Add to `server/.env`:
```
GARMIN_CONSUMER_KEY=your_consumer_key_from_garmin
GARMIN_CONSUMER_SECRET=your_consumer_secret_from_garmin
```

**Step 3: Test OAuth service instantiation**

Run: `node -e "require('./server/services/garminOAuth')"`
Expected: No errors

**Step 4: Commit**

```bash
git add server/services/garminOAuth.js
git commit -m "feat(garmin): add OAuth2 service for Garmin Health API"
```

---

## Task 3: Update Database Schema for OAuth Tokens

**Files:**
- Modify: `server/db/migrations/007_add_garmin_auth.sql`
- Modify: `server/models/user.js`

**Step 1: Update migration to store OAuth tokens**

Modify `server/db/migrations/007_add_garmin_auth.sql`:

```sql
-- Replace garmin_session_token_encrypted with OAuth tokens
ALTER TABLE users DROP COLUMN IF EXISTS garmin_session_token_encrypted;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_oauth_tokens_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_garmin_sync_at TIMESTAMP;

-- Update schema_migrations
INSERT INTO schema_migrations (version, name)
VALUES (7, '007_add_garmin_oauth')
ON CONFLICT (version) DO UPDATE SET name = '007_add_garmin_oauth';
```

**Step 2: Update User model**

Modify `server/models/user.js`, update `updateGarminAuth` method:

```javascript
/**
 * Update Garmin OAuth tokens
 * @param {number} userId
 * @param {string} encryptedTokens - Encrypted OAuth token bundle
 */
static async updateGarminAuth(userId, encryptedTokens) {
  const query = `
    UPDATE users
    SET garmin_oauth_tokens_encrypted = $1,
        garmin_connected_at = NOW()
    WHERE id = $2
    RETURNING id, garmin_connected_at
  `;

  const result = await db.query(query, [encryptedTokens, userId]);
  console.log(`[USER MODEL] Updated Garmin OAuth tokens for user ${userId}`);
  return result.rows[0];
}

/**
 * Get Garmin OAuth tokens
 * @param {number} userId
 * @returns {Promise<string|null>} Encrypted OAuth tokens
 */
static async getGarminTokens(userId) {
  const query = `
    SELECT garmin_oauth_tokens_encrypted
    FROM users
    WHERE id = $1
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0]?.garmin_oauth_tokens_encrypted || null;
}
```

**Step 3: Run migration on production**

```bash
# This will be run manually on production database
# psql $DATABASE_URL < server/db/migrations/007_add_garmin_oauth.sql
```

**Step 4: Commit**

```bash
git add server/db/migrations/007_add_garmin_auth.sql server/models/user.js
git commit -m "feat(garmin): update schema for OAuth2 tokens"
```

---

## Task 4: Rewrite Garmin Sync Service for Official API

**Files:**
- Modify: `server/services/garminSync.js`

**Step 1: Rewrite sync service**

Replace entire contents of `server/services/garminSync.js`:

```javascript
const garminOAuth = require('./garminOAuth');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

class GarminSyncService {
  /**
   * Sync activities from Garmin Health API
   * CRITICAL: Implements lessons learned from Foursquare sync
   * - Only updates last_sync when items actually imported
   * - Uses bulkInsert return value, not array length
   * - 7-day lookback for incremental sync
   */
  async syncActivities(encryptedTokens, userId, afterDate = null, onProgress = null) {
    console.log(`[GARMIN SYNC] Starting activity sync for user ${userId}, afterDate: ${afterDate}`);

    const startDate = afterDate || this.getDefaultStartDate();
    const endDate = new Date();

    let allActivities = [];
    let offset = 0;
    const limit = 100;

    try {
      // Fetch activities in pages
      while (true) {
        const activities = await garminOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/activities',
          {
            uploadStartTimeInSeconds: Math.floor(startDate.getTime() / 1000),
            uploadEndTimeInSeconds: Math.floor(endDate.getTime() / 1000),
            start: offset,
            limit
          }
        );

        if (!activities || activities.length === 0) {
          break;
        }

        allActivities = allActivities.concat(activities);
        offset += activities.length;

        if (onProgress) {
          await onProgress({ fetched: allActivities.length });
        }

        // Safety limit
        if (offset >= 10000) {
          console.log(`[GARMIN SYNC] Reached safety limit`);
          break;
        }

        // No more results
        if (activities.length < limit) {
          break;
        }
      }

      // Transform and bulk insert
      const activitiesToInsert = allActivities.map(activity =>
        this.transformActivity(activity, userId)
      );

      // CRITICAL: Use bulkInsert return value, not array length
      const insertedCount = activitiesToInsert.length > 0
        ? await GarminActivity.bulkInsert(activitiesToInsert)
        : 0;

      console.log(`[GARMIN SYNC] Activity sync complete: ${insertedCount} imported, ${allActivities.length} fetched`);

      return { imported: insertedCount, fetched: allActivities.length };
    } catch (error) {
      console.error(`[GARMIN SYNC] Activity sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Sync daily metrics (steps, heart rate, sleep)
   */
  async syncDailyMetrics(encryptedTokens, userId, startDate, endDate, onProgress = null) {
    console.log(`[GARMIN SYNC] Syncing daily metrics from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const stepsArray = [];
    const hrArray = [];
    const sleepArray = [];

    let currentDate = new Date(startDate);
    let daysProcessed = 0;
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      try {
        // Fetch daily summaries
        const summaries = await garminOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/dailies',
          {
            uploadStartTimeInSeconds: Math.floor(currentDate.getTime() / 1000),
            uploadEndTimeInSeconds: Math.floor(currentDate.getTime() / 1000) + 86400
          }
        );

        if (summaries && summaries.length > 0) {
          const summary = summaries[0];

          // Steps
          if (summary.totalSteps) {
            stepsArray.push({
              user_id: userId,
              date: dateStr,
              step_count: summary.totalSteps
            });
          }

          // Heart Rate
          if (summary.minHeartRateInBeatsPerMinute) {
            hrArray.push({
              user_id: userId,
              date: dateStr,
              min_heart_rate: summary.minHeartRateInBeatsPerMinute,
              max_heart_rate: summary.maxHeartRateInBeatsPerMinute,
              resting_heart_rate: summary.restingHeartRateInBeatsPerMinute
            });
          }

          // Sleep
          if (summary.sleepTimeInSeconds) {
            sleepArray.push({
              user_id: userId,
              date: dateStr,
              sleep_duration_seconds: summary.sleepTimeInSeconds,
              sleep_score: summary.sleepScores?.overall?.value,
              deep_sleep_seconds: summary.deepSleepTimeInSeconds,
              light_sleep_seconds: summary.lightSleepTimeInSeconds,
              rem_sleep_seconds: summary.remSleepTimeInSeconds,
              awake_seconds: summary.awakeSleepTimeInSeconds
            });
          }
        }
      } catch (err) {
        console.error(`[GARMIN SYNC] Failed to fetch metrics for ${dateStr}:`, err.message);
      }

      daysProcessed++;

      if (onProgress && daysProcessed % 7 === 0) {
        await onProgress({ daysProcessed, totalDays });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Bulk insert all metrics
    // CRITICAL: Use bulkInsert return value
    let totalInserted = 0;

    if (stepsArray.length > 0) {
      totalInserted += await GarminDailySteps.bulkUpsert(stepsArray);
    }

    if (hrArray.length > 0) {
      totalInserted += await GarminDailyHeartRate.bulkUpsert(hrArray);
    }

    if (sleepArray.length > 0) {
      totalInserted += await GarminDailySleep.bulkUpsert(sleepArray);
    }

    console.log(`[GARMIN SYNC] Daily metrics complete: ${totalInserted} records inserted`);

    return { daysProcessed, totalInserted };
  }

  /**
   * Transform Garmin activity to database format
   */
  transformActivity(activity, userId) {
    // Build tracklog if coordinates exist
    let tracklog = null;
    if (activity.geoPolylineDTO && activity.geoPolylineDTO.polyline) {
      // Decode polyline to coordinates
      const coords = this.decodePolyline(activity.geoPolylineDTO.polyline);
      if (coords.length > 0) {
        const lineString = coords
          .map(([lat, lon]) => `${lon} ${lat}`)
          .join(',');
        tracklog = `LINESTRING(${lineString})`;
      }
    }

    return {
      user_id: userId,
      garmin_activity_id: String(activity.activityId),
      activity_type: activity.activityType?.typeKey,
      activity_name: activity.activityName,
      start_time: new Date(activity.startTimeInSeconds * 1000),
      duration_seconds: activity.durationInSeconds,
      distance_meters: activity.distanceInMeters,
      calories: activity.activeKilocalories,
      avg_heart_rate: activity.averageHeartRateInBeatsPerMinute,
      max_heart_rate: activity.maxHeartRateInBeatsPerMinute,
      tracklog,
      garmin_url: `https://connect.garmin.com/modern/activity/${activity.activityId}`
    };
  }

  /**
   * Decode Google polyline format
   */
  decodePolyline(encoded) {
    const coords = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coords.push([lat / 1e5, lng / 1e5]);
    }

    return coords;
  }

  /**
   * Full historical sync
   */
  async fullHistoricalSync(encryptedTokens, userId, yearsBack = 5, onProgress = null) {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);

    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
    const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }

  /**
   * Incremental sync with 7-day lookback
   * CRITICAL: Goes back 7 days to catch missed data
   */
  async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null) {
    const startDate = lastSyncDate ? new Date(lastSyncDate) : new Date();
    startDate.setDate(startDate.getDate() - 7); // CRITICAL: 7-day lookback

    const today = new Date();

    console.log(`[GARMIN SYNC] Incremental sync from ${startDate.toISOString().split('T')[0]}`);

    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
    const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }

  getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  }
}

module.exports = new GarminSyncService();
```

**Step 2: Commit**

```bash
git add server/services/garminSync.js
git commit -m "feat(garmin): rewrite sync service for official Health API"
```

---

## Task 5: Update Garmin Routes for OAuth Flow

**Files:**
- Modify: `server/routes/garmin.js`

**Step 1: Rewrite OAuth routes**

Replace entire contents of `server/routes/garmin.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const garminOAuth = require('../services/garminOAuth');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

/**
 * Initiate Garmin OAuth flow
 */
router.get('/connect', authenticateToken, async (req, res) => {
  try {
    const callbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/garmin/callback`;
    const authUrl = garminOAuth.getAuthorizationUrl(callbackUrl);

    // Store user ID in session for callback
    req.session = req.session || {};
    req.session.garminUserId = req.user.id;

    res.json({ authUrl });
  } catch (error) {
    console.error('[GARMIN ROUTE] Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * OAuth callback - exchange code for tokens
 */
router.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).json({ error: 'Missing OAuth parameters' });
  }

  try {
    // Exchange verifier for access token
    const { token, tokenSecret } = await garminOAuth.getAccessToken(oauth_token, oauth_verifier);

    // Encrypt and store tokens
    const encryptedTokens = garminOAuth.encryptTokens(token, tokenSecret);

    // Get user ID from session
    const userId = req.session?.garminUserId;
    if (!userId) {
      return res.status(400).json({ error: 'Session expired' });
    }

    await User.updateGarminAuth(userId, encryptedTokens);

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?garmin=connected`);
  } catch (error) {
    console.error('[GARMIN ROUTE] Callback error:', error);
    res.status(500).json({ error: 'OAuth exchange failed' });
  }
});

/**
 * Trigger Garmin sync
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { syncType = 'incremental' } = req.body;

    // Verify user has Garmin connected
    const tokens = await User.getGarminTokens(userId);
    if (!tokens) {
      return res.status(400).json({ error: 'Garmin not connected' });
    }

    // Create import job
    const job = await ImportJob.create({
      user_id: userId,
      data_source: 'garmin',
      status: 'queued'
    });

    // Queue background job
    const boss = getQueue();
    await boss.send('import-garmin-data', {
      jobId: job.id,
      userId,
      syncType
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('[GARMIN ROUTE] Sync error:', error);
    res.status(500).json({ error: 'Failed to queue sync' });
  }
});

/**
 * Disconnect Garmin
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await User.updateGarminAuth(userId, null);

    res.json({ success: true });
  } catch (error) {
    console.error('[GARMIN ROUTE] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
```

**Step 2: Add session middleware to server.js**

Modify `server/server.js` to add express-session:

```javascript
// After express.json() middleware
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 3600000 // 1 hour
  }
}));
```

**Step 3: Install express-session**

```bash
cd server
npm install express-session
```

**Step 4: Commit**

```bash
git add server/routes/garmin.js server/server.js server/package.json
git commit -m "feat(garmin): update routes for OAuth2 flow"
```

---

## Task 6: Update Background Job Handler

**Files:**
- Modify: `server/jobs/importGarminData.js`

**Step 1: Update job handler for OAuth**

Replace contents of `server/jobs/importGarminData.js`:

```javascript
const garminSync = require('../services/garminSync');
const User = require('../models/user');
const ImportJob = require('../models/importJob');

module.exports = async function importGarminData(job) {
  const { jobId, userId, syncType = 'incremental' } = job.data;

  console.log(`[GARMIN JOB] Starting job ${jobId} for user ${userId}, type: ${syncType}`);

  try {
    await ImportJob.markInProgress(jobId);

    // Get encrypted OAuth tokens
    const encryptedTokens = await User.getGarminTokens(userId);
    if (!encryptedTokens) {
      throw new Error('No Garmin OAuth tokens found');
    }

    // Perform sync
    let result;
    if (syncType === 'full') {
      result = await garminSync.fullHistoricalSync(encryptedTokens, userId, 5);
    } else {
      const user = await User.findById(userId);
      const lastSyncDate = user.last_garmin_sync_at;
      result = await garminSync.incrementalSync(encryptedTokens, userId, lastSyncDate);
    }

    // Calculate total imported
    const totalImported = (result.activities?.imported || 0) + (result.dailyMetrics?.totalInserted || 0);

    await ImportJob.markCompleted(jobId);

    // CRITICAL: Only update last_garmin_sync_at when items actually imported
    if (totalImported > 0) {
      await User.updateLastGarminSync(userId);
      console.log(`[GARMIN JOB] Imported ${totalImported} items, updated last_sync`);
    } else {
      console.log(`[GARMIN JOB] No items imported - NOT updating last_garmin_sync_at`);
    }

    console.log(`[GARMIN JOB] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[GARMIN JOB] Job ${jobId} failed:`, error.message);
    await ImportJob.markFailed(jobId, error.message);
    throw error;
  }
};
```

**Step 2: Commit**

```bash
git add server/jobs/importGarminData.js
git commit -m "feat(garmin): update job handler for OAuth tokens"
```

---

## Task 7: Update Frontend UI for OAuth Flow

**Files:**
- Modify: `client/src/pages/DataSourcesPage.jsx`

**Step 1: Update Garmin connection UI**

In `client/src/pages/DataSourcesPage.jsx`, replace Garmin section:

```javascript
// Remove username/password state
// Add OAuth flow

const handleGarminConnect = async () => {
  setGarminConnecting(true);

  try {
    const response = await fetch(`${API_URL}/api/garmin/connect`, {
      headers: {
        'x-auth-token': authToken
      }
    });

    const data = await response.json();

    if (data.authUrl) {
      // Redirect to Garmin OAuth
      window.location.href = data.authUrl;
    } else {
      setError('Failed to initiate Garmin connection');
    }
  } catch (err) {
    console.error('Garmin connect error:', err);
    setError('Failed to connect to Garmin');
  } finally {
    setGarminConnecting(false);
  }
};

// Check for OAuth callback success
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('garmin') === 'connected') {
    setGarminConnected(true);
    setSuccess('Garmin connected successfully!');

    // Clean URL
    window.history.replaceState({}, '', '/data-sources');
  }
}, []);
```

Update JSX for Garmin card:

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
          Connect your Garmin account to sync activities, steps, heart rate, and sleep data.
        </Typography>
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
        <Typography color="success.main" sx={{ mb: 2 }}>
          ✓ Connected
        </Typography>
        <Button
          variant="outlined"
          color="error"
          onClick={handleGarminDisconnect}
        >
          Disconnect
        </Button>
      </>
    )}
  </CardContent>
</Card>
```

**Step 2: Commit**

```bash
git add client/src/pages/DataSourcesPage.jsx
git commit -m "feat(garmin): update UI for OAuth2 flow"
```

---

## Task 8: Write Integration Tests

**Files:**
- Modify: `server/routes/garmin.test.js`

**Step 1: Update tests for OAuth flow**

Replace contents of `server/routes/garmin.test.js`:

```javascript
const request = require('supertest');
const app = require('../server');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const garminOAuth = require('../services/garminOAuth');

jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/garminOAuth');
jest.mock('../jobs/queue', () => ({
  getQueue: jest.fn(() => ({
    send: jest.fn().mockResolvedValue('job-id')
  }))
}));

describe('Garmin OAuth Routes', () => {
  const mockToken = 'test-token';
  const mockUser = { id: 1, username: 'testuser' };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findBySecretToken.mockResolvedValue(mockUser);
  });

  describe('GET /api/garmin/connect', () => {
    it('should return OAuth authorization URL', async () => {
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/oauth?...');

      const res = await request(app)
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toBeDefined();
      expect(res.body.authUrl).toContain('connect.garmin.com');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/garmin/connect');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/garmin/callback', () => {
    it('should exchange OAuth verifier for tokens', async () => {
      garminOAuth.getAccessToken.mockResolvedValue({
        token: 'access-token',
        tokenSecret: 'token-secret'
      });
      garminOAuth.encryptTokens.mockReturnValue('encrypted-tokens');
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .get('/api/garmin/callback')
        .query({
          oauth_token: 'request-token',
          oauth_verifier: 'verifier'
        })
        .set('Cookie', 'connect.sid=session-with-user-id');

      expect(res.status).toBe(302); // Redirect
      expect(garminOAuth.getAccessToken).toHaveBeenCalled();
      expect(User.updateGarminAuth).toHaveBeenCalled();
    });

    it('should reject missing OAuth parameters', async () => {
      const res = await request(app)
        .get('/api/garmin/callback');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/garmin/sync', () => {
    it('should queue sync job when tokens exist', async () => {
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 123 });

      const res = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken)
        .send({ syncType: 'incremental' });

      expect(res.status).toBe(200);
      expect(res.body.jobId).toBe(123);
      expect(res.body.status).toBe('queued');
    });

    it('should reject when Garmin not connected', async () => {
      User.getGarminTokens.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not connected');
    });
  });

  describe('DELETE /api/garmin/disconnect', () => {
    it('should disconnect Garmin and clear tokens', async () => {
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(User.updateGarminAuth).toHaveBeenCalledWith(1, null);
    });
  });
});
```

**Step 2: Run tests**

```bash
cd server
npm test -- garmin.test.js
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add server/routes/garmin.test.js
git commit -m "test(garmin): update integration tests for OAuth2"
```

---

## Task 9: Deploy and Test

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Wait for Render deployment**

Monitor deployment at Render dashboard or via logs:
```bash
npm run logs:view
```

**Step 3: Verify routes are registered**

Check server logs for:
```
Registered routes: /api/garmin
Registered job: import-garmin-data
```

**Step 4: Manual testing checklist**

- [ ] Navigate to Data Sources page
- [ ] Click "Connect Garmin"
- [ ] Complete OAuth flow on Garmin
- [ ] Verify redirect back to app
- [ ] Check database for encrypted OAuth tokens
- [ ] Trigger sync via "Sync all data"
- [ ] Monitor job in database
- [ ] Verify activities imported
- [ ] Verify daily metrics imported
- [ ] Check `last_garmin_sync_at` updated correctly
- [ ] Test incremental sync (run twice)
- [ ] Test disconnect

**Step 5: Final commit**

```bash
git add .
git commit -m "docs: complete Garmin OAuth2 migration"
git push
```

---

## Verification Commands

**Check OAuth tokens stored:**
```sql
SELECT id, username, garmin_oauth_tokens_encrypted IS NOT NULL as has_tokens, garmin_connected_at, last_garmin_sync_at
FROM users;
```

**Check imported activities:**
```sql
SELECT COUNT(*), MIN(start_time), MAX(start_time)
FROM garmin_activities
WHERE user_id = 1;
```

**Check daily metrics:**
```sql
SELECT
  (SELECT COUNT(*) FROM garmin_daily_steps WHERE user_id = 1) as steps,
  (SELECT COUNT(*) FROM garmin_daily_heart_rate WHERE user_id = 1) as hr,
  (SELECT COUNT(*) FROM garmin_daily_sleep WHERE user_id = 1) as sleep;
```

---

## Troubleshooting

**OAuth flow fails:**
- Verify `GARMIN_CONSUMER_KEY` and `GARMIN_CONSUMER_SECRET` in production `.env`
- Check redirect URL matches Garmin Developer Portal exactly
- Verify session middleware is working

**Token expired errors:**
- OAuth tokens may expire - need to implement refresh token flow
- For now: user must disconnect and reconnect

**No data synced:**
- Check Garmin API permissions granted during OAuth
- Verify API endpoints are correct for your region
- Check Garmin API rate limits

**Sync hangs:**
- Check for infinite loops in pagination logic
- Verify safety limits (10,000 activities) are working
- Monitor Garmin API response times

---

## Next Steps

After OAuth migration is complete and tested:

1. **Remove old code:**
   - Delete `server/test-garmin-*.js` test scripts
   - Clean up any unused dependencies

2. **Implement token refresh:**
   - Add refresh token flow for long-lived access
   - Handle token expiration gracefully

3. **Add more metrics:**
   - Body composition
   - Stress levels
   - Training status

4. **Optimize sync:**
   - Implement differential sync (only changed data)
   - Add webhook support for real-time updates
