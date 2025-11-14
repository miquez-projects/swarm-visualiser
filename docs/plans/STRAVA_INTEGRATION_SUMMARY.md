# Strava Integration - Quick Summary

**Date:** January 14, 2025
**Full Plan:** [2025-01-14-strava-integration-plan.md](./2025-01-14-strava-integration-plan.md)

## Quick Overview

Add Strava as the primary activity source, with Garmin focusing on daily health metrics.

**Timeline:** 10.5 days (including Garmin activity toggle and sync progress UI)

## Key Decisions

✅ **Dual Integration** - Both Garmin and Strava activities coexist
✅ **Full Historical Import** - Import all activities on first connection
✅ **OAuth2 from Data Sources page** - Similar to Foursquare flow
✅ **Garmin Activity Toggle** - Users can disable Garmin activities to avoid duplicates

## Data Division

### Strava (Primary for Activities)
- All mapped activities (with GPS tracklogs)
- All unmapped activities (gym, yoga, etc.)
- Activity photos
- Social features (kudos, comments)

### Garmin (Daily Health Metrics Only)
- Daily steps count
- Daily heart rate (min/max/resting)
- Daily sleep metrics
- **Optional:** Activities (if toggle enabled)

## Avoiding Duplicates

**Recommended Setup:**
1. Connect Strava for activities
2. Connect Garmin for daily metrics
3. Disable Garmin activity sync using toggle

**Toggle Location:** Data Sources page → Garmin card → "Sync activities" switch

## Implementation Parts

| Part | Description | Time |
|------|-------------|------|
| **Part 0** | **Garmin Activity Toggle** | **0.5 days** |
| Part 1 | Database Schema (3 migrations) | 0.5 days |
| Part 2 | Strava OAuth Service | 1.5 days |
| Part 3 | Strava Sync Service | 2 days |
| Part 4 | Background Job | 0.5 days |
| Part 5 | API Routes | 1 day |
| Part 6 | Frontend Integration | 1.5 days |
| Part 7 | Testing | 1.5 days |
| Part 8 | Documentation | 0.5 days |
| **Part 9** | **Universal Sync Progress UI** | **0.5 days** |
| Part 10 | Deployment | 0.5 days |

**Total:** 10.5 days

## Database Migrations

1. `008_add_garmin_activity_toggle.sql` - Add `garmin_sync_activities` boolean column
2. `009_add_strava_activities.sql` - Strava activities table
3. `010_add_strava_activity_photos.sql` - Strava activity photos table
4. `011_add_strava_auth.sql` - Strava OAuth columns on users table

## New Database Tables

### `strava_activities`
- Activity metadata (type, name, description)
- Performance metrics (distance, duration, calories, heart rate)
- GPS tracklog (PostGIS LINESTRING)
- Social features (kudos, comments, photos count)
- Links to Strava

### `strava_activity_photos`
- Multiple photo sizes (full, 600px, 300px)
- Caption and location
- References `strava_activities`

## API Endpoints

### Strava OAuth
- `GET /api/strava/auth/start` - Initiate OAuth flow
- `POST /api/strava/auth/callback` - Complete OAuth exchange
- `GET /api/strava/status` - Connection status
- `POST /api/strava/disconnect` - Remove connection

### Strava Sync
- `POST /api/strava/sync` - Trigger manual sync
- `GET /api/strava/sync/status/:jobId` - Check sync progress

### Garmin Settings (NEW)
- `POST /api/garmin/settings` - Update sync preferences
- `GET /api/garmin/status` - Now includes `syncActivities` flag

## Environment Variables

Add to Render:

```bash
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=https://swarm-visualiser.vercel.app/data-sources
```

## Strava API Details

**OAuth Scopes:**
- `read` - Read public profile
- `activity:read` - Read activity data
- `activity:read_all` - Read private activities

**Rate Limits:**
- 100 requests per 15 minutes
- 1000 requests per day

**Token Refresh:**
- Access tokens expire in 6 hours
- Refresh tokens do not expire
- Proactive refresh implemented

## Technical Highlights

1. **PKCE Flow** - Same as Garmin OAuth2
2. **7-day Lookback** - Incremental sync goes back 7 days to catch missed data
3. **Bulk Insert** - Uses return value for accurate import count
4. **Rate Limit Handling** - Exponential backoff built-in
5. **PostGIS Tracklogs** - GPS routes stored as LINESTRING for spatial queries
6. **Polyline Decoding** - Google polyline format (same as Garmin)

## Testing Strategy

### Automated Tests (Jest)
- OAuth flow (start, callback, token exchange)
- Sync service (pagination, tracklog parsing, 7-day lookback)
- API routes (all endpoints)
- Garmin toggle logic

### Manual Testing
- Complete OAuth flow end-to-end
- Historical import with real Strava account
- Incremental sync over multiple days
- Garmin activity toggle (enable/disable)
- Dual integration (Strava + Garmin simultaneously)

## Success Criteria

- [ ] Users can connect Strava via OAuth2
- [ ] Historical activities imported on first connection
- [ ] Mapped activities include GPS tracklogs
- [ ] Activity photos imported and displayed
- [ ] Incremental sync with 7-day lookback works
- [ ] Users can disable Garmin activities to avoid duplicates
- [ ] Garmin still syncs daily metrics when activities disabled
- [ ] Both Strava and Garmin can be connected simultaneously
- [ ] All tests passing (automated + manual)

## Lessons Applied from Garmin Integration

1. ✅ Only update `last_sync` when items actually imported
2. ✅ Use `bulkInsert` return value for counts
3. ✅ 7-day lookback for incremental sync
4. ✅ Encryption key validation before deployment
5. ✅ Session middleware for PKCE early in server.js
6. ✅ Simplified database migrations
7. ✅ Thorough OAuth flow testing
8. ✅ Rate limit handling from the start

## Bonus Feature: Universal Sync Progress UI

**Part 9** adds real-time progress tracking for ALL sync operations:

**Features:**
- Polling-based progress updates (every 2 seconds)
- Works for Foursquare, Garmin, and Strava
- Shows phase, batch info, and progress percentage
- Success/error messages on completion
- No additional dependencies (no WebSocket)

**Components:**
- `SyncProgressBar.jsx` - Universal progress component
- `GET /api/sync/jobs/:jobId` - Job status endpoint
- Progress reporting in all job handlers

**User Experience:**
- Real-time progress bars in Data Sources page
- Clear status messages ("Importing batch 142/268")
- Completion notifications with counts
- Error handling with retry options

## Next Steps

1. **Part 0:** Implement Garmin activity toggle
2. **Part 1:** Create Strava database schema
3. **Part 2:** Implement Strava OAuth service
4. Continue through Parts 3-10...

---

**Ready to implement!** Full details in [2025-01-14-strava-integration-plan.md](./2025-01-14-strava-integration-plan.md)
