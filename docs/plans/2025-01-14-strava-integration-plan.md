# Strava Integration - Implementation Plan

**Date:** January 14, 2025
**Context:** Extends Life Visualizer with Strava activity data
**Related:** Complements existing Garmin integration (Garmin = daily metrics, Strava = activities)

## Overview

This plan adds Strava as the primary source for mapped and unmapped activities, replacing Garmin for activity tracking while keeping Garmin for daily health metrics (steps, heart rate, sleep). This follows the same architectural patterns as the Garmin OAuth2 integration completed on January 14, 2025.

### Key Decisions

1. **Dual Integration Architecture**: Both `garmin_activities` and `strava_activities` tables coexist
2. **OAuth2 Flow**: Strava OAuth handled from Data Sources page
3. **Full Historical Import**: Import all activities on first connection
4. **API Credentials**: User already has Strava Client ID/Secret
5. **Garmin Activity Toggle**: Users can disable Garmin activity sync to avoid duplicates

### Strava vs Garmin Activities

**Strava becomes primary for:**
- All mapped activities (running, cycling, swimming with GPS)
- All unmapped activities (gym, yoga, etc.)
- Rich activity metadata (photos, kudos, descriptions)
- Social features (segments, achievements)

**Garmin remains for:**
- Daily steps count
- Daily heart rate (min/max/resting)
- Daily sleep metrics
- Background health monitoring
- **Optional:** Activities (if user prefers Garmin over Strava)

### Avoiding Duplicate Activities

To prevent duplicate activities from both sources, users can:
1. **Default (Recommended)**: Connect Strava for activities, Garmin for daily metrics only
2. **Garmin Only**: Keep Garmin activities enabled, don't connect Strava
3. **Both Sources**: Enable both if activities are recorded on only one platform

**Implementation:** Add `garmin_sync_activities` boolean column to users table (default: `true` for backward compatibility)

---

## Part 0: Garmin Activity Toggle

**Estimated Time:** 0.5 days

This prerequisite step adds the ability to disable Garmin activity sync, allowing users to use Strava as their sole activity source while keeping Garmin for daily metrics.

### Migration: Add Garmin Activity Sync Toggle

**File:** `server/db/migrations/008_add_garmin_activity_toggle.sql`

```sql
-- Add toggle for Garmin activity sync
-- Default to true for backward compatibility (existing users keep activity sync)
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_sync_activities BOOLEAN DEFAULT true;

-- Add helpful comment
COMMENT ON COLUMN users.garmin_sync_activities IS 'When false, Garmin sync only imports daily metrics (steps, HR, sleep), not activities';
```

### Update Garmin Sync Service

**File:** `server/services/garminSync.js`

Update `incrementalSync()` and `fullHistoricalSync()` to check the toggle:

```javascript
// In garminSync.js

async fullHistoricalSync(encryptedTokens, userId, yearsBack = 5, onProgress = null) {
  const today = new Date();
  const startDate = new Date();
  startDate.setFullYear(today.getFullYear() - yearsBack);

  // Check if user wants activity sync
  const user = await User.findById(userId);
  const syncActivities = user.garmin_sync_activities !== false; // Default to true

  let activityResult = { imported: 0, fetched: 0 };

  if (syncActivities) {
    activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
  } else {
    console.log(`[GARMIN SYNC] Skipping activities for user ${userId} (garmin_sync_activities=false)`);
  }

  const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

  return {
    success: true,
    activities: activityResult,
    dailyMetrics: metricsResult
  };
}

async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null) {
  const startDate = lastSyncDate ? new Date(lastSyncDate) : new Date();
  startDate.setDate(startDate.getDate() - 7); // CRITICAL: 7-day lookback

  const today = new Date();

  console.log(`[GARMIN SYNC] Incremental sync from ${startDate.toISOString().split('T')[0]}`);

  // Check if user wants activity sync
  const user = await User.findById(userId);
  const syncActivities = user.garmin_sync_activities !== false; // Default to true

  let activityResult = { imported: 0, fetched: 0 };

  if (syncActivities) {
    activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
  } else {
    console.log(`[GARMIN SYNC] Skipping activities for user ${userId} (garmin_sync_activities=false)`);
  }

  const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

  return {
    success: true,
    activities: activityResult,
    dailyMetrics: metricsResult
  };
}
```

### Update Garmin Status Endpoint

**File:** `server/routes/garmin.js`

Update `/api/garmin/status` to include the toggle state:

```javascript
router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.garmin_oauth_tokens_encrypted) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      connectedAt: user.garmin_connected_at,
      lastSyncAt: user.last_garmin_sync_at,
      syncActivities: user.garmin_sync_activities !== false // Include toggle state
    });
  } catch (error) {
    console.error('[GARMIN STATUS] Error:', error);
    res.status(500).json({ error: 'Failed to get Garmin status' });
  }
});
```

### Add Toggle Settings Endpoint

**File:** `server/routes/garmin.js`

Add new endpoint to update the toggle:

```javascript
router.post('/settings', requireAuth, async (req, res) => {
  try {
    const { syncActivities } = req.body;

    if (typeof syncActivities !== 'boolean') {
      return res.status(400).json({ error: 'syncActivities must be a boolean' });
    }

    await User.updateGarminSyncSettings(req.user.id, { syncActivities });

    res.json({
      success: true,
      syncActivities
    });
  } catch (error) {
    console.error('[GARMIN SETTINGS] Error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});
```

### Update User Model

**File:** `server/models/user.js`

Add method to update Garmin sync settings:

```javascript
class User {
  // ... existing methods ...

  static async updateGarminSyncSettings(userId, { syncActivities }) {
    const result = await db.query(
      `UPDATE users
       SET garmin_sync_activities = $1
       WHERE id = $2
       RETURNING id`,
      [syncActivities, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }
}
```

### Update Frontend Data Sources Page

**File:** `client/src/pages/DataSourcesPage.jsx`

Add toggle UI in the Garmin card:

```jsx
{garminStatus.connected && (
  <>
    <Typography variant="body2" mb={1}>
      Connected at: {formatDate(garminStatus.connectedAt)}
    </Typography>
    <Typography variant="body2" mb={2}>
      Last synced: {formatLastSync(garminStatus.lastSyncAt)}
    </Typography>

    {/* NEW: Activity sync toggle */}
    <FormControlLabel
      control={
        <Switch
          checked={garminStatus.syncActivities}
          onChange={handleGarminToggleActivities}
          disabled={updatingGarmin}
        />
      }
      label="Sync activities (disable if using Strava)"
      sx={{ mb: 2 }}
    />

    <Box display="flex" gap={1}>
      <Button
        variant="outlined"
        onClick={handleGarminSync}
        disabled={syncingGarmin}
      >
        {syncingGarmin ? 'Syncing...' : 'Sync Now'}
      </Button>
      <Button
        variant="outlined"
        color="error"
        onClick={handleGarminDisconnect}
      >
        Disconnect
      </Button>
    </Box>
  </>
)}
```

**Toggle Handler:**
```javascript
const handleGarminToggleActivities = async (event) => {
  const newValue = event.target.checked;
  setUpdatingGarmin(true);

  try {
    const response = await fetch('/api/garmin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ syncActivities: newValue })
    });

    if (response.ok) {
      setGarminStatus(prev => ({ ...prev, syncActivities: newValue }));
      setSuccessMessage(
        newValue
          ? 'Garmin activity sync enabled'
          : 'Garmin activity sync disabled (daily metrics only)'
      );
    } else {
      setError('Failed to update Garmin settings');
    }
  } catch (error) {
    setError('Failed to update Garmin settings');
  } finally {
    setUpdatingGarmin(false);
  }
};
```

### Testing Checklist

- [ ] Migration adds `garmin_sync_activities` column
- [ ] Default value is `true` (backward compatible)
- [ ] Garmin sync skips activities when toggle is `false`
- [ ] Garmin sync still imports daily metrics when toggle is `false`
- [ ] Status endpoint returns toggle state
- [ ] Settings endpoint updates toggle correctly
- [ ] Frontend toggle UI works
- [ ] Toggle persists across page reloads
- [ ] Existing users keep activity sync enabled by default

---

## Part 1: Database Schema

**Estimated Time:** 0.5 days

### Migration 1: Strava Activities Table

**File:** `server/db/migrations/009_add_strava_activities.sql`

```sql
-- Strava activities table (replaces Garmin activities for activity tracking)
CREATE TABLE strava_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT UNIQUE NOT NULL,

  -- Activity metadata
  activity_type VARCHAR(100),  -- Run, Ride, Swim, Workout, Yoga, etc.
  activity_name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  start_latlng GEOGRAPHY(POINT, 4326),
  end_latlng GEOGRAPHY(POINT, 4326),

  -- Activity metrics
  duration_seconds INTEGER NOT NULL,
  moving_time_seconds INTEGER,
  distance_meters DECIMAL(10, 2),
  total_elevation_gain DECIMAL(10, 2),
  calories INTEGER,

  -- Performance metrics
  avg_speed DECIMAL(5, 2),
  max_speed DECIMAL(5, 2),
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_cadence DECIMAL(5, 2),
  avg_watts DECIMAL(7, 2),

  -- GPS tracklog for mapped activities (PostGIS LineString)
  tracklog GEOGRAPHY(LINESTRING, 4326),

  -- Strava-specific features
  is_private BOOLEAN DEFAULT false,
  kudos_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  achievement_count INTEGER DEFAULT 0,

  -- Links
  strava_url TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strava_activities_user_id ON strava_activities(user_id);
CREATE INDEX idx_strava_activities_start_time ON strava_activities(start_time);
CREATE INDEX idx_strava_activities_type ON strava_activities(activity_type);
CREATE INDEX idx_strava_activities_tracklog ON strava_activities USING GIST(tracklog);
CREATE INDEX idx_strava_activities_strava_id ON strava_activities(strava_activity_id);
```

### Migration 2: Strava Activity Photos Table

**File:** `server/db/migrations/010_add_strava_activity_photos.sql`

```sql
-- Strava activity photos
CREATE TABLE strava_activity_photos (
  id SERIAL PRIMARY KEY,
  strava_activity_id INTEGER REFERENCES strava_activities(id) ON DELETE CASCADE,
  strava_photo_id BIGINT UNIQUE NOT NULL,

  -- Photo URLs (Strava provides multiple sizes)
  photo_url_full TEXT NOT NULL,
  photo_url_600 TEXT,
  photo_url_300 TEXT,

  -- Photo metadata
  caption TEXT,
  location GEOGRAPHY(POINT, 4326),
  created_at_strava TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strava_photos_activity ON strava_activity_photos(strava_activity_id);
CREATE INDEX idx_strava_photos_location ON strava_activity_photos USING GIST(location);
```

### Migration 3: User Strava Auth Columns

**File:** `server/db/migrations/011_add_strava_auth.sql`

```sql
-- Add Strava OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_oauth_tokens_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS strava_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_strava_sync_at TIMESTAMP;
```

### Database Models

Create model files following existing patterns:

**Files to create:**
- `server/models/stravaActivity.js`
- `server/models/stravaActivityPhoto.js`

---

## Part 2: Strava OAuth Service

**Estimated Time:** 1.5 days

### Task 2.1: OAuth Service Implementation

**File:** `server/services/stravaOAuth.js`

Following the pattern from `garminOAuth.js` (commit 11f6440), implement:

**Key Functions:**
```javascript
class StravaOAuthService {
  // OAuth2 standard flow (no PKCE)
  getAuthorizationUrl(redirectUri, scope)
  exchangeCodeForToken(code, redirectUri)
  refreshAccessToken(encryptedTokens)

  // Token management
  encryptTokens(tokens)
  decryptTokens(encryptedTokens)

  // API requests
  makeAuthenticatedRequest(encryptedTokens, endpoint, params)

  // Athlete info
  getAthleteProfile(encryptedTokens)
}
```

**Implementation Notes:**
1. Strava OAuth2 uses **standard OAuth2** (NOT PKCE - unlike Garmin, Strava does not support PKCE)
2. Access tokens expire in 6 hours, refresh tokens do not expire
3. Tokens must be refreshed proactively when expired
4. Base URL: `https://www.strava.com/api/v3`
5. OAuth endpoints:
   - Authorization: `https://www.strava.com/oauth/authorize`
   - Token exchange: `https://www.strava.com/oauth/token`

**Environment Variables Required:**
```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://swarm-visualiser.vercel.app/data-sources
```

### Task 2.2: OAuth Flow Integration

**File:** `server/routes/strava.js`

```javascript
// OAuth initiation
GET /api/strava/auth/start
  - Generate authorization URL (no PKCE needed for Strava)
  - Store user ID in session
  - Return authorization URL

// OAuth callback
POST /api/strava/auth/callback
  - Receive { code, state, scope }
  - Retrieve user ID from session
  - Exchange code for tokens
  - Store encrypted tokens in users table
  - Update strava_athlete_id, strava_connected_at
  - Return success

// Connection status
GET /api/strava/status
  - Return connection status, athlete info, last sync time

// Disconnect
POST /api/strava/disconnect
  - Clear strava_oauth_tokens_encrypted
  - Clear strava_connected_at, last_strava_sync_at
  - Return success
```

---

## Part 3: Strava Sync Service

**Estimated Time:** 2 days

### Task 3.1: Activity Sync Service

**File:** `server/services/stravaSync.js`

Following the pattern from `garminSync.js` (commit 11f6440), implement:

**Core Methods:**
```javascript
class StravaSyncService {
  /**
   * Sync activities from Strava API
   * CRITICAL: Implements lessons learned from Foursquare/Garmin sync
   * - Only updates last_sync when items actually imported
   * - Uses bulkInsert return value, not array length
   * - 7-day lookback for incremental sync
   */
  async syncActivities(encryptedTokens, userId, afterDate = null, onProgress = null)

  /**
   * Sync activity photos for mapped activities
   */
  async syncActivityPhotos(encryptedTokens, userId, activityIds, onProgress = null)

  /**
   * Full historical sync
   */
  async fullHistoricalSync(encryptedTokens, userId, onProgress = null)

  /**
   * Incremental sync with 7-day lookback
   */
  async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null)

  /**
   * Transform Strava activity to database format
   */
  transformActivity(activity, userId)

  /**
   * Decode Google polyline format (Strava uses same format as Garmin)
   */
  decodePolyline(encoded)
}
```

**Implementation Details:**

1. **Activity Pagination:**
   ```javascript
   // Strava paging: page=1, per_page=200 (max)
   GET /api/v3/athlete/activities?page=1&per_page=200&after=1609459200
   ```

2. **Detailed Activity Fetch:**
   ```javascript
   // List endpoint returns summary, need details for tracklog
   GET /api/v3/activities/:id
   ```

3. **Rate Limits:**
   - 100 requests per 15 minutes
   - 1000 requests per day
   - Implement exponential backoff

4. **Activity Types:**
   Map Strava types to internal types:
   - `Run` → Running
   - `Ride` → Cycling
   - `Swim` → Swimming
   - `Workout` → Gym
   - `Yoga` → Yoga
   - `WeightTraining` → Strength
   - etc.

5. **Tracklog Parsing:**
   - Strava provides `map.summary_polyline` (summary)
   - Strava provides `map.polyline` (detailed) - requires detail fetch
   - Use Google polyline decoding (same as Garmin)
   - Convert to PostGIS LINESTRING format

### Task 3.2: Photo Sync Service

**Photos are nested in activity details:**
```javascript
{
  "photos": {
    "primary": {
      "id": 123456,
      "urls": {
        "100": "https://...",
        "600": "https://..."
      }
    },
    "count": 3
  }
}
```

**Photo Sync Strategy:**
1. During activity sync, check `photo_count > 0`
2. Fetch activity details to get photo IDs
3. Fetch photo details via `/api/v3/activities/:id/photos`
4. Store URLs and metadata in `strava_activity_photos`

---

## Part 4: Background Job

**Estimated Time:** 0.5 days

### Task 4.1: Create Strava Import Job

**File:** `server/jobs/importStravaData.js`

Following pattern from `importGarminData.js` (commit 11f6440):

```javascript
module.exports = async function importStravaDataHandler(job) {
  const { userId, syncType = 'incremental' } = job.data;

  try {
    // 1. Get user's encrypted tokens
    // 2. Determine sync strategy (full vs incremental)
    // 3. Call stravaSync.fullHistoricalSync() or incrementalSync()
    // 4. Update last_strava_sync_at on success
    // 5. Report progress via job.progress()
    // 6. Handle errors gracefully

    // CRITICAL: Only update last_strava_sync_at if items actually imported
    if (result.imported > 0) {
      await User.updateLastStravaSync(userId);
    }
  } catch (error) {
    console.error('[STRAVA JOB] Error:', error);
    throw error; // pg-boss will retry
  }
};
```

### Task 4.2: Register Job in Server

**File:** `server/server.js`

Add job registration:
```javascript
const importStravaDataHandler = require('./jobs/importStravaData');

await queue.work('import-strava-data', { teamSize: 2, teamConcurrency: 1 }, importStravaDataHandler);
console.log('Registered job: import-strava-data');
```

---

## Part 5: API Routes

**Estimated Time:** 1 day

### Task 5.1: Complete Strava Routes

**File:** `server/routes/strava.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const stravaOAuth = require('../services/stravaOAuth');
const stravaSync = require('../services/stravaSync');
const { getQueue } = require('../jobs/queue');
const User = require('../models/user');

// OAuth flow
router.get('/auth/start', requireAuth, async (req, res) => {
  // Generate PKCE parameters
  // Store code_verifier in session
  // Return authorization URL
});

router.post('/auth/callback', requireAuth, async (req, res) => {
  // Exchange code for tokens
  // Store encrypted tokens
  // Trigger initial import job
});

// Connection management
router.get('/status', requireAuth, async (req, res) => {
  // Return connection status
});

router.post('/disconnect', requireAuth, async (req, res) => {
  // Clear OAuth tokens
});

// Manual sync trigger
router.post('/sync', requireAuth, async (req, res) => {
  // Queue import-strava-data job
  // Return job ID
});

// Sync status
router.get('/sync/status/:jobId', requireAuth, async (req, res) => {
  // Check job status in pg-boss
});

module.exports = router;
```

### Task 5.2: Register Routes in Server

**File:** `server/server.js`

Add route registration:
```javascript
app.use('/api/strava', require('./routes/strava'));
```

---

## Part 6: Frontend Integration

**Estimated Time:** 1.5 days

### Task 6.1: Update Data Sources Page

**File:** `client/src/pages/DataSourcesPage.jsx`

Add Strava connection UI following the Garmin pattern:

```jsx
<Card>
  <CardContent>
    <Box display="flex" alignItems="center" mb={2}>
      <img src="/strava-logo.svg" alt="Strava" width={40} height={40} />
      <Typography variant="h6" ml={2}>Strava</Typography>
      {stravaStatus.connected && (
        <Chip label="Connected" color="success" size="small" ml={2} />
      )}
    </Box>

    <Typography variant="body2" color="text.secondary" mb={2}>
      Import your runs, rides, and other activities with GPS tracklogs
    </Typography>

    {!stravaStatus.connected ? (
      <Button
        variant="contained"
        color="primary"
        onClick={handleStravaConnect}
      >
        Connect Strava
      </Button>
    ) : (
      <>
        <Typography variant="body2" mb={1}>
          Athlete ID: {stravaStatus.athleteId}
        </Typography>
        <Typography variant="body2" mb={2}>
          Last synced: {formatLastSync(stravaStatus.lastSyncAt)}
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={handleStravaSync}
            disabled={syncingStrava}
          >
            {syncingStrava ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleStravaDisconnect}
          >
            Disconnect
          </Button>
        </Box>
      </>
    )}
  </CardContent>
</Card>
```

**OAuth Flow Logic:**
```javascript
const handleStravaConnect = async () => {
  try {
    // 1. Call /api/strava/auth/start to get authorization URL
    const response = await fetch('/api/strava/auth/start', {
      headers: { 'x-auth-token': token }
    });
    const { authorizationUrl } = await response.json();

    // 2. Redirect to Strava OAuth page
    window.location.href = authorizationUrl;

    // 3. Strava redirects back to /data-sources?code=...&state=...
    // 4. DataSourcesPage detects URL params and calls callback
  } catch (error) {
    setError('Failed to initiate Strava connection');
  }
};

useEffect(() => {
  // Handle OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (code && state && state.startsWith('strava_')) {
    handleStravaCallback(code, state);
  }
}, []);

const handleStravaCallback = async (code, state) => {
  try {
    // Exchange code for tokens
    const response = await fetch('/api/strava/auth/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ code, state })
    });

    const result = await response.json();

    if (response.ok) {
      // Clear URL params
      window.history.replaceState({}, '', '/data-sources');

      // Refresh status
      await fetchStravaStatus();

      setSuccessMessage('Strava connected! Initial sync started.');
    } else {
      setError(result.message || 'Failed to connect Strava');
    }
  } catch (error) {
    setError('Failed to complete Strava connection');
  }
};
```

### Task 6.2: Add Strava Logo Asset

**File:** `client/public/strava-logo.svg`

Download official Strava logo from brand assets.

### Task 6.3: Update Sync All Button

**File:** Update sync all functionality to include Strava

```javascript
const handleSyncAll = async () => {
  setSyncingAll(true);

  try {
    // Sync Foursquare
    await fetch('/api/sync/foursquare', { ... });

    // Sync Strava (if connected)
    if (stravaStatus.connected) {
      await fetch('/api/strava/sync', { ... });
    }

    // Sync Garmin (if connected)
    if (garminStatus.connected) {
      await fetch('/api/garmin/sync', { ... });
    }

    setSuccessMessage('All data synced successfully!');
  } catch (error) {
    setError('Sync failed');
  } finally {
    setSyncingAll(false);
  }
};
```

---

## Part 7: Testing

**Estimated Time:** 1.5 days

### Task 7.1: Automated Tests

**File:** `server/routes/strava.test.js`

Following pattern from `garmin.test.js`:

```javascript
const request = require('supertest');
const app = require('../server');
const { mockDb, mockUser } = require('../tests/helpers');

describe('Strava Routes', () => {
  describe('GET /api/strava/auth/start', () => {
    test('generates authorization URL with PKCE', async () => {
      // Test PKCE parameters
      // Verify authorization URL format
    });
  });

  describe('POST /api/strava/auth/callback', () => {
    test('exchanges code for tokens successfully', async () => {
      // Mock Strava token endpoint
      // Verify tokens stored encrypted
      // Verify job queued
    });

    test('handles invalid authorization code', async () => {
      // Test error handling
    });
  });

  describe('GET /api/strava/status', () => {
    test('returns connection status for connected user', async () => {
      // Mock user with Strava tokens
      // Verify response structure
    });

    test('returns not connected for new user', async () => {
      // Test unconnected state
    });
  });

  describe('POST /api/strava/sync', () => {
    test('queues sync job successfully', async () => {
      // Mock queue
      // Verify job created
    });
  });
});
```

**File:** `server/services/stravaSync.test.js`

```javascript
describe('StravaSyncService', () => {
  describe('transformActivity', () => {
    test('converts mapped activity with tracklog', () => {
      // Test tracklog parsing
      // Verify PostGIS format
    });

    test('converts unmapped activity without tracklog', () => {
      // Test activities without GPS
    });

    test('handles various activity types', () => {
      // Test Run, Ride, Swim, Workout, etc.
    });
  });

  describe('syncActivities', () => {
    test('paginates through all activities', async () => {
      // Mock multiple pages
      // Verify all activities fetched
    });

    test('uses 7-day lookback for incremental sync', async () => {
      // Verify date calculation
    });

    test('only updates last_sync when items imported', async () => {
      // CRITICAL test from Foursquare lessons
    });
  });

  describe('decodePolyline', () => {
    test('decodes Google polyline format correctly', () => {
      // Test with known polyline
    });
  });
});
```

### Task 7.2: Manual Testing Checklist

**OAuth Flow:**
- [ ] "Connect Strava" button redirects to Strava OAuth page
- [ ] OAuth authorization page shows correct app name and permissions
- [ ] Callback returns to Data Sources page
- [ ] Tokens stored encrypted in database
- [ ] `strava_athlete_id` and `strava_connected_at` populated
- [ ] Initial sync job queued automatically

**Historical Sync:**
- [ ] Full historical sync imports all activities
- [ ] Mapped activities have tracklog data
- [ ] Unmapped activities stored without tracklog
- [ ] Activity photos imported for activities with photos
- [ ] Progress indicator shows sync status
- [ ] Sync completes without errors

**Incremental Sync:**
- [ ] Manual sync button triggers sync job
- [ ] 7-day lookback captures missed activities
- [ ] Only new activities imported (no duplicates)
- [ ] `last_strava_sync_at` updated on success
- [ ] Sync handles no new activities gracefully

**Error Handling:**
- [ ] Expired tokens automatically refreshed
- [ ] Rate limit errors handled with backoff
- [ ] Network errors don't corrupt database
- [ ] Failed sync doesn't update `last_strava_sync_at`
- [ ] User sees clear error messages

**Disconnect:**
- [ ] Disconnect button clears OAuth tokens
- [ ] Connection status updates immediately
- [ ] Strava data remains in database (not deleted)
- [ ] Can reconnect successfully after disconnect

**Integration:**
- [ ] "Sync All Data" includes Strava if connected
- [ ] Strava and Garmin can be connected simultaneously
- [ ] Daily auto-sync job includes Strava
- [ ] Strava activities appear in future Day in Life feature

---

## Part 8: Documentation

**Estimated Time:** 0.5 days

### Task 8.1: Update README

Add Strava integration documentation:

```markdown
### Strava Integration

Connect your Strava account to automatically import all your activities:

1. Navigate to **Data Sources** page
2. Click **Connect Strava**
3. Authorize the app on Strava's OAuth page
4. Wait for initial historical import to complete
5. New activities sync automatically every night

**What gets imported:**
- All mapped activities (with GPS tracklogs)
- All unmapped activities (gym, yoga, etc.)
- Activity photos
- Performance metrics (heart rate, pace, power)
- Social features (kudos count, achievement count)

**Privacy:** Only activities you mark as public or private in Strava are imported. Activity visibility settings are respected.
```

### Task 8.2: Update CHANGELOG

```markdown
## [Unreleased]

### Added
- Strava OAuth2 integration for activity tracking
- Import historical activities from Strava
- Automatic daily sync for new Strava activities
- Activity photos from Strava
- Support for both mapped (GPS) and unmapped activities
- Dual integration support (Strava + Garmin)

### Changed
- Garmin integration now focuses on daily health metrics only
- Activities are now sourced from Strava instead of Garmin
```

### Task 8.3: Create Migration Guide

**File:** `docs/STRAVA_MIGRATION.md`

Document for users migrating from Garmin activities to Strava:

```markdown
# Migrating from Garmin to Strava Activities

## Overview

As of [DATE], the Swarm Visualizer uses Strava as the primary source for activities (runs, rides, gym workouts) and Garmin for daily health metrics (steps, heart rate, sleep).

## What This Means

**Strava is now used for:**
- All activities with or without GPS
- Activity photos and descriptions
- Performance metrics and social features

**Garmin is still used for:**
- Daily step counts
- Daily heart rate statistics
- Sleep tracking

## Migration Steps

1. **Connect Strava:** Go to Data Sources and click "Connect Strava"
2. **Wait for import:** Initial sync will import all your historical activities
3. **Keep Garmin connected:** Your daily metrics will continue to sync from Garmin
4. **Future syncs:** New activities will come from Strava automatically

## Data Preservation

- Existing Garmin activities remain in the database
- They will not be deleted
- Future "Day in Life" feature will show activities from both sources
- You can disconnect Garmin activities if desired (keeps daily metrics)

## FAQ

**Q: Can I use both Garmin and Strava for activities?**
A: Yes, both integrations coexist. You'll see activities from both sources.

**Q: What if I don't use Strava?**
A: You can continue using Garmin activities. Strava is optional.

**Q: Will my old Garmin activities disappear?**
A: No, they remain in the database and will be visible.
```

---

## Part 9: Universal Sync Progress UI

**Estimated Time:** 0.5 days

This part implements real-time progress tracking for all sync operations (Foursquare, Garmin, and Strava), providing a consistent UX across all data sources.

### Goal

Show real-time sync progress with batch updates during long-running sync operations for all data sources.

### Architecture: Polling-Based Progress

**Why Polling:**
- No additional dependencies (no WebSocket/SSE)
- Works with existing REST API
- Sync jobs are slow (minutes), so polling overhead is minimal
- Easy to deploy on Render

**Polling Frequency:** Every 2-3 seconds while job is active

### Backend Changes

#### Task 9.1: Standardize Job Progress Format

All job handlers (Foursquare, Garmin, Strava) must report progress in a consistent format.

**Update** `server/jobs/importCheckins.js`:
```javascript
module.exports = async function importCheckinsHandler(job) {
  const { userId } = job.data;

  try {
    // Report initial progress
    await job.progress({ phase: 'fetching', fetched: 0, imported: 0 });

    // ... fetch logic ...

    // Report batch progress
    await job.progress({
      phase: 'importing',
      fetched: allCheckins.length,
      imported: insertedCount,
      batch: batchNum,
      totalBatches: Math.ceil(allCheckins.length / 100)
    });

    // Report completion
    await job.progress({
      phase: 'completed',
      fetched: allCheckins.length,
      imported: insertedCount
    });

  } catch (error) {
    console.error('[FOURSQUARE JOB] Error:', error);
    throw error;
  }
};
```

**Update** `server/jobs/importGarminData.js`:
```javascript
module.exports = async function importGarminDataHandler(job) {
  const { userId, syncType = 'incremental' } = job.data;

  try {
    // Report initial progress
    await job.progress({ phase: 'starting', service: 'garmin' });

    const user = await User.findById(userId);
    const encryptedTokens = user.garmin_oauth_tokens_encrypted;

    // ... sync logic ...

    // Report progress during sync
    const onProgress = async (progressData) => {
      await job.progress({
        phase: 'syncing',
        service: 'garmin',
        ...progressData
      });
    };

    const result = syncType === 'full'
      ? await garminSync.fullHistoricalSync(encryptedTokens, userId, 5, onProgress)
      : await garminSync.incrementalSync(encryptedTokens, userId, user.last_garmin_sync_at, onProgress);

    // Report completion
    await job.progress({
      phase: 'completed',
      service: 'garmin',
      activities: result.activities,
      dailyMetrics: result.dailyMetrics
    });

  } catch (error) {
    console.error('[GARMIN JOB] Error:', error);
    throw error;
  }
};
```

**Create** `server/jobs/importStravaData.js` (from Part 4, updated with progress):
```javascript
module.exports = async function importStravaDataHandler(job) {
  const { userId, syncType = 'incremental' } = job.data;

  try {
    // Report initial progress
    await job.progress({ phase: 'starting', service: 'strava' });

    const user = await User.findById(userId);
    const encryptedTokens = user.strava_oauth_tokens_encrypted;

    // Report progress during sync
    const onProgress = async (progressData) => {
      await job.progress({
        phase: 'syncing',
        service: 'strava',
        ...progressData
      });
    };

    const result = syncType === 'full'
      ? await stravaSync.fullHistoricalSync(encryptedTokens, userId, onProgress)
      : await stravaSync.incrementalSync(encryptedTokens, userId, user.last_strava_sync_at, onProgress);

    // Report completion
    await job.progress({
      phase: 'completed',
      service: 'strava',
      activities: result.activities,
      photos: result.photos || { count: 0 }
    });

  } catch (error) {
    console.error('[STRAVA JOB] Error:', error);
    throw error;
  }
};
```

#### Task 9.2: Add Job Status Endpoint

**File:** `server/routes/sync.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getQueue } = require('../jobs/queue');

// GET /api/sync/jobs/:jobId - Get job status and progress
router.get('/jobs/:jobId', requireAuth, async (req, res) => {
  try {
    const queue = getQueue();
    const job = await queue.getJobById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get job details from pg-boss
    const progress = job.data.progress || {};
    const state = job.state; // 'created', 'retry', 'active', 'completed', 'expired', 'cancelled', 'failed'

    res.json({
      id: job.id,
      status: mapJobState(state),
      progress,
      startedAt: job.startedon,
      completedAt: job.completedon,
      error: job.output?.message || null
    });

  } catch (error) {
    console.error('[SYNC STATUS] Error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

function mapJobState(pgBossState) {
  switch (pgBossState) {
    case 'created':
    case 'retry':
      return 'queued';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'unknown';
  }
}

module.exports = router;
```

**Register in** `server/server.js`:
```javascript
app.use('/api/sync', require('./routes/sync'));
```

### Frontend Changes

#### Task 9.3: Create Universal Progress Component

**File:** `client/src/components/SyncProgressBar.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Alert,
  Collapse
} from '@mui/material';

const SyncProgressBar = ({ jobId, onComplete, service = 'unknown' }) => {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('queued');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sync/jobs/${jobId}`, {
          headers: { 'x-auth-token': localStorage.getItem('authToken') }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }

        const data = await response.json();
        setStatus(data.status);
        setProgress(data.progress);

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          if (onComplete) onComplete(data);
        }

        if (data.status === 'failed') {
          clearInterval(pollInterval);
          setError(data.error || 'Sync failed');
        }

      } catch (err) {
        console.error('Failed to poll job status:', err);
        setError(err.message);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, onComplete]);

  if (!jobId || !progress) {
    return null;
  }

  // Render progress based on service and phase
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Collapse in={status === 'active' || status === 'queued'}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {renderProgressMessage(service, progress)}
          </Typography>
          <LinearProgress
            variant={progress.phase === 'starting' ? 'indeterminate' : 'determinate'}
            value={calculateProgress(progress)}
            sx={{ mt: 1 }}
          />
        </Box>
      </Collapse>

      <Collapse in={status === 'completed'}>
        <Alert severity="success" sx={{ mt: 1 }}>
          {renderCompletionMessage(service, progress)}
        </Alert>
      </Collapse>

      <Collapse in={status === 'failed'}>
        <Alert severity="error" sx={{ mt: 1 }}>
          {error || 'Sync failed'}
        </Alert>
      </Collapse>
    </Box>
  );
};

function renderProgressMessage(service, progress) {
  if (progress.phase === 'starting') {
    return `Starting ${service} sync...`;
  }

  if (service === 'foursquare') {
    if (progress.phase === 'fetching') {
      return `Fetching check-ins... ${progress.fetched || 0} fetched`;
    }
    if (progress.phase === 'importing') {
      return `Importing batch ${progress.batch}/${progress.totalBatches} - ${progress.imported}/${progress.fetched} check-ins`;
    }
  }

  if (service === 'garmin') {
    if (progress.daysProcessed) {
      return `Syncing daily metrics... ${progress.daysProcessed}/${progress.totalDays} days`;
    }
    if (progress.fetched) {
      return `Syncing activities... ${progress.fetched} fetched`;
    }
  }

  if (service === 'strava') {
    if (progress.fetched) {
      return `Syncing activities... ${progress.fetched} fetched`;
    }
  }

  return `Syncing ${service}...`;
}

function calculateProgress(progress) {
  if (progress.phase === 'starting') return 0;

  if (progress.imported && progress.fetched) {
    return (progress.imported / progress.fetched) * 100;
  }

  if (progress.daysProcessed && progress.totalDays) {
    return (progress.daysProcessed / progress.totalDays) * 100;
  }

  return 0;
}

function renderCompletionMessage(service, progress) {
  if (service === 'foursquare') {
    return `✓ Imported ${progress.imported} check-ins`;
  }

  if (service === 'garmin') {
    const activities = progress.activities?.imported || 0;
    const metrics = progress.dailyMetrics?.totalInserted || 0;
    return `✓ Garmin sync complete: ${activities} activities, ${metrics} daily metrics`;
  }

  if (service === 'strava') {
    const activities = progress.activities?.imported || 0;
    const photos = progress.photos?.count || 0;
    return `✓ Strava sync complete: ${activities} activities${photos > 0 ? `, ${photos} photos` : ''}`;
  }

  return `✓ ${service} sync complete`;
}

export default SyncProgressBar;
```

#### Task 9.4: Integrate into Data Sources Page

**File:** `client/src/pages/DataSourcesPage.jsx`

```jsx
import SyncProgressBar from '../components/SyncProgressBar';

// Add state for active jobs
const [foursquareJobId, setFoursquareJobId] = useState(null);
const [garminJobId, setGarminJobId] = useState(null);
const [stravaJobId, setStravaJobId] = useState(null);

// Update sync handlers to capture jobId
const handleFoursquareSync = async () => {
  setSyncingFoursquare(true);
  try {
    const response = await fetch('/api/sync/foursquare', {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    const result = await response.json();

    if (response.ok) {
      setFoursquareJobId(result.jobId); // Capture job ID
    } else {
      setError(result.message || 'Sync failed');
    }
  } catch (error) {
    setError('Failed to start sync');
  } finally {
    setSyncingFoursquare(false);
  }
};

// Add completion handler
const handleSyncComplete = async (service) => {
  // Refresh status
  await fetchFoursquareStatus(); // or garminStatus, stravaStatus
  setSuccessMessage(`${service} sync complete!`);
};

// In JSX, add progress bars in each service card
<Card>
  <CardContent>
    <Typography variant="h6">Foursquare</Typography>
    {/* ... existing content ... */}

    {foursquareJobId && (
      <SyncProgressBar
        jobId={foursquareJobId}
        service="foursquare"
        onComplete={() => handleSyncComplete('Foursquare')}
      />
    )}
  </CardContent>
</Card>

<Card>
  <CardContent>
    <Typography variant="h6">Garmin</Typography>
    {/* ... existing content ... */}

    {garminJobId && (
      <SyncProgressBar
        jobId={garminJobId}
        service="garmin"
        onComplete={() => handleSyncComplete('Garmin')}
      />
    )}
  </CardContent>
</Card>

<Card>
  <CardContent>
    <Typography variant="h6">Strava</Typography>
    {/* ... existing content ... */}

    {stravaJobId && (
      <SyncProgressBar
        jobId={stravaJobId}
        service="strava"
        onComplete={() => handleSyncComplete('Strava')}
      />
    )}
  </CardContent>
</Card>
```

### Testing Checklist

- [ ] Foursquare sync shows progress bar with batch updates
- [ ] Garmin sync shows progress for activities and daily metrics
- [ ] Strava sync shows progress for activities
- [ ] Progress bars update every 2 seconds
- [ ] Completion messages show correct counts
- [ ] Error states display properly
- [ ] Multiple concurrent syncs work independently
- [ ] Progress persists when switching between services
- [ ] Polling stops when job completes or fails

---

## Part 10: Deployment

**Estimated Time:** 0.5 days

### Task 10.1: Environment Variables

Add to Render environment:

```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://swarm-visualiser.vercel.app/data-sources
```

### Task 10.2: Run Database Migrations

```bash
node server/db/run-migration.js migrations/008_add_garmin_activity_toggle.sql
node server/db/run-migration.js migrations/009_add_strava_activities.sql
node server/db/run-migration.js migrations/010_add_strava_activity_photos.sql
node server/db/run-migration.js migrations/011_add_strava_auth.sql
```

### Task 10.3: Deploy to Production

```bash
git add .
git commit -m "feat(strava): add OAuth2 integration and activity sync"
git push origin main
```

Monitor deployment via Render logs.

---

## Success Criteria

### Functional Requirements
- [ ] Users can connect Strava via OAuth2 from Data Sources page
- [ ] Historical activities imported on first connection
- [ ] Mapped activities include GPS tracklogs
- [ ] Unmapped activities stored without tracklogs
- [ ] Activity photos imported and stored
- [ ] Incremental sync with 7-day lookback works
- [ ] Manual sync button triggers immediate sync
- [ ] "Sync All Data" includes Strava
- [ ] Users can disconnect Strava
- [ ] Dual integration (Strava + Garmin) works

### Technical Requirements
- [ ] OAuth2 tokens encrypted before storage
- [ ] Tokens refresh automatically when expired
- [ ] Rate limits handled with exponential backoff
- [ ] Database uses PostGIS for tracklog storage
- [ ] All API routes protected with authentication
- [ ] Background jobs handle long-running imports
- [ ] Errors logged and user-friendly messages displayed

### Testing Requirements
- [ ] All automated tests pass (Jest)
- [ ] Manual testing checklist completed
- [ ] OAuth flow tested end-to-end
- [ ] Historical import tested with real Strava account
- [ ] Incremental sync verified over multiple days

---

## Timeline Summary

| Part | Description | Time | Cumulative |
|------|-------------|------|------------|
| 0 | Garmin Activity Toggle | 0.5 days | 0.5 days |
| 1 | Database Schema | 0.5 days | 1 day |
| 2 | Strava OAuth Service | 1.5 days | 2.5 days |
| 3 | Strava Sync Service | 2 days | 4.5 days |
| 4 | Background Job | 0.5 days | 5 days |
| 5 | API Routes | 1 day | 6 days |
| 6 | Frontend Integration | 1.5 days | 7.5 days |
| 7 | Testing | 1.5 days | 9 days |
| 8 | Documentation | 0.5 days | 9.5 days |
| 9 | Universal Sync Progress UI | 0.5 days | 10 days |
| 10 | Deployment | 0.5 days | **10.5 days** |

**Total Estimated Time: 10.5 days** (with testing and documentation)

---

## Future Enhancements (Not in Scope)

- Sync Strava segments and segment efforts
- Import Strava club activities
- Display kudos and comments in UI
- Strava webhook integration for real-time sync
- Route recommendations based on popular segments
- Compare activities with Strava friends
- Export activities back to Strava (bidirectional sync)

---

## Dependencies

### NPM Packages
- `axios` (already installed) - HTTP client for Strava API
- `crypto` (built-in) - For PKCE code generation

### External APIs
- Strava API v3 - https://developers.strava.com/docs/reference/
- Strava OAuth2 - https://developers.strava.com/docs/authentication/

### Database
- PostgreSQL with PostGIS extension (already enabled)

### Existing Infrastructure
- Encryption service (`server/services/encryption.js`)
- Session management (Express sessions)
- Background job queue (pg-boss)
- Authentication middleware (`server/middleware/auth.js`)

---

## Risk Assessment

### High Risk
- **Rate Limits:** Strava has strict rate limits (100 req/15min, 1000 req/day)
  - **Mitigation:** Implement exponential backoff, batch requests, cache aggressively

- **OAuth Token Expiration:** Tokens expire in 6 hours
  - **Mitigation:** Proactive refresh before expiration, graceful retry on 401

### Medium Risk
- **Large Activity Count:** Users with thousands of activities take time to import
  - **Mitigation:** Background jobs, progress indicators, pagination

- **API Changes:** Strava API can change without notice
  - **Mitigation:** Version API requests, monitor Strava changelog, test regularly

### Low Risk
- **Tracklog Parsing:** Polyline decoding is well-established
  - **Mitigation:** Use tested decoding algorithm (same as Garmin)

---

## Lessons Learned from Garmin Integration

Apply these lessons from the Garmin OAuth2 migration (completed Jan 14, 2025):

1. **Only update `last_strava_sync_at` when items actually imported** (not just fetched)
2. **Use `bulkInsert` return value, not array length** for accurate import count
3. **7-day lookback for incremental sync** catches missed data reliably
4. **Encryption key setup is critical** - validate before deployment
5. **Session middleware required for PKCE** - configure early in server.js
6. **Database migration tracking** - keep migrations simple, avoid complex tracking
7. **Test OAuth flow thoroughly** - most issues are in token exchange
8. **Rate limit handling** - build in from the start, not after hitting limits

---

## Appendix: Strava API Reference

### Key Endpoints

**OAuth:**
- `GET https://www.strava.com/oauth/authorize` - Authorization
- `POST https://www.strava.com/oauth/token` - Token exchange & refresh

**Activities:**
- `GET /api/v3/athlete/activities` - List activities (paginated)
- `GET /api/v3/activities/:id` - Activity details (includes tracklog)

**Photos:**
- `GET /api/v3/activities/:id/photos` - Activity photos

**Athlete:**
- `GET /api/v3/athlete` - Current athlete profile

### OAuth Scopes Required

Request these scopes during authorization:
- `read` - Read public profile
- `activity:read` - Read activity data
- `activity:read_all` - Read private activities (important!)

### Sample Activity Response

```json
{
  "id": 12345678901234567,
  "name": "Morning Run",
  "distance": 5208.5,
  "moving_time": 1920,
  "elapsed_time": 2100,
  "total_elevation_gain": 45.2,
  "type": "Run",
  "start_date": "2024-01-15T09:30:00Z",
  "start_latlng": [51.5074, -0.1278],
  "end_latlng": [51.5074, -0.1278],
  "map": {
    "summary_polyline": "encodedPolylineString"
  },
  "average_speed": 2.71,
  "max_speed": 4.5,
  "average_heartrate": 142.5,
  "max_heartrate": 168,
  "calories": 287.5,
  "kudos_count": 12,
  "comment_count": 2,
  "photo_count": 3
}
```

---

**End of Implementation Plan**
