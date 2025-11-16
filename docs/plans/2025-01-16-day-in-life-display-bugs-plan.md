# Day in Life Display Bugs - Debug and Fix Plan

**Date:** 2025-01-16
**Status:** Ready for implementation

## Problem Statement

Four display issues in the Day in Life view:

1. **Unmapped activities show distance** (2025-11-15): Weight training shows distance but shouldn't
2. **Missing calories for unmapped activities**: Calories should be displayed but are missing
3. **Ride activities missing map** (2025-11-11): Two ride activities have no map displayed
4. **Invalid static map URLs**: Checkin maps (2025-11-08) and activity maps (2025-11-04) fail to load with malformed URLs

## Root Cause Analysis

### Issue 1 & 2: Unmapped Activity Display Logic
**File**: `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/ActivityEventTile.jsx:62-66`

**Current Code**:
```jsx
{activity.distance && (
  <Typography variant="body1">
    {formatDistance(activity.distance)}
  </Typography>
)}
```

**Problem**: Shows distance if truthy, regardless of whether activity is mapped. Unmapped activities (gym workouts, weight training) may have non-zero distance values from the data source but shouldn't display them.

**Required Fix**: Only show distance for mapped activities.

### Issue 3: Missing Activity Maps
**Likely Cause**: Database has `tracklog` data but `static MapUrl` generation is failing or tracklog data is invalid/corrupted.

**Investigation Needed**:
1. Check if tracklog exists in database for those activities
2. Verify tracklog format (WKT LINESTRING vs encoded polyline)
3. Check if `generateActivityMapUrl()` is throwing errors
4. Verify Mapbox URL generation logic

### Issue 4: Invalid Static Map URLs
**Symptoms**: URLs contain malformed polyline encoding with invalid characters

**Checkin Map Example** (2025-11-08):
```
path-2+ff6b35-0.5(suhyHnhLfQs\d~@hkCnYlL)
```
Contains backslash `\` which is invalid in polyline encoding.

**Activity Map Example** (2025-11-04):
```
path-3+3498db-0.8(0102000020E61000003601000062670A9DD7D8B5BF...)
```
This looks like WKT binary/hex representation, not polyline encoding.

**Root Cause**:
- Checkins: Polyline encoding producing invalid characters
- Activities: WKT parsing failing, passing raw WKT hex to Mapbox instead of encoded polyline

## Investigation Tasks

### Task 1: Query Problem Activity Data (2025-11-11 Rides)

**Step 1: Find ride activities for date**

```sql
SELECT
  id,
  activity_type,
  activity_name,
  distance_meters,
  duration_seconds,
  calories,
  tracklog IS NOT NULL as has_tracklog,
  LENGTH(tracklog::text) as tracklog_length,
  SUBSTRING(tracklog::text, 1, 100) as tracklog_sample
FROM strava_activities
WHERE user_id = 1
  AND start_time >= '2025-11-11T00:00:00Z'
  AND start_time < '2025-11-12T00:00:00Z'
  AND activity_type LIKE '%Cycling%'
ORDER BY start_time;
```

**Expected**: Find activities, check if tracklog exists and format

### Task 2: Query Problem Checkin Data (2025-11-08)

**Step 2: Find checkins for date**

```sql
SELECT
  id,
  venue_name,
  latitude,
  longitude,
  checkin_date
FROM checkins
WHERE user_id = 1
  AND checkin_date >= '2025-11-08T00:00:00Z'
  AND checkin_date < '2025-11-09T00:00:00Z'
ORDER BY checkin_date;
```

**Expected**: Get coordinates to test polyline encoding

### Task 3: Query Problem Activity Data (2025-11-04)

**Step 3: Find activity with malformed map**

```sql
SELECT
  id,
  activity_type,
  activity_name,
  tracklog IS NOT NULL as has_tracklog,
  ST_AsText(tracklog::geometry) as tracklog_wkt,
  ST_NumPoints(tracklog::geometry) as point_count
FROM strava_activities
WHERE user_id = 1
  AND start_time >= '2025-11-04T00:00:00Z'
  AND start_time < '2025-11-05T00:00:00Z'
LIMIT 1;
```

**Expected**: Verify WKT format and check if it's valid

### Task 4: Test Static Map URL Generation

**Step 4: Create test script to debug URL generation**

Create `/Users/gabormikes/swarm-visualizer/server/scripts/test-static-map-urls.js`:

```javascript
const staticMapGenerator = require('../services/staticMapGenerator');

// Test checkin map (2025-11-08 data)
const testCheckins = [
  { latitude: 51.49546143, longitude: -0.06808146 },
  { latitude: 51.49253614, longitude: -0.06333895 },
  { latitude: 51.48242521, longitude: -0.08578777 },
  { latitude: 51.47818996, longitude: -0.08793986 }
];

console.log('Testing checkin map URL generation...');
const checkinUrl = staticMapGenerator.generateCheckinMapUrl(testCheckins);
console.log('Checkin URL:', checkinUrl);
console.log('');

// Test activity map with WKT
const testTracklogWKT = 'LINESTRING(-0.06808146 51.49546143,-0.06333895 51.49253614,-0.08578777 51.48242521)';

console.log('Testing activity map URL generation (WKT)...');
const activityUrl = staticMapGenerator.generateActivityMapUrl(testTracklogWKT);
console.log('Activity URL:', activityUrl);
console.log('');

// Verify URLs are valid
console.log('Checkin URL valid:', !checkinUrl.includes('\\'));
console.log('Activity URL valid:', !activityUrl.includes('01020000'));
```

**Run**: `node server/scripts/test-static-map-urls.js`

**Expected**: URLs should not contain backslashes or hex data

## Fix Tasks

### Task 5: Fix Unmapped Activity Distance Display

**File**: `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/ActivityEventTile.jsx`

**Step 1: Only show distance for mapped activities**

Change line 62 from:
```jsx
{activity.distance && (
```

To:
```jsx
{isMapped && activity.distance && (
```

**Step 2: Ensure calories always show (mapped or unmapped)**

Lines 75-82 are already correct - they show calories regardless of mapping.

**Step 3: Verify fix**

Check unmapped activity (weight training) no longer shows distance.

**Step 4: Commit**

```bash
git add client/src/components/dayinlife/ActivityEventTile.jsx
git commit -m "fix(day-in-life): only show distance for mapped activities"
```

### Task 6: Fix Static Map URL Generation - Polyline Encoding

**File**: `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.js`

**Problem**: The `@mapbox/polyline` library may be producing invalid characters in some cases.

**Step 1: Add URL encoding to polyline output**

In `createCurvedPath` method (line 141-154), add encoding:

```javascript
createCurvedPath(coords) {
  // Deduplicate consecutive identical coordinates
  const uniqueCoords = coords.filter((coord, index) => {
    if (index === 0) return true;
    const prev = coords[index - 1];
    return coord[0] !== prev[0] || coord[1] !== prev[1];
  });

  const latLngs = uniqueCoords.map(c => [c[1], c[0]]); // Convert to lat,lng
  const encoded = polyline.encode(latLngs);

  // URL-encode the polyline to handle special characters
  return encodeURIComponent(encoded);
}
```

**Step 2: Add same encoding to activity map generation**

In `generateActivityMapUrl` method (line 120-139), update encoding:

```javascript
generateActivityMapUrl(tracklogOrPolyline, width = 600, height = 400) {
  if (!tracklogOrPolyline) return null;

  let encodedPath;

  // Check if it's WKT format (Garmin/Strava) or polyline format
  if (tracklogOrPolyline.startsWith('LINESTRING') || tracklogOrPolyline.startsWith('01020000')) {
    // WKT format or WKB hex - parse as WKT
    const coords = this.parseLineString(tracklogOrPolyline);
    if (coords.length === 0) {
      console.error('[StaticMap] Failed to parse tracklog:', tracklogOrPolyline.substring(0, 100));
      return null;
    }
    encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
  } else {
    // Already encoded polyline
    encodedPath = tracklogOrPolyline;
  }

  // URL-encode the polyline
  const urlEncodedPath = encodeURIComponent(encodedPath);
  const path = `path-3+3498db-0.8(${urlEncodedPath})`;

  return `${this.baseUrl}/${path}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
}
```

**Step 3: Fix WKB hex detection**

The issue is WKB (Well-Known Binary) hex strings starting with `01020000` aren't being handled. Update `parseLineString`:

```javascript
parseLineString(wkt) {
  // Handle WKB hex format (starts with 01020000)
  if (wkt.startsWith('01020000')) {
    console.warn('[StaticMap] WKB hex format detected, cannot parse. Tracklog:', wkt.substring(0, 50));
    return [];
  }

  // Parse "LINESTRING(lon lat, lon lat)" to [[lon, lat], ...]
  const match = wkt.match(/LINESTRING\((.*)\)/);
  if (!match) {
    console.warn('[StaticMap] Invalid WKT format:', wkt.substring(0, 100));
    return [];
  }

  const coords = match[1].split(',').map(pair => {
    const [lon, lat] = pair.trim().split(' ').map(Number);
    if (isNaN(lon) || isNaN(lat)) {
      return null;
    }
    return [lon, lat];
  }).filter(Boolean);

  return coords;
}
```

**Step 4: Test with script**

Run: `node server/scripts/test-static-map-urls.js`

Expected: URLs properly encoded, no backslashes or hex

**Step 5: Commit**

```bash
git add server/services/staticMapGenerator.js server/scripts/test-static-map-urls.js
git commit -m "fix(static-maps): URL-encode polylines and handle WKB hex format"
```

### Task 7: Investigate and Fix Missing Activity Maps

**Step 1: Query database for specific activities**

Run SQL from Task 1 to get tracklog data for 2025-11-11 rides.

**Step 2: Check tracklog format**

If tracklog starts with `01020000` → WKB hex format (PostGIS binary)
If tracklog starts with `LINESTRING` → WKT format (text)

**Step 3: Fix database if needed**

If tracklogs are stored as WKB hex, they need to be converted to WKT text:

```sql
UPDATE strava_activities
SET tracklog = ST_AsText(tracklog::geometry)
WHERE tracklog::text LIKE '01020000%'
  AND tracklog IS NOT NULL;
```

**Step 4: Verify fix**

Re-load day in life page, check if maps now appear.

**Step 5: Document findings**

Add note to commit message about WKB vs WKT storage format.

## Testing Checklist

- [ ] Unmapped activities (weight training, gym) show NO distance
- [ ] Unmapped activities show calories
- [ ] Mapped activities (rides, runs) show distance AND calories
- [ ] Checkin maps load without errors (2025-11-08)
- [ ] Activity maps load without errors (2025-11-04, 2025-11-11)
- [ ] Static map URLs contain no backslashes or hex data
- [ ] All days with activities render correctly

## Deployment

**Step 1: Push changes**

```bash
git push origin main
```

**Step 2: Monitor Render deployment**

```bash
npm run logs:view
```

**Step 3: Test on production**

Visit affected days and verify fixes.

## Rollback Plan

If maps still fail to load:

1. Revert static map generator changes
2. Investigate alternative polyline encoding library
3. Consider pre-encoding polylines during import instead of on-demand

## Notes

- **WKB vs WKT**: PostGIS can store geometries as text (WKT) or binary (WKB). Mapbox requires polyline encoding, which works best from WKT text format.
- **URL encoding**: Polyline strings can contain characters that need URL encoding (+, /, =, etc.)
- **Unmapped activities**: Should show name, type, duration, calories - but NOT distance or map
- **Total calories**: Currently calculated from activities only - should also include daily calories from Garmin if available (future enhancement)
