# Map Features Documentation

## Clustering

The map uses Mapbox clustering to provide a clear visualization at all zoom levels:

- **Zoom 0-6** (World to Country): Venues shown as colored clusters
  - Blue (< 100 venues)
  - Yellow (100-750 venues)
  - Pink (> 750 venues)
- **Zoom 7+** (Country Detail to Street): Individual venue pins
  - Color-coded by category (restaurants, bars, museums, etc.)
  - Click to view venue details

**Click Behavior:**
- Click cluster: Zoom into that region
- Click pin: Open venue popup with details

## Viewport-Based Loading

Venues load automatically as you explore:

1. **Initial Load**: Shows globally distributed sample (~1000-2000 venues)
2. **Pan/Zoom**: New venues load for visible region after 500ms
3. **Buffer Zones**: Pre-loads adjacent areas (20-50% beyond viewport)
4. **Smart Caching**: Skips reload if data already loaded for that region

**Why 500ms delay?**
Prevents excessive API calls while you're actively dragging the map.

## Filter Integration

Filters override viewport loading and navigate automatically:

- **Country Filter**: Map pans to show all venues in that country
- **Search**: Map zooms to found venue(s)
  - 1 result: Zoom 15 (street level)
  - 2-10 results: Zoom 12 (neighborhood)
  - 10+ results: Zoom 10 (city view)

## Copilot Integration

Venue names in copilot responses become clickable:

1. Ask copilot: "Where did I go in Paris?"
2. Response includes venue pills with location icons
3. Click venue → Map navigates to that location

## Performance

- **Database**: PostGIS spatial indexing for fast geographic queries
- **Frontend**: Debounced loading prevents request spam
- **Clustering**: WebGL rendering handles 10k+ points smoothly
- **Caching**: Buffer zones reduce API calls during normal exploration

## Technical Details

### Backend

The backend implements spatial filtering with bounds and zoom parameters:

- **Bounds Format**: `minLng,minLat,maxLng,maxLat`
- **Zoom Strategy**:
  - Zoom 0-6: Grid-based sampling (~11km cells) for geographic distribution
  - Zoom 7+: Full results within bounds
- **Database Index**: Composite index on `(user_id, latitude, longitude)` for optimal query performance

### Frontend

The frontend manages viewport loading with React hooks:

- **Debouncing**: 500ms timeout prevents excessive API calls during panning
- **Buffer Calculation**:
  - Low zoom (< 7): 50% buffer
  - High zoom (7+): 20% buffer
- **Bounds Containment**: Skips reload if new viewport fully within previously loaded bounds

### Clustering Configuration

Mapbox clustering parameters:

- `clusterMaxZoom`: 6 (clusters at 0-6, individual pins at 7+)
- `clusterRadius`: 50 pixels
- **Color Steps**: Blue → Yellow → Pink based on point count
- **Circle Radius**: Scales with cluster size (20px → 30px → 40px)

## User Experience

### Smooth Interactions

- **Pan**: Wait 500ms after stopping before loading
- **Zoom In**: Clusters smoothly break apart at zoom 7
- **Zoom Out**: Individual pins smoothly group into clusters
- **Filter**: Map animates to show filtered results (1 second duration)
- **Copilot**: Map navigates to clicked venue with smooth easing (1 second duration)

### Loading States

- **Initial Load**: Full-screen loading indicator
- **Viewport Load**: Subtle top-right corner indicator
- **Error Handling**: Snackbar notification with auto-retry

### Empty States

- **No Results**: Clear message when filters return no results
- **Empty Viewport**: No error when panning to areas without venues
- **Network Error**: Graceful degradation with error notification
