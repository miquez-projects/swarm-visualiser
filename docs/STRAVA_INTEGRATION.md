# Strava Integration Documentation

## Overview

The Strava integration enables users to import their activities (runs, rides, swims, workouts, etc.) from Strava with full GPS tracklogs, performance metrics, and social features. This integration complements the Garmin integration, where Garmin focuses on daily health metrics (steps, heart rate, sleep) and Strava serves as the primary source for activity tracking.

**Key Features:**
- OAuth2 authentication with automatic token refresh
- Full historical activity import (5 years by default)
- Incremental sync with 7-day lookback window
- GPS tracklog storage using PostGIS
- Activity photos import
- Support for both mapped (GPS) and unmapped activities
- Rate limit handling with exponential backoff
- Background job processing for long-running imports

**Implementation Date:** January 2025 (based on plan dated 2025-01-14)

---

## Configuration

### Environment Variables

The following environment variables must be configured on the server:

```bash
# Strava OAuth2 Credentials
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# API Base URL (for OAuth callback)
API_URL=https://your-api-domain.com
```

**Obtaining Strava API Credentials:**
1. Go to https://www.strava.com/settings/api
2. Create a new API application
3. Set Authorization Callback Domain to your frontend domain (e.g., `swarm-visualiser.vercel.app`)
4. Copy Client ID and Client Secret

**OAuth Scopes Required:**
- `read` - Read public profile
- `activity:read` - Read public activity data
- `activity:read_all` - Read private activities (critical for full sync)

### Database Requirements

- PostgreSQL with PostGIS extension enabled
- Migrations must be run in order (008, 009, 010, 011)

---

## User Guide

### How to Connect Strava

1. Navigate to the **Data Sources** page in the application
2. Find the Strava card and click **Connect Strava**
3. You'll be redirected to Strava's OAuth authorization page
4. Click **Authorize** to grant the app access to your activities
5. You'll be redirected back to the Data Sources page
6. An initial full historical sync will start automatically (imports up to 5 years of activities)

### How to Sync Activities

**Automatic Sync:**
- Activities sync automatically during the nightly background job
- No user action required once connected

**Manual Sync:**
1. Go to the **Data Sources** page
2. In the Strava card, click **Sync Now**
3. Wait for the sync to complete (progress shown in the UI)

**Sync All Data:**
- Use the **Sync All Data** button to sync Foursquare, Garmin, and Strava simultaneously

### How to Disconnect Strava

1. Go to the **Data Sources** page
2. In the Strava card, click **Disconnect**
3. Your OAuth tokens will be removed
4. Note: Your previously imported activities remain in the database and are not deleted

### Avoiding Duplicate Activities

If you use both Garmin and Strava and record activities on both platforms, you may get duplicates. To prevent this:

**Option 1 (Recommended): Disable Garmin Activity Sync**
1. Connect Strava for activities
2. In the Garmin card, toggle off **"Sync activities"**
3. Garmin will only sync daily metrics (steps, heart rate, sleep)
4. Strava becomes your sole activity source

**Option 2: Use Only One Platform**
- Only connect Garmin OR Strava, not both for activities

**Option 3: Accept Duplicates**
- If you record different activities on each platform, keep both enabled
- The app stores them separately in different tables

---

## Technical Architecture

### OAuth2 Flow

The integration uses standard OAuth2 (NOT PKCE, unlike Garmin):

```
User → Frontend → Backend → Strava OAuth
                     ↓
              Token Exchange
                     ↓
            Encrypted Storage
                     ↓
          Background Job Queued
```

**Key Components:**

1. **`stravaOAuth.js`** - OAuth service
   - Generates authorization URLs
   - Exchanges authorization codes for tokens
   - Refreshes expired tokens
   - Encrypts/decrypts token bundles
   - Makes authenticated API requests with retry logic

2. **`stravaSync.js`** - Sync service
   - Fetches activities from Strava API with pagination
   - Fetches detailed activity data (including full polylines)
   - Transforms Strava data to database format
   - Decodes Google polyline format to PostGIS LineString
   - Syncs activity photos
   - Implements 7-day lookback for incremental sync

3. **`importStravaData.js`** - Background job
   - Processes sync operations asynchronously
   - Reports progress via ImportJob table
   - Handles full and incremental sync types
   - Only updates last_sync timestamp when items are imported

### Token Management

**Token Lifecycle:**
- Access tokens expire in 6 hours
- Refresh tokens do not expire
- Tokens are refreshed automatically before expiry (5-minute buffer)
- Tokens are encrypted using AES-256-CBC before storage

**Refresh Strategy:**
- Proactive: Check expiry before each API request
- Reactive: Retry with refresh on 401 Unauthorized

### Rate Limiting

Strava API limits:
- 100 requests per 15 minutes
- 1000 requests per day

**Handling:**
- Exponential backoff on 429 errors
- Batch processing (10 activities at a time for detail fetches)
- Maximum 3 retries before failing

### Data Sync Strategy

**Full Historical Sync (Initial Import):**
- Triggered on first connection
- Imports activities from the last 5 years
- Fetches summary list, then detailed data for each activity
- Includes GPS tracklogs and photos

**Incremental Sync:**
- Triggered by manual sync or nightly job
- 7-day lookback window (prevents missing data)
- Only imports new activities
- Updates existing activities if modified

**Critical Implementation Detail:**
The `last_strava_sync_at` timestamp is ONLY updated when items are actually imported. This prevents a vicious cycle where:
1. Empty sync updates timestamp
2. Next sync starts from new timestamp
3. Misses data added between syncs
4. Data never gets imported

---

## Data Model

### Database Tables

#### `strava_activities`

Stores activity data with GPS tracklogs and metrics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `user_id` | INTEGER | Foreign key to users table |
| `strava_activity_id` | BIGINT | Strava's unique activity ID |
| `activity_type` | VARCHAR(100) | Run, Ride, Swim, Workout, Yoga, etc. |
| `activity_name` | TEXT | Activity title/name |
| `description` | TEXT | Activity description |
| `start_time` | TIMESTAMP | Activity start time |
| `start_latlng` | GEOGRAPHY(POINT) | Starting GPS coordinates |
| `end_latlng` | GEOGRAPHY(POINT) | Ending GPS coordinates |
| `duration_seconds` | INTEGER | Total elapsed time |
| `moving_time_seconds` | INTEGER | Time spent moving |
| `distance_meters` | DECIMAL(10,2) | Distance in meters |
| `total_elevation_gain` | DECIMAL(10,2) | Elevation gain in meters |
| `calories` | INTEGER | Estimated calories burned |
| `avg_speed` | DECIMAL(5,2) | Average speed (m/s) |
| `max_speed` | DECIMAL(5,2) | Maximum speed (m/s) |
| `avg_heart_rate` | INTEGER | Average heart rate (bpm) |
| `max_heart_rate` | INTEGER | Maximum heart rate (bpm) |
| `avg_cadence` | DECIMAL(5,2) | Average cadence (steps/min or rpm) |
| `avg_watts` | DECIMAL(7,2) | Average power output (watts) |
| `tracklog` | GEOGRAPHY(LINESTRING) | GPS tracklog (PostGIS) |
| `is_private` | BOOLEAN | Whether activity is private on Strava |
| `kudos_count` | INTEGER | Number of kudos received |
| `comment_count` | INTEGER | Number of comments |
| `photo_count` | INTEGER | Number of photos |
| `achievement_count` | INTEGER | Number of achievements |
| `strava_url` | TEXT | Link to activity on Strava |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Indexes:**
- `idx_strava_activities_user_activity` (UNIQUE) on `(user_id, strava_activity_id)`
- `idx_strava_activities_user_id` on `user_id`
- `idx_strava_activities_start_time` on `start_time`
- `idx_strava_activities_type` on `activity_type`
- `idx_strava_activities_tracklog` (GIST) on `tracklog`

#### `strava_activity_photos`

Stores photos associated with activities.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `strava_activity_id` | INTEGER | Foreign key to strava_activities |
| `strava_photo_id` | BIGINT | Strava's unique photo ID |
| `photo_url_full` | TEXT | Full resolution photo URL |
| `photo_url_600` | TEXT | 600px photo URL |
| `photo_url_300` | TEXT | 300px photo URL |
| `caption` | TEXT | Photo caption |
| `location` | GEOGRAPHY(POINT) | Photo GPS location |
| `created_at_strava` | TIMESTAMP | Photo creation time on Strava |
| `created_at` | TIMESTAMP | Record creation time |

**Indexes:**
- `idx_strava_photos_activity` on `strava_activity_id`
- `idx_strava_photos_location` (GIST) on `location`

#### `users` (Strava-related columns)

Authentication and sync tracking columns added to existing users table.

| Column | Type | Description |
|--------|------|-------------|
| `strava_oauth_tokens_encrypted` | TEXT | Encrypted OAuth tokens |
| `strava_athlete_id` | BIGINT | Strava athlete ID |
| `strava_connected_at` | TIMESTAMP | When Strava was connected |
| `last_strava_sync_at` | TIMESTAMP | Last successful sync time |
| `garmin_sync_activities` | BOOLEAN | Toggle for Garmin activity sync |

---

## API Endpoints

All endpoints require authentication via `x-auth-token` header.

### OAuth Endpoints

#### `GET /api/strava/auth/start`

Initiates OAuth2 flow.

**Response:**
```json
{
  "authUrl": "https://www.strava.com/oauth/authorize?client_id=..."
}
```

#### `POST /api/strava/auth/callback`

Completes OAuth2 flow by exchanging authorization code for tokens.

**Request Body:**
```json
{
  "code": "authorization_code_from_strava"
}
```

**Response:**
```json
{
  "success": true,
  "athleteId": 12345678,
  "jobId": 42
}
```

### Connection Management

#### `GET /api/strava/status`

Get connection status.

**Response (Connected):**
```json
{
  "connected": true,
  "connectedAt": "2025-01-14T10:30:00Z",
  "lastSyncAt": "2025-01-15T08:00:00Z"
}
```

**Response (Not Connected):**
```json
{
  "connected": false
}
```

#### `POST /api/strava/disconnect`

Disconnect Strava account.

**Response:**
```json
{
  "success": true
}
```

### Sync Endpoints

#### `POST /api/strava/sync`

Trigger manual sync.

**Request Body (Optional):**
```json
{
  "syncType": "incremental"  // or "full"
}
```

**Response:**
```json
{
  "jobId": 43,
  "status": "queued"
}
```

#### `GET /api/strava/sync/status/:jobId`

Check sync job status.

**Response:**
```json
{
  "jobId": 43,
  "status": "active",
  "totalImported": 150,
  "totalExpected": 200,
  "currentBatch": 15,
  "startedAt": "2025-01-15T10:00:00Z",
  "completedAt": null,
  "errorMessage": null
}
```

**Job Statuses:**
- `queued` - Waiting to start
- `active` - Currently running
- `completed` - Successfully finished
- `failed` - Failed with error

---

## Troubleshooting

### Common Issues

#### 1. "Failed to connect Strava"

**Possible Causes:**
- Invalid Client ID or Client Secret
- Incorrect callback URL configuration
- Network connectivity issues

**Solutions:**
- Verify environment variables are set correctly
- Check Strava API application settings
- Ensure callback domain matches your frontend domain

#### 2. "OAuth token expired and refresh failed"

**Possible Causes:**
- User revoked app access on Strava
- Refresh token became invalid
- Strava API issues

**Solutions:**
- Disconnect and reconnect Strava
- Check Strava API status page
- Verify encryption key hasn't changed

#### 3. Activities not syncing

**Possible Causes:**
- No new activities in Strava
- Rate limit exceeded
- Network issues during sync

**Solutions:**
- Check Strava account for activities in the time range
- Wait 15 minutes if rate limited
- Check server logs for detailed error messages
- Try manual sync from Data Sources page

#### 4. Duplicate activities

**Possible Causes:**
- Both Garmin and Strava activity sync enabled
- Activities recorded on both platforms

**Solutions:**
- Disable Garmin activity sync (toggle in Garmin card)
- Only use one platform for activity tracking
- Check `garmin_sync_activities` column in database

#### 5. Missing GPS tracklogs

**Possible Causes:**
- Activity doesn't have GPS data (indoor workouts)
- Strava privacy settings hide GPS data
- API didn't return detailed activity data

**Solutions:**
- Check activity on Strava website for GPS data
- Verify activity privacy settings on Strava
- Manually re-sync to fetch detailed data
- Check server logs for detail fetch errors

#### 6. Rate limit errors (429)

**Possible Causes:**
- Too many API requests in short time
- Multiple users syncing simultaneously
- Large activity count

**Solutions:**
- Wait 15 minutes for rate limit window to reset
- Reduce concurrent syncs (backend handles this automatically)
- Check pg-boss job concurrency settings

### Debug Checklist

When troubleshooting Strava integration issues:

1. Check server logs for error messages
   - Look for `[STRAVA OAUTH]`, `[STRAVA SYNC]`, `[STRAVA ROUTE]` prefixes

2. Verify environment variables
   ```bash
   echo $STRAVA_CLIENT_ID
   echo $STRAVA_CLIENT_SECRET
   ```

3. Check database connection status
   ```sql
   SELECT
     id,
     strava_athlete_id,
     strava_connected_at,
     last_strava_sync_at
   FROM users
   WHERE id = [user_id];
   ```

4. Check for recent activities in database
   ```sql
   SELECT COUNT(*)
   FROM strava_activities
   WHERE user_id = [user_id]
   AND start_time > NOW() - INTERVAL '7 days';
   ```

5. Check import job status
   ```sql
   SELECT *
   FROM import_jobs
   WHERE user_id = [user_id]
   AND data_source = 'strava'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

6. Test OAuth tokens manually
   ```bash
   # Get encrypted tokens from database
   # Decrypt and test API request
   curl -H "Authorization: Bearer [access_token]" \
        https://www.strava.com/api/v3/athlete
   ```

### Server Logs

Monitor logs for Strava-related operations:

```bash
# If using CLAUDE.md logging setup
npm run logs:view

# Search for Strava-specific logs
grep "STRAVA" logs/render-stream.log
grep "error" logs/render-stream.log | grep -i strava
```

### Performance Optimization

**For Large Activity Counts (1000+ activities):**
- Initial import may take 10-30 minutes
- Rate limits may cause delays
- Monitor job progress in import_jobs table
- Consider running during off-peak hours

**Database Query Optimization:**
- Ensure PostGIS indexes are used for spatial queries
- Monitor query performance for tracklog queries
- Consider partitioning activities table by date if needed

---

## Migration from Garmin Activities

If you previously used Garmin for activity tracking and want to switch to Strava:

1. **Connect Strava** - Import your Strava activities
2. **Disable Garmin Activity Sync** - Toggle off in Garmin card
3. **Keep Garmin Connected** - For daily health metrics
4. **Verify Data** - Check that activities are importing correctly

**Data Preservation:**
- Existing Garmin activities remain in the database
- Both `garmin_activities` and `strava_activities` tables coexist
- Future features will display activities from both sources

---

## Related Documentation

- Implementation Plan: `/docs/plans/2025-01-14-strava-integration-plan.md`
- Garmin Integration: See Garmin OAuth2 implementation (commit 11f6440)
- PostGIS Documentation: https://postgis.net/docs/
- Strava API Reference: https://developers.strava.com/docs/reference/

---

## Future Enhancements

Not currently implemented, but potential future additions:

- Sync Strava segments and segment efforts
- Import Strava club activities
- Display kudos and comments in activity UI
- Real-time sync via Strava webhooks
- Route recommendations based on popular segments
- Compare activities with Strava friends
- Export activities back to Strava (bidirectional sync)
- Activity photos display in map view
- Training load and fitness metrics
