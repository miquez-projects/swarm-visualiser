# Map Clustering and Viewport-Based Loading Design

**Date:** November 7, 2025
**Status:** Approved for Implementation

## Problem Statement

The Swarm Visualizer map initially loads with Europe visible, showing check-ins in that region. However, when users pan or zoom to other regions (e.g., USA, Asia), check-ins in those areas don't load automatically. The map appears empty until users explicitly apply a country filter, which then loads and displays those venues.

### Root Cause

The application uses a **static, filter-based data loading model**:

1. **Data loads once on mount** - `HomePage.jsx` calls `loadCheckins()` in a single `useEffect` with no viewport dependencies
2. **Panning/zooming only updates visual state** - `MapView.jsx` `onMove` handler updates `viewState` but doesn't trigger data fetching
3. **No viewport-based queries** - Backend `/api/checkins` endpoint doesn't support geographic bounds filtering
4. **No spatial database queries** - Database queries filter by semantic fields (country, city, category) but not by latitude/longitude ranges

**Why filtering works but panning doesn't:**
- Filtering triggers `loadCheckins(newFilters)` → New API call → Fresh data → Map updates
- Panning triggers only `setViewState()` → No API call → No new data → Empty map

With 27k+ check-ins and a default limit of 1000 records, initial load likely returns Europe-dense data, leaving other regions unloaded.

## Solution Overview

Implement **Mapbox clustering with viewport-based smart loading** - the industry-standard approach used by Google Maps, Apple Maps, and other modern mapping applications.

### Core Strategy

1. **Mapbox Clustering:** Show venue clusters at low zoom levels (0-6), individual pins at higher zoom (7+)
2. **Viewport-Based Loading:** Load venues dynamically based on visible map bounds when user pans/zooms
3. **Smart Backend Queries:** Add PostGIS spatial filtering to efficiently query venues by geographic bounds
4. **Progressive Detail:** Use zoom-level-based loading strategies (sampled data at low zoom, full data at high zoom)
5. **Filter Integration:** Maintain existing filter/search behavior (auto-pan to results)

## Architecture

### High-Level Flow

```
User Action              Frontend                    Backend                 Database
─────────────────────────────────────────────────────────────────────────────────────
Initial Load        →   loadCheckins()          →   GET /api/checkins     →  PostGIS
                        (world view)                (no bounds)               spatial
                    ←   ~1000-2000 venues       ←   sampled venues         ←  query

User Pans Map       →   onMove handler          →   (debounced 500ms)
                        calculate bounds            GET /api/checkins
                        loadCheckins({bounds})  →   ?bounds=minLng,...    →  PostGIS
                    ←   venues in viewport      ←   filtered venues       ←  bounds

User Filters        →   handleFilterChange()    →   GET /api/checkins
                        loadCheckins({filters}) →   ?country=UK           →  semantic
                    ←   filtered venues         ←   UK venues             ←  filter
                        fitBounds(results)
```

### Zoom-Level Strategy

| Zoom Level | View | Clustering | Data Loading Strategy | Expected Count |
|------------|------|------------|----------------------|----------------|
| 0-2 | World | Clusters | Spatially sampled venues (grid-based) | ~1000-2000 |
| 3-6 | Continent/Country | Clusters | Viewport bounds + 50% buffer | ~2000-5000 |
| 7+ | Country detail/City | Individual pins | Viewport bounds + 20% buffer | ~3000-10000 |

**Cluster Threshold:** `clusterMaxZoom={6}`
- Zoom 0-6: Venues shown as clusters (circles with counts)
- Zoom 7+: Clusters break apart into individual pins

**Rationale:** At country-level zoom, users typically have dozens to low hundreds of venues visible, making individual pins informative rather than overwhelming.

## Detailed Design

### 1. Frontend: MapView Component Changes

**Current Implementation:**
```jsx
// MapView.jsx - Current approach
{venueGroups.map(venue => (
  <Marker
    key={venue.venue_id}
    longitude={venue.longitude}
    latitude={venue.latitude}
    anchor="bottom"
    onClick={() => handleMarkerClick(venue)}
  >
    <Room style={{ color: getMarkerColor(venue.venue_category) }} />
  </Marker>
))}
```

**New Implementation:**
```jsx
// MapView.jsx - Clustering approach
const checkinsGeoJSON = useMemo(() => ({
  type: "FeatureCollection",
  features: venueGroups.map(venue => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [venue.longitude, venue.latitude]
    },
    properties: {
      venueId: venue.venue_id,
      venueName: venue.venue_name,
      checkinCount: venue.checkins.length,
      category: venue.venue_category,
      city: venue.city,
      country: venue.country
    }
  }))
}), [venueGroups]);

return (
  <Map {...viewState} onMove={handleMove}>
    <Source
      id="checkins"
      type="geojson"
      data={checkinsGeoJSON}
      cluster={true}
      clusterMaxZoom={6}
      clusterRadius={50}
    >
      {/* Cluster circles */}
      <Layer
        id="clusters"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6', 100,
            '#f1f075', 750,
            '#f28cb1'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20, 100,
            30, 750,
            40
          ]
        }}
      />

      {/* Cluster count labels */}
      <Layer
        id="cluster-count"
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': '{point_count_abbreviated}',
          'text-size': 12
        }}
      />

      {/* Individual venue points */}
      <Layer
        id="unclustered-point"
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': [
            'match',
            ['get', 'category'],
            'Restaurant', '#e74c3c',
            'Bar', '#9b59b6',
            'Café', '#f39c12',
            'Coffee Shop', '#d35400',
            'Museum', '#3498db',
            'Park', '#27ae60',
            'Hotel', '#16a085',
            'Shop', '#e67e22',
            '#95a5a6' // default
          ],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }}
        onClick={handleVenueClick}
      />
    </Source>
  </Map>
);
```

**Key Changes:**
- Convert venue groups to GeoJSON FeatureCollection
- Use Mapbox `<Source>` with `cluster={true}` instead of individual `<Marker>` components
- Three separate layers: clusters, cluster counts, individual points
- Clustering handled automatically by Mapbox based on `clusterMaxZoom` and `clusterRadius`
- Existing venue aggregation logic (group check-ins by venue_id) remains unchanged

### 2. Frontend: Viewport-Based Loading (HomePage.jsx)

**Add State:**
```javascript
const [currentBounds, setCurrentBounds] = useState(null);
const [currentZoom, setCurrentZoom] = useState(1.5);
const [lastLoadedBounds, setLastLoadedBounds] = useState(null);
```

**Add Viewport Change Handler:**
```javascript
const handleViewportChange = useCallback((viewState) => {
  setCurrentZoom(viewState.zoom);

  // Calculate bounds from map instance
  const map = mapRef.current?.getMap();
  if (!map) return;

  const bounds = map.getBounds();
  setCurrentBounds({
    minLng: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLng: bounds.getEast(),
    maxLat: bounds.getNorth()
  });
}, []);
```

**Add Debounced Loading Effect:**
```javascript
useEffect(() => {
  // Skip if no movement or at world view
  if (!currentBounds || currentZoom < 3) return;

  // Skip if new bounds fully contained within last loaded bounds
  if (lastLoadedBounds && boundsContained(currentBounds, lastLoadedBounds)) {
    return;
  }

  // Debounce: Only load after user stops moving for 500ms
  const timer = setTimeout(() => {
    const bufferPercent = currentZoom >= 7 ? 0.2 : 0.5;
    const bufferedBounds = addBuffer(currentBounds, bufferPercent);

    loadCheckins({
      ...filters,
      bounds: `${bufferedBounds.minLng},${bufferedBounds.minLat},${bufferedBounds.maxLng},${bufferedBounds.maxLat}`,
      zoom: Math.floor(currentZoom)
    });

    setLastLoadedBounds(bufferedBounds);
  }, 500);

  return () => clearTimeout(timer);
}, [currentBounds, currentZoom, filters]);
```

**Helper Functions:**
```javascript
function boundsContained(inner, outer) {
  return inner.minLng >= outer.minLng &&
         inner.maxLng <= outer.maxLng &&
         inner.minLat >= outer.minLat &&
         inner.maxLat <= outer.maxLat;
}

function addBuffer(bounds, percent) {
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;

  return {
    minLng: bounds.minLng - (lngRange * percent),
    maxLng: bounds.maxLng + (lngRange * percent),
    minLat: bounds.minLat - (latRange * percent),
    maxLat: bounds.maxLat + (latRange * percent)
  };
}
```

**Loading Behavior:**
- **Debounce (500ms):** Prevents API calls while user is actively dragging/zooming
- **Bounds checking:** Skips reload if new viewport is fully inside previously loaded area
- **Buffer zones:** Loads extra data outside viewport (20-50% depending on zoom) so panning doesn't immediately require new data
- **Zoom-aware buffering:** Larger buffer at low zoom (continent view), smaller buffer at high zoom (city view)

### 3. Frontend: Filter/Search Integration

**Modified Filter Behavior:**
When user applies filter or searches:
1. Load filtered data from backend
2. Calculate bounds of filtered results
3. Auto-fit map to show filtered results
4. Disable viewport-based loading while filter is active (use filtered dataset)

```javascript
const handleFilterChange = async (newFilters) => {
  setFilters(newFilters);

  // Load filtered data (no bounds param - semantic filtering only)
  const result = await loadCheckins(newFilters);

  if (result.data.length > 0) {
    // Auto-fit map to filtered results
    const bounds = calculateBounds(result.data);

    // Determine appropriate zoom based on result count
    let maxZoom = 12;
    if (result.data.length === 1) {
      maxZoom = 15; // Zoom close for single venue
    } else if (result.data.length <= 10) {
      maxZoom = 12; // Medium zoom for small result set
    } else {
      maxZoom = 10; // Wider view for many results
    }

    mapRef.current?.fitBounds(bounds, {
      padding: 40,
      maxZoom: maxZoom,
      duration: 1000
    });
  }
};
```

**Examples:**
- Filter to "UK" while viewing US → Map pans/zooms to UK, shows UK venues
- Search "Joe's Coffee" → Map zooms to that specific venue (zoom 15)
- Filter to "Museums" → Map fits to show all museums in dataset

### 4. Backend: API Route Changes (routes/checkins.js)

**Add Bounds and Zoom Parameters:**
```javascript
router.get(
  '/',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('category').optional(),
    query('country').optional().isString(),
    query('city').optional().isString(),
    query('search').optional().isString(),
    query('bounds').optional().isString(), // NEW: "minLng,minLat,maxLng,maxLat"
    query('zoom').optional().isInt({ min: 0, max: 20 }).toInt(), // NEW
    query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const filters = {
        ...req.query,
        userId: req.user.id
      };

      const result = await Checkin.find(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
```

### 5. Backend: Database Model Changes (models/checkin.js)

**Add Spatial Filtering to `Checkin.find()`:**

```javascript
static async find(filters = {}) {
  const {
    userId,
    startDate,
    endDate,
    category,
    country,
    city,
    search,
    bounds,  // NEW
    zoom,    // NEW
    limit = 1000,
    offset = 0
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // User filter (required for multi-user support)
  if (userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(userId);
  }

  // Existing semantic filters
  if (startDate) {
    conditions.push(`checkin_date >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`checkin_date <= $${paramIndex++}`);
    params.push(endDate);
  }

  if (category) {
    conditions.push(`venue_category = $${paramIndex++}`);
    params.push(category);
  }

  if (country) {
    conditions.push(`country = $${paramIndex++}`);
    params.push(country);
  }

  if (city) {
    conditions.push(`city = $${paramIndex++}`);
    params.push(city);
  }

  if (search) {
    conditions.push(`venue_name ILIKE $${paramIndex++}`);
    params.push(`%${search}%`);
  }

  // NEW: Geographic bounds filtering (OPTIONAL - only for map viewport queries)
  if (bounds) {
    const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);

    // Validate bounds
    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
      throw new Error('Invalid bounds format');
    }

    conditions.push(`latitude BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    conditions.push(`longitude BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`);
    params.push(minLat, maxLat, minLng, maxLng);
    paramIndex += 4;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Total count query
  const countQuery = `SELECT COUNT(*) FROM checkins ${whereClause}`;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);

  // Main data query with spatial sampling for low zoom
  let dataQuery;

  if (zoom !== undefined && zoom < 7 && !country && !city && !category && !search) {
    // Low zoom (0-6) + no semantic filters: Use spatial sampling
    // Returns one venue per grid cell to ensure geographic coverage
    dataQuery = `
      SELECT DISTINCT ON (
        FLOOR(latitude * 10),
        FLOOR(longitude * 10)
      )
      id, venue_id, venue_name, venue_category,
      latitude, longitude, checkin_date,
      city, country
      FROM checkins
      ${whereClause}
      ORDER BY
        FLOOR(latitude * 10),
        FLOOR(longitude * 10),
        id DESC
      LIMIT $${paramIndex++}
    `;
  } else {
    // High zoom (7+) or filtered: Return all matching venues
    dataQuery = `
      SELECT
        id, venue_id, venue_name, venue_category,
        latitude, longitude, checkin_date,
        city, country
      FROM checkins
      ${whereClause}
      ORDER BY checkin_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(offset);
  }

  params.push(limit);
  const dataResult = await db.query(dataQuery, params);

  return {
    data: dataResult.rows,
    total,
    limit,
    offset
  };
}
```

**Spatial Sampling Explanation:**

At low zoom levels (0-6) without semantic filters, we use `DISTINCT ON` with grid-based grouping:

```sql
DISTINCT ON (
  FLOOR(latitude * 10),
  FLOOR(longitude * 10)
)
```

This divides the world into ~11km grid cells and returns at most one venue per cell, ensuring:
- Geographic coverage (every region with data shows at least one venue)
- Prevents Europe-heavy bias (doesn't just return first 1000 venues sorted by date)
- Works for sparse regions (e.g., single vacation to Japan shows those venues)
- Efficient (~1000-2000 venues for world view instead of all 27k)

### 6. Copilot Integration Consideration

**The copilot uses a separate query path and will NOT be affected:**

- **Copilot path:** `/api/copilot/chat` → `geminiService.js` → `queryBuilder.js` → Custom SQL
- **Map path:** `/api/checkins` → `Checkin.find()` → Standard SQL

The `bounds` parameter is:
- **Optional** in `Checkin.find()`
- **Only sent by map viewport loading**
- **Never sent by copilot** (uses semantic filters only: country, city, category, dateRange, venueName)

Existing copilot functionality (semantic queries, trip context, category matching) remains fully operational.

## Copilot Enhancement: Clickable Venue Pills

**Feature:** Make venue mentions in copilot responses clickable, allowing users to jump directly to those venues on the map.

### User Experience

**Before:**
```
Copilot: "You last visited Joe's Coffee Shop in Berlin on June 15, 2024."
         (plain text, no interaction)
```

**After:**
```
Copilot: "You last visited 📍 Joe's Coffee Shop in Berlin on June 15, 2024."
                          [clickable blue chip with marker icon]
```

**On Click:** Map pans/zooms to venue (zoom 15, centered, smooth transition)

### Implementation

**1. AI Response Format**

Modify Gemini system instruction to wrap venue names in special syntax:

```javascript
// Add to geminiService.js systemInstruction:
`
When mentioning specific venues in your responses, wrap them in this special format:
{{venue|venue_id|venue_name|latitude|longitude}}

Examples:
- "You visited {{venue|abc123|Joe's Coffee Shop|52.5200|13.4050}} in Berlin."
- "Your top venue is {{venue|xyz789|Central Park|40.7829|-73.9654}} with 47 check-ins."

Always include this format when:
- Listing specific venues by name
- Answering "where" questions
- Discussing check-in locations
- Providing venue recommendations from history

DO NOT wrap:
- Generic venue types ("restaurants", "museums")
- City/country names
- Venue counts or statistics
`
```

**2. Frontend Parsing**

Add venue mention parser to `ChatMessage.jsx`:

```javascript
function parseVenueMentions(text) {
  const venueRegex = /\{\{venue\|(.*?)\|(.*?)\|(.*?)\|(.*?)\}\}/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = venueRegex.exec(text)) !== null) {
    // Add text before venue
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Add venue chip data
    parts.push({
      type: 'venue',
      venueId: match[1],
      venueName: match[2],
      latitude: parseFloat(match[3]),
      longitude: parseFloat(match[4])
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return parts;
}
```

**3. Render as Interactive Chips**

```jsx
function ChatMessage({ message, onVenueClick }) {
  const parsedContent = useMemo(
    () => parseVenueMentions(message.content),
    [message.content]
  );

  return (
    <Box>
      {parsedContent.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{part.content}</span>
        ) : (
          <Chip
            key={i}
            icon={<Room fontSize="small" />}
            label={part.venueName}
            size="small"
            clickable
            onClick={() => onVenueClick(part)}
            sx={{
              mx: 0.5,
              cursor: 'pointer',
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.main',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s'
            }}
          />
        )
      )}
    </Box>
  );
}
```

**4. Click Handler**

Pass handler from `HomePage.jsx` through copilot component chain:

```javascript
// HomePage.jsx
const handleVenueClickFromChat = useCallback((venue) => {
  // Pan/zoom map to venue
  setViewState({
    longitude: venue.longitude,
    latitude: venue.latitude,
    zoom: 15,
    transitionDuration: 1000
  });

  // Highlight the venue marker temporarily
  setHighlightedVenue(venue.venueId);
  setTimeout(() => setHighlightedVenue(null), 3000);

  // Optional: Minimize copilot to show map
  setIsCopilotMinimized(true);
}, []);

// Pass to CopilotChat component
<CopilotChat onVenueClick={handleVenueClickFromChat} />
```

### Benefits

- **Seamless exploration:** Users can click any venue mentioned in chat to see it on the map
- **Natural interaction:** Combines conversational AI with visual geography
- **Reduced friction:** No need to manually search for venues mentioned in chat
- **Discovery flow:** "Tell me about my France trip" → Click venues in response → Explore on map

## Edge Cases and Error Handling

### No Venues in Viewport

**Scenario:** User pans to ocean or remote area with no check-ins

**Handling:**
- Keep showing previously loaded venues (don't clear map)
- Show subtle notification: "No check-ins in this area"
- Don't trigger excessive retries

### Very Dense Areas

**Scenario:** User's hometown has 5000+ venues in small area

**Handling:**
- Backend limit prevents overload (max 10,000 venues per request)
- Show message if limiting: "Showing 10,000 of 12,347 venues. Zoom in for more detail."
- Clustering handles visual density automatically

### Network Failure During Pan

**Scenario:** API request fails while user is panning

**Handling:**
- Keep showing previously loaded venues
- Show retry notification with manual retry button
- Auto-retry once after 3 seconds
- Log error to console for debugging

### Quick Panning Across Regions

**Scenario:** User rapidly drags from Europe → Asia → USA

**Handling:**
- Debounce (500ms) cancels previous pending loads
- Only final destination after user stops triggers request
- Prevents request spam

### Filtering While Panned to Specific Region

**Scenario:** User is viewing USA, then filters to "UK"

**Handling:**
- Apply filter (semantic, no bounds)
- Calculate bounds of filtered results (UK venues)
- Auto-fit map to UK with smooth transition
- Override viewport-based loading (stay on filtered dataset)

### Search for Single Venue

**Scenario:** User searches for "Joe's Coffee"

**Handling:**
- Load matching venue(s)
- If exactly 1 result: Zoom to 15 (street level), center on venue
- If 2-10 results: Fit bounds with padding, max zoom 12
- If 10+ results: Fit bounds, max zoom 10
- Override viewport loading until search is cleared

### Initial Load at Low Zoom

**Scenario:** User first loads app (world view, zoom ~1.5)

**Handling:**
- Use spatial sampling query (grid-based DISTINCT ON)
- Return ~1000-2000 venues distributed globally
- Ensures all geographic regions with data are visible
- User sees their global travel footprint immediately

## Performance Considerations

### Database Indexes

Required indexes for efficient spatial queries:

```sql
-- Already exists in schema.sql
CREATE INDEX IF NOT EXISTS idx_location ON checkins USING GIST(location);

-- Add composite index for bounds + user filtering
CREATE INDEX IF NOT EXISTS idx_user_lat_lng ON checkins(user_id, latitude, longitude);

-- Keep existing indexes
CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_country ON checkins(country);
CREATE INDEX IF NOT EXISTS idx_category ON checkins(venue_category);
```

### Query Performance

- **Spatial queries:** PostGIS GIST index enables fast lat/lng range queries (<50ms for 5000 records)
- **Sampling queries:** DISTINCT ON with FLOOR() adds ~20-30ms overhead but reduces result size by 90%
- **Clustering:** Happens client-side in Mapbox GL JS (uses WebGL, very fast even with 10k points)

### Frontend Performance

- **GeoJSON conversion:** useMemo prevents recalculation unless venues change
- **Debouncing:** 500ms delay prevents excessive API calls during panning
- **Bounds checking:** Skips unnecessary requests when data already loaded
- **Buffer zones:** Pre-loads adjacent areas, reducing requests during normal panning

### Memory Considerations

- **Browser memory:** 10k venues = ~2-3MB JSON, acceptable for modern browsers
- **Mapbox clustering:** Efficiently handles 10k+ points with WebGL rendering
- **Request limits:** Max 10k venues per request prevents unbounded growth

## Migration and Backward Compatibility

### No Breaking Changes

- **Existing API unchanged:** `bounds` and `zoom` parameters are optional
- **Copilot unaffected:** Uses separate query path, doesn't send bounds param
- **Filters still work:** Semantic filters (country, city, category) function identically
- **No database schema changes:** Uses existing lat/lng columns and PostGIS index

### Gradual Rollout

1. **Phase 1:** Add bounds filtering to backend (no frontend changes) → Test with API calls
2. **Phase 2:** Implement clustering in MapView → Users see clustered view, no loading changes yet
3. **Phase 3:** Add viewport-based loading → Complete solution active
4. **Phase 4:** Add copilot venue pills → Enhancement goes live

### Rollback Plan

If issues arise:
- Remove viewport loading effect (revert to initial load only)
- Keep clustering (improves UX even without dynamic loading)
- Bounds filtering in backend causes no harm if unused

## Testing Strategy

### Unit Tests

- `parseVenueMentions()`: Verify correct extraction of venue data from text
- `boundsContained()`: Test bounds overlap detection logic
- `addBuffer()`: Verify buffer calculation accuracy
- `calculateBounds()`: Test bounds calculation from venue array

### Integration Tests

- API endpoint with bounds parameter returns correct geographic subset
- Filtering + bounds work together correctly
- Copilot queries work without sending bounds param
- Spatial sampling returns geographically distributed results

### Manual Testing Scenarios

1. **Basic panning:** Load app → Pan from Europe to USA → Verify USA venues load
2. **Rapid panning:** Quickly drag across multiple continents → Verify only final location loads
3. **Filter override:** View USA → Filter to "France" → Verify map pans to France
4. **Search:** Search "Starbucks" → Verify map zooms to results
5. **Clustering:** Zoom from world (clusters) to city (pins) → Verify smooth transition
6. **Copilot:** Ask "Where did I go in Sweden?" → Click venue pill → Verify map navigation
7. **Dense area:** Zoom into hometown with many venues → Verify performance stays smooth
8. **Sparse area:** Pan to ocean → Verify no errors, message shown
9. **Network error:** Disconnect network → Pan → Verify graceful error handling

## Success Metrics

### User Experience

- ✅ Panning to any region shows venues within 1 second (500ms debounce + API response)
- ✅ No visible "empty map" when panning to regions with data
- ✅ Smooth clustering transitions (no lag or flickering)
- ✅ Filter/search behavior feels instant and intuitive

### Performance

- ✅ API response times <200ms for typical bounds queries
- ✅ Spatial sampling returns <2000 venues for world view
- ✅ Debouncing reduces API calls by ~80% during active panning
- ✅ Browser memory usage stays <50MB even with 10k venues loaded

### Reliability

- ✅ Copilot queries continue working identically
- ✅ Existing filters/search behavior unchanged
- ✅ No errors when panning to areas with no data
- ✅ Network failures handled gracefully with retry

## Future Enhancements

### Potential Improvements (Out of Scope for Initial Implementation)

1. **Server-side clustering:** Pre-cluster at database level for even better performance
2. **WebSocket updates:** Real-time sync when new check-ins added
3. **Predictive loading:** Pre-fetch adjacent regions based on pan direction
4. **Cluster interaction:** Click cluster to zoom into that area
5. **Heatmap mode:** Toggle between pins/clusters and heatmap visualization
6. **Offline support:** Cache venues in IndexedDB for offline map viewing
7. **URL state:** Save viewport bounds in URL for shareable links

## Conclusion

This design solves the core issue (venues not loading when panning) while simultaneously improving the overall map experience through clustering. The solution:

- **Maintains backward compatibility** (no breaking changes)
- **Preserves existing features** (filters, search, copilot all work identically)
- **Follows industry standards** (Mapbox clustering, viewport-based loading)
- **Enhances user experience** (cleaner visualization, seamless exploration)
- **Adds bonus feature** (clickable venue pills in copilot)

The implementation is incremental and testable at each phase, with clear rollback options if issues arise.
