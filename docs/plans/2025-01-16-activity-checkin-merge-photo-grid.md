# Activity + Check-in Merge & Photo Grid Enhancement

**Date:** 2025-01-16
**Status:** Ready for implementation

## Problem Statement

Two UX improvements needed for Day in Life view:

### Issue 1: Check-ins During Mapped Activities
Currently, check-ins that happen during a mapped activity (ride, run, etc.) are shown separately. This creates:
- Redundant maps (activity map + separate check-in map)
- Confusing timeline (unclear relationship between activity and check-ins)
- Lost context (can't see where check-ins happened along the route)

**Example scenario:**
- 10:00 AM - Start bike ride (mapped activity with tracklog)
- 10:30 AM - Check-in at coffee shop (during ride)
- 11:00 AM - Check-in at park (during ride)
- 11:30 AM - End bike ride

**Current behavior:** Shows ride map, then separate check-in map
**Desired behavior:** Show single map with tracklog + check-in markers, check-in timeline below activity details

### Issue 2: Check-in Photo Grid Misalignment
Current photo display under check-in timeline:
- Uses small photo icon + count text
- Venue names vary in length → vertical misalignment
- Photos not visually prominent
- Grid feels cluttered and unbalanced

**Desired behavior:**
- Fixed-height photo grid (3-4x current icon height)
- Empty cells when no photos
- Thumbnail preview when photos exist
- Clickable to open full photo viewer
- Vertically aligned across all check-ins

---

## Current Architecture

### Event Generation (server/services/dayInLifeService.js:261-299)

```javascript
async function generateEvents(checkins, activities) {
  // Combine and sort by time
  const allEvents = [
    ...checkins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c })),
    ...activities.map(a => ({ type: 'activity', time: new Date(a.start_time), data: a, source }))
  ].sort((a, b) => a.time - b.time);

  // Group contiguous checkins (activities interrupt grouping)
  const events = [];
  let currentCheckinGroup = [];

  for (const event of allEvents) {
    if (event.type === 'checkin') {
      currentCheckinGroup.push(event.data);
    } else {
      // Activity interrupts checkins
      if (currentCheckinGroup.length > 0) {
        events.push(await createCheckinEvent(currentCheckinGroup));
        currentCheckinGroup = [];
      }
      events.push(await createActivityEvent(event.data, event.source));
    }
  }

  // Add remaining checkins
  if (currentCheckinGroup.length > 0) {
    events.push(await createCheckinEvent(currentCheckinGroup));
  }

  return events;
}
```

**Key insight:** Activities currently interrupt check-in grouping. We need to detect when check-ins happen *during* a mapped activity.

### Event Types

**Check-in event:**
```javascript
{
  type: 'checkin_group',
  startTime: '2025-11-08T10:00:00Z',
  checkins: [...],
  staticMapUrl: 'https://api.mapbox.com/...'
}
```

**Activity event:**
```javascript
{
  type: 'strava_activity_mapped' | 'strava_activity_unmapped' | 'garmin_activity_mapped' | 'garmin_activity_unmapped',
  startTime: '2025-11-08T10:00:00Z',
  activity: { id, type, name, duration, distance, calories, url },
  staticMapUrl: 'https://api.mapbox.com/...' | null
}
```

---

## Design Solution

### Part 1: Merged Activity + Check-in Events

#### Detection Logic

Check-in happens "during" a mapped activity if:
1. Activity is mapped (has tracklog)
2. Check-in time >= activity start time
3. Check-in time <= activity end time (start_time + duration_seconds)

#### New Event Type

```javascript
{
  type: 'activity_with_checkins_mapped',
  startTime: '2025-11-08T10:00:00Z',
  activity: { id, type, name, duration, distance, calories, url },
  checkins: [
    { id, venue_name, checkin_date, latitude, longitude, photos: [...] },
    ...
  ],
  staticMapUrl: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/path-3+3498db(...)pin-s-1+ff6b35(...)/auto/600x400@2x'
}
```

#### Static Map Generation

Update `staticMapGenerator.generateActivityMapUrl()` to accept optional check-ins:

```javascript
generateActivityWithCheckinsMapUrl(tracklog, checkins, width = 600, height = 400) {
  // Parse tracklog to polyline
  const coords = this.parseLineString(tracklog);
  const encodedPath = polyline.encode(coords.map(c => [c[1], c[0]]));
  const urlEncodedPath = encodeURIComponent(encodedPath);

  // Generate check-in markers (no path lines between them)
  const markers = checkins
    .map((c, idx) => `pin-s-${idx + 1}+ff6b35(${c.longitude},${c.latitude})`)
    .join(',');

  // Build URL: tracklog path + markers
  const path = `path-3+3498db-0.8(${urlEncodedPath})`;

  return `${this.baseUrl}/${path},${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
}
```

**Key difference from check-in-only maps:**
- No `path-2+ff6b35-0.5(...)` connecting check-ins
- Check-ins shown as markers only
- Activity tracklog shown as path

#### Updated Event Generation Algorithm

```javascript
async function generateEvents(checkins, activities) {
  // Combine and sort by time
  const allEvents = [
    ...checkins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c })),
    ...activities.map(a => ({
      type: 'activity',
      time: new Date(a.start_time),
      endTime: new Date(new Date(a.start_time).getTime() + a.duration_seconds * 1000),
      data: a,
      source: a.strava_activity_id ? 'strava' : 'garmin'
    }))
  ].sort((a, b) => a.time - b.time);

  const events = [];
  let currentCheckinGroup = [];
  let currentActivityEvent = null;

  for (const event of allEvents) {
    if (event.type === 'checkin') {
      // Check if this check-in belongs to the current activity
      if (currentActivityEvent && event.time >= currentActivityEvent.time && event.time <= currentActivityEvent.endTime) {
        // Check-in during activity - add to activity's checkins
        if (!currentActivityEvent.checkins) {
          currentActivityEvent.checkins = [];
        }
        currentActivityEvent.checkins.push(event.data);
      } else {
        // Check-in not during activity - add to group
        currentCheckinGroup.push(event.data);
      }
    } else {
      // Activity event
      // First, flush any pending check-in group
      if (currentCheckinGroup.length > 0) {
        events.push(await createCheckinEvent(currentCheckinGroup));
        currentCheckinGroup = [];
      }

      // Create activity event (may be merged with check-ins later)
      const activityData = event.data;
      const isMapped = !!activityData.tracklog;

      if (isMapped) {
        // Store activity event temporarily - we'll finalize it when we know all check-ins
        currentActivityEvent = {
          type: 'activity',
          time: event.time,
          endTime: event.endTime,
          data: activityData,
          source: event.source,
          checkins: []
        };
      } else {
        // Unmapped activity - create immediately (no check-in merging)
        events.push(await createActivityEvent(activityData, event.source));
        currentActivityEvent = null;
      }
    }
  }

  // Finalize any pending activity event
  if (currentActivityEvent) {
    if (currentActivityEvent.checkins.length > 0) {
      // Activity with check-ins
      events.push(await createActivityWithCheckinsEvent(currentActivityEvent.data, currentActivityEvent.source, currentActivityEvent.checkins));
    } else {
      // Activity without check-ins
      events.push(await createActivityEvent(currentActivityEvent.data, currentActivityEvent.source));
    }
  }

  // Add remaining check-ins
  if (currentCheckinGroup.length > 0) {
    events.push(await createCheckinEvent(currentCheckinGroup));
  }

  return events;
}
```

**CRITICAL BUG FIX:** The above algorithm doesn't work because we're processing events linearly, but check-ins can happen AFTER we've already encountered the activity start. We need a lookahead approach.

**Corrected Algorithm:**

```javascript
async function generateEvents(checkins, activities) {
  // First pass: assign check-ins to activities
  const mappedActivities = activities
    .filter(a => !!a.tracklog)
    .map(a => ({
      ...a,
      startTime: new Date(a.start_time),
      endTime: new Date(new Date(a.start_time).getTime() + a.duration_seconds * 1000),
      source: a.strava_activity_id ? 'strava' : 'garmin',
      checkins: []
    }));

  const unmappedActivities = activities
    .filter(a => !a.tracklog)
    .map(a => ({
      ...a,
      startTime: new Date(a.start_time),
      source: a.strava_activity_id ? 'strava' : 'garmin'
    }));

  // Assign check-ins to activities or standalone groups
  const standAloneCheckins = [];

  for (const checkin of checkins) {
    const checkinTime = new Date(checkin.checkin_date);

    // Find if this check-in falls within any mapped activity
    const containingActivity = mappedActivities.find(
      a => checkinTime >= a.startTime && checkinTime <= a.endTime
    );

    if (containingActivity) {
      containingActivity.checkins.push(checkin);
    } else {
      standAloneCheckins.push(checkin);
    }
  }

  // Second pass: create events in chronological order
  const allEvents = [
    ...mappedActivities.map(a => ({ type: 'mapped_activity', time: a.startTime, data: a })),
    ...unmappedActivities.map(a => ({ type: 'unmapped_activity', time: a.startTime, data: a })),
    ...standAloneCheckins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c }))
  ].sort((a, b) => a.time - b.time);

  // Group standalone check-ins
  const events = [];
  let currentCheckinGroup = [];

  for (const event of allEvents) {
    if (event.type === 'checkin') {
      currentCheckinGroup.push(event.data);
    } else {
      // Activity interrupts check-in grouping
      if (currentCheckinGroup.length > 0) {
        events.push(await createCheckinEvent(currentCheckinGroup));
        currentCheckinGroup = [];
      }

      if (event.type === 'mapped_activity') {
        if (event.data.checkins.length > 0) {
          events.push(await createActivityWithCheckinsEvent(event.data, event.data.source, event.data.checkins));
        } else {
          events.push(await createActivityEvent(event.data, event.data.source));
        }
      } else {
        events.push(await createActivityEvent(event.data, event.data.source));
      }
    }
  }

  // Add remaining check-ins
  if (currentCheckinGroup.length > 0) {
    events.push(await createCheckinEvent(currentCheckinGroup));
  }

  return events;
}
```

#### New Event Creator Function

```javascript
async function createActivityWithCheckinsEvent(activity, source, checkins) {
  // Get photos for these checkins
  const checkinIds = checkins.map(c => c.id);
  const photosQuery = `
    SELECT checkin_id, photo_url, photo_url_cached
    FROM checkin_photos
    WHERE checkin_id = ANY($1)
  `;
  const photosResult = await db.query(photosQuery, [checkinIds]);
  const photosByCheckin = photosResult.rows.reduce((acc, p) => {
    if (!acc[p.checkin_id]) acc[p.checkin_id] = [];
    acc[p.checkin_id].push(p);
    return acc;
  }, {});

  // Enrich checkins with photos
  const enrichedCheckins = checkins.map(c => ({
    ...c,
    photos: photosByCheckin[c.id] || []
  }));

  // Generate combined map
  const staticMapUrl = staticMapGenerator.generateActivityWithCheckinsMapUrl(
    activity.tracklog,
    checkins // Just coordinates needed
  );

  return {
    type: `${source}_activity_with_checkins_mapped`,
    startTime: activity.start_time,
    activity: {
      id: activity.id,
      type: activity.activity_type,
      name: activity.activity_name,
      duration: activity.duration_seconds,
      distance: activity.distance_meters,
      calories: activity.calories,
      url: source === 'strava'
        ? (activity.strava_activity_id ? `https://www.strava.com/activities/${activity.strava_activity_id}` : null)
        : activity.garmin_url
    },
    checkins: enrichedCheckins,
    staticMapUrl
  };
}
```

---

### Part 2: Photo Grid Layout

#### Current Implementation (CheckinEventTile.jsx:55-67)

```jsx
<Box sx={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  {checkin.photos && checkin.photos.length > 0 && (
    <Box
      onClick={() => onPhotoClick(checkin.photos)}
      sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}
    >
      <Photo fontSize="small" />
      <Typography variant="caption">
        {checkin.photos.length} {checkin.photos.length === 1 ? 'photo' : 'photos'}
      </Typography>
    </Box>
  )}
</Box>
```

**Problems:**
- `minHeight: 24` too small for thumbnail
- Icon + text takes variable space
- Not visually aligned

#### New Photo Grid Design

```jsx
{/* Photo Grid - Fixed height below timeline */}
<Box sx={{ mt: 2 }}>
  <Typography variant="subtitle2" gutterBottom>
    Photos:
  </Typography>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
    {event.checkins.map((checkin, idx) => (
      <Box key={idx} sx={{ flex: 1, textAlign: 'center' }}>
        {checkin.photos && checkin.photos.length > 0 ? (
          <Box
            onClick={() => onPhotoClick(checkin.photos)}
            sx={{
              width: '100%',
              height: 80, // Fixed height (3-4x icon size)
              borderRadius: 1,
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            <img
              src={checkin.photos[0].photo_url_cached || checkin.photos[0].photo_url}
              alt="Check-in photo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {checkin.photos.length > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  bgcolor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: 0.5,
                  fontSize: '0.75rem'
                }}
              >
                +{checkin.photos.length - 1}
              </Box>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: 80,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled'
            }}
          >
            <Typography variant="caption">No photos</Typography>
          </Box>
        )}
      </Box>
    ))}
  </Box>
</Box>
```

**Benefits:**
- Fixed 80px height → consistent alignment
- Thumbnail preview → better visual hierarchy
- "+N" badge for multiple photos
- Empty state clearly indicated
- Clickable entire box → better UX

---

## Implementation Plan

### Task 1: Add Activity with Check-ins Map Generation

**File:** `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.js`

Add new method:

```javascript
generateActivityWithCheckinsMapUrl(tracklog, checkins, width = 600, height = 400) {
  if (!tracklog) return null;

  let encodedPath;

  // Check if it's WKB hex format (starts with 01020000)
  if (tracklog.startsWith('01020000')) {
    console.warn('[StaticMap] WKB hex format detected, cannot parse directly');
    return null;
  }

  // Parse WKT LINESTRING
  if (tracklog.startsWith('LINESTRING')) {
    const coords = this.parseLineString(tracklog);
    if (coords.length === 0) {
      console.error('[StaticMap] Failed to parse WKT tracklog');
      return null;
    }
    encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
  } else {
    // Already encoded polyline
    encodedPath = tracklog;
  }

  // URL-encode the polyline
  const urlEncodedPath = encodeURIComponent(encodedPath);
  const path = `path-3+3498db-0.8(${urlEncodedPath})`;

  // Add check-in markers (if any)
  let markers = '';
  if (checkins && checkins.length > 0) {
    markers = ',' + checkins
      .map((c, idx) => `pin-s-${idx + 1}+ff6b35(${c.longitude},${c.latitude})`)
      .join(',');
  }

  return `${this.baseUrl}/${path}${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
}
```

### Task 2: Update Event Generation Logic

**File:** `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.js`

Replace `generateEvents()` function with the corrected lookahead algorithm (lines 261-299).

Add new `createActivityWithCheckinsEvent()` function after `createActivityEvent()`.

### Task 3: Create New Activity with Check-ins Tile Component

**File:** `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/ActivityWithCheckinsTile.jsx`

```javascript
import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';

const ActivityWithCheckinsTile = ({ event, onPhotoClick }) => {
  const { activity, checkins, staticMapUrl } = event;

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    return (meters / 1000).toFixed(1) + ' km';
  };

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        {activity.type?.toUpperCase() || 'ACTIVITY'}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        {activity.name}
      </Typography>

      {/* Static Map with Activity Tracklog + Check-in Markers */}
      {staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={staticMapUrl}
            alt="Activity map with check-ins"
            style={{ width: '100%', borderRadius: 8 }}
          />
          {activity.url && (
            <Link
              href={activity.url}
              target="_blank"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'background.paper',
                p: 1,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <OpenInNew fontSize="small" /> View Details
            </Link>
          )}
        </Box>
      )}

      {/* Activity Stats */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
        {activity.distance && (
          <Typography variant="body1">
            {formatDistance(activity.distance)}
          </Typography>
        )}
        {activity.duration && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography variant="body1">
              {formatDuration(activity.duration)}
            </Typography>
          </>
        )}
        {activity.calories && (
          <>
            <Typography variant="body1">•</Typography>
            <Typography variant="body1">
              {activity.calories} cal
            </Typography>
          </>
        )}
      </Box>

      {/* Check-in Timeline */}
      <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          Check-ins during activity:
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
          {checkins.map((checkin, idx) => (
            <Box key={idx} sx={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" display="block">
                {new Date(checkin.checkin_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', mx: 'auto', my: 1 }} />
              <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                {checkin.venue_name}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Photo Grid */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Photos:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            {checkins.map((checkin, idx) => (
              <Box key={idx} sx={{ flex: 1, textAlign: 'center' }}>
                {checkin.photos && checkin.photos.length > 0 ? (
                  <Box
                    onClick={() => onPhotoClick(checkin.photos)}
                    sx={{
                      width: '100%',
                      height: 80,
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        opacity: 0.8
                      }
                    }}
                  >
                    <img
                      src={checkin.photos[0].photo_url_cached || checkin.photos[0].photo_url}
                      alt="Check-in photo"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    {checkin.photos.length > 1 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          bgcolor: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          fontSize: '0.75rem'
                        }}
                      >
                        +{checkin.photos.length - 1}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 80,
                      borderRadius: 1,
                      border: '1px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.disabled'
                    }}
                  >
                    <Typography variant="caption">No photos</Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default ActivityWithCheckinsTile;
```

### Task 4: Update Check-in Event Tile with Photo Grid

**File:** `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/CheckinEventTile.jsx`

Replace lines 40-71 with new photo grid layout (see design above).

### Task 5: Update Event Tile Router

**File:** `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/DayInLifeView.jsx`

Find where event types are rendered and add new case:

```javascript
import ActivityWithCheckinsTile from './ActivityWithCheckinsTile';

// In render logic:
{event.type === 'strava_activity_with_checkins_mapped' || event.type === 'garmin_activity_with_checkins_mapped' ? (
  <ActivityWithCheckinsTile
    key={idx}
    event={event}
    onPhotoClick={handlePhotoClick}
  />
) : event.type === 'strava_activity_mapped' || ...
```

### Task 6: Export New Function

**File:** `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.js`

Update exports:

```javascript
module.exports = {
  getDayInLife,
  generateEvents,
  createCheckinEvent,
  createActivityEvent,
  createActivityWithCheckinsEvent
};
```

### Task 7: Testing

Test scenarios:
1. **Activity with check-ins during**: Ride with coffee shop check-in midway
2. **Activity without check-ins**: Solo run with no stops
3. **Check-ins only**: Day with no activities
4. **Mixed day**: Morning check-ins, afternoon ride with check-ins, evening check-ins
5. **Photo grid**: Check-ins with 0, 1, and multiple photos

### Task 8: Commit and Deploy

```bash
git add server/services/staticMapGenerator.js server/services/dayInLifeService.js client/src/components/dayinlife/
git commit -m "feat(day-in-life): merge activities with check-ins and add photo grid"
git push origin main
```

---

## Edge Cases

1. **Multiple activities overlapping**: If a check-in falls within multiple activities (shouldn't happen, but possible with bad data), assign to the first matching activity.

2. **Activity with zero duration**: If `duration_seconds` is 0 or null, treat endTime = startTime (check-in must match exact timestamp).

3. **Check-in exactly at activity start/end**: Use `>=` and `<=` to include boundary times.

4. **No photos for any check-in**: Show all empty grid cells with "No photos" text.

5. **Unmapped activity with check-ins**: Do NOT merge (only merge for mapped activities per requirements).

---

## Verification

After deployment, verify:

- [ ] Activity with check-ins shows single map with tracklog + markers
- [ ] Check-in markers numbered 1, 2, 3... (not connected by lines)
- [ ] Check-in timeline appears below activity stats
- [ ] Photo grid shows thumbnails with fixed 80px height
- [ ] Empty cells show "No photos" placeholder
- [ ] Multiple photo badge shows "+N" count
- [ ] Clicking photo opens viewer
- [ ] Standalone check-ins still work as before
- [ ] Unmapped activities not affected by merge logic

---

## Rollback Plan

If issues occur:
1. Revert `dayInLifeService.js` to previous `generateEvents()` logic
2. Remove new event type handling from frontend
3. Check-ins and activities will display separately as before
