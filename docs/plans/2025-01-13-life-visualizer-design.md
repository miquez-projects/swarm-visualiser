# Life Visualizer Design Document

**Date:** January 13, 2025
**Status:** Approved for Implementation

## Overview

The Life Visualizer is a major feature expansion that transforms the Swarm Visualizer from a check-in tracker into a comprehensive personal life analytics platform. This design adds multi-source data integration (Garmin fitness data, check-in photos), improved UX (splash screen, context menu), and a flagship "Day in the Life" feature for exploring daily activities.

## Architecture Philosophy

- **Incremental delivery**: Five distinct parts that build on each other
- **Testing checkpoints**: Automated tests + manual testing after each major component
- **Data extensibility**: Designed to support future data sources beyond Garmin
- **Performance-first**: Static maps, lazy caching, normalized database design

---

## Part 1: Splash Screen & Authentication

### Purpose
Provide branded entry point and streamlined token-based authentication while maintaining existing OAuth flow.

### User Experience

**Splash Screen Display Logic:**
- Always shows on app load (Netflix-style branding)
- Duration varies by auth state:
  - **Token exists** (URL or localStorage): 2-second display, auto-fadeout
  - **No token**: Display indefinitely with input UI

**Visual Design:**
- Background: Swarm orange gradient (referencing old Swarm bee logo aesthetic)
- Subtle animation: Gradient shift or gentle pulse (nothing flashy)
- Logo/branding: App title centered
- Token input (when needed): Appears after 1 second with blinking cursor

**Authentication Flow:**

```
User visits app
  ↓
Splash screen appears
  ↓
Check for token (URL param > localStorage)
  ↓
├─ Token found
│    ↓
│    Show splash for 2 seconds
│    ↓
│    Fadeout → Main app
│
└─ No token found
     ↓
     Show token input field (after 1s delay)
     ↓
     User enters token OR clicks "Set up new user"
     ↓
     ├─ Token entered → Validate → Main app
     └─ Setup clicked → Onboarding screen
```

**Token Handling:**
- Token in URL (`?token=...`) is stored to localStorage
- Existing URL-based auth continues to work
- Users keep tokens in bookmarks or saved URLs

### Data Sources / Onboarding Screen

Replaces direct redirect to Foursquare import. New users and returning users access this screen via context menu.

**Screen Purpose:**
- Show/copy user's secret token (with URL format)
- Connect data sources (Foursquare, Garmin, future integrations)
- Central hub for managing integrations

**Initial Implementation:**
- Display token prominently with copy button
- Show token as full URL: `https://swarm-visualiser.vercel.app/?token={token}`
- List available data sources with connect buttons
- Show connection status for each source

### Technical Implementation

**Frontend:**
- New component: `SplashScreen.jsx`
- New route/page: `DataSourcesPage.jsx` (accessible from context menu)
- Token validation endpoint: `GET /api/auth/validate`
- CSS animations for fadeout transition

**Backend:**
- No changes needed (existing token auth works)

---

## Part 2: Context Menu & Navigation

### Purpose
Consolidate growing navigation options and provide settings/actions access.

### Menu Structure

**Top Navigation Layout:**
```
[App Title]  [Map] [Year in Review] [Day in Life]  [🍔] [🌙]
                                                    ↑     ↑
                                               Context  Dark
                                                Menu    Mode
```

**Context Menu Items:**
1. **Sync All Data** - Triggers sync for all connected sources
2. **Data Sources** - Opens onboarding/settings screen
3. Last synced timestamp (read-only display)

**Future extensibility:**
- User profile settings
- Export data
- Logout option
- Additional data source syncs (individual)

### Technical Implementation

**Frontend:**
- Update `Layout.jsx` to add burger menu icon (Material-UI `Menu` component)
- Keep primary navigation (Map, Year in Review, Day in Life) as visible buttons
- Context menu positioned top-right before dark mode toggle
- Menu component: `ContextMenu.jsx`

**Sync Behavior:**
- "Sync All Data" button calls new endpoint: `POST /api/sync/all`
- Shows loading spinner during sync
- Displays success/error message
- Updates "Last synced" timestamp

---

## Part 3: Check-in Photos

### Purpose
Enrich check-in data with visual memories by pulling photos from Foursquare API.

### Data Model

**New Table: `checkin_photos`**
```sql
CREATE TABLE checkin_photos (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER REFERENCES checkins(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_url_cached TEXT,  -- For opportunistic caching
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_checkin_photos_checkin_id ON checkin_photos(checkin_id);
```

**Photo URL Strategy:**
- **Primary**: Store Foursquare CDN URLs directly (no download cost, simple)
- **Opportunistic caching**: When photo is displayed, save to `photo_url_cached`
- Future: Self-host cached photos if Foursquare URLs become unreliable

### User Experience

**Venue Details Modal - Updated:**
- Add tab navigation: **"Check-ins"** | **"Photos"**
- Check-ins tab: Existing GitHub-style grid
- Photos tab: Photo gallery organized by check-in date

**Photos Tab Layout:**
```
┌─────────────────────────────────────┐
│ January 15, 2024 at 2:30 PM         │
│ [photo] [photo] [photo]             │
│                                     │
│ January 20, 2024 at 6:45 PM         │
│ [photo]                             │
│                                     │
│ March 5, 2024 at 11:00 AM           │
│ [photo] [photo]                     │
└─────────────────────────────────────┘
```

- Photos grouped by check-in date/time
- Date headers for each group
- Grid layout (responsive: 3-4 photos per row on desktop, 2 on mobile)
- Click photo → Lightbox/gallery view with navigation

**Empty State:**
- If no photos: "No photos for this venue" message

### API Changes

**Foursquare Import Update:**
- Modify `fetchCheckins()` to include photo data
- Parse photo URLs from check-in response
- Store photos during import process

**New Endpoint:**
- `GET /api/venues/:venueId/photos` - Returns photos grouped by check-in date

### Technical Implementation

**Database Migration:**
- `004_add_checkin_photos.sql`

**Backend:**
- Update `foursquare.js` service to extract photo data
- Update sync service to import photos
- New route: `/api/venues/:venueId/photos`

**Frontend:**
- Update `MapView.jsx` modal to include tabs
- New component: `VenuePhotosGallery.jsx`
- Lightbox library: `react-image-lightbox` or similar

---

## Part 4: Garmin Integration

### Purpose
Expand data sources beyond check-ins to include fitness and health metrics from Garmin Connect.

### Library Choice

**Selected: `garmin-connect` by Pythe1337N**
- npm package: `garmin-connect`
- 175 stars, actively maintained (last commit: Jan 2025)
- Native JavaScript/TypeScript
- Supports: activities, steps, heart rate, sleep

**MFA Workaround:**
- **Strategy**: Session token persistence (Option B)
- One-time setup: Temporarily disable MFA, authenticate, export tokens, re-enable MFA
- Tokens persist and auto-refresh indefinitely
- Manual re-auth only needed if tokens fully expire

### Data Model

**Four New Tables:**

**1. `garmin_activities`**
```sql
CREATE TABLE garmin_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  garmin_activity_id VARCHAR(255) UNIQUE NOT NULL,
  activity_type VARCHAR(100),  -- Running, Cycling, Swimming, etc.
  activity_name TEXT,
  start_time TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  distance_meters DECIMAL(10, 2),
  calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,

  -- Tracklog for mapped activities (PostGIS LineString)
  tracklog GEOGRAPHY(LINESTRING, 4326),

  -- Link to original Garmin activity
  garmin_url TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_garmin_activities_user_id ON garmin_activities(user_id);
CREATE INDEX idx_garmin_activities_start_time ON garmin_activities(start_time);
CREATE INDEX idx_garmin_activities_tracklog ON garmin_activities USING GIST(tracklog);
```

**2. `garmin_daily_steps`**
```sql
CREATE TABLE garmin_daily_steps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  step_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_steps_user_date ON garmin_daily_steps(user_id, date);
```

**3. `garmin_daily_heart_rate`**
```sql
CREATE TABLE garmin_daily_heart_rate (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  min_heart_rate INTEGER,
  max_heart_rate INTEGER,
  resting_heart_rate INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_hr_user_date ON garmin_daily_heart_rate(user_id, date);
```

**4. `garmin_daily_sleep`**
```sql
CREATE TABLE garmin_daily_sleep (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sleep_duration_seconds INTEGER,
  sleep_score INTEGER,
  deep_sleep_seconds INTEGER,
  light_sleep_seconds INTEGER,
  rem_sleep_seconds INTEGER,
  awake_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_sleep_user_date ON garmin_daily_sleep(user_id, date);
```

### Garmin Authentication Flow

**User Table Update:**
```sql
ALTER TABLE users ADD COLUMN garmin_session_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN garmin_connected_at TIMESTAMP;
```

**Initial Setup (via Data Sources screen):**
1. User clicks "Connect Garmin"
2. Modal/form appears: "Enter Garmin username and password"
3. Backend attempts login via `garmin-connect` library
4. Session tokens exported and encrypted
5. Store `garmin_session_token_encrypted` in user record
6. Mark `garmin_connected_at`

**Note for user:** Display message about MFA requirement (must disable MFA temporarily for initial setup)

### Data Sync Strategy

**Historical Import (First-time):**
1. **Activities**: Paginate through all activities using `getActivities(start, limit)`
   - Fetch in batches of 50-100
   - Store tracklog as PostGIS LineString for mapped activities
2. **Daily Metrics** (steps, heart rate, sleep): Query each day going back N years
   - Start from today, iterate backwards
   - Configurable lookback period (default: 5 years)
   - Use `getSteps(date)`, `getHeartRate(date)`, `getSleepData(date)`

**Incremental Sync (Daily auto-sync + manual):**
1. Determine last sync date from database
2. Fetch new activities since last sync
3. Fetch daily metrics for days since last sync
4. Update database

**Sync Endpoint:**
- `POST /api/garmin/sync` - Manual sync trigger
- Integrated into daily auto-sync job (existing 2 AM UTC cron)
- Part of "Sync All Data" button in context menu

### Technical Implementation

**Backend:**
- New service: `server/services/garmin.js` (wrapper around garmin-connect library)
- Session management: `server/services/garminAuth.js`
- New routes: `server/routes/garmin.js`
  - `POST /api/garmin/connect` - Initial authentication
  - `POST /api/garmin/sync` - Trigger sync
  - `GET /api/garmin/status` - Connection status
- Database migrations: `005_add_garmin_tables.sql`, `006_add_garmin_auth.sql`

**Frontend:**
- Update `DataSourcesPage.jsx` to include Garmin connection UI
- Add Garmin connection modal/form
- Show Garmin connection status

**Dependencies:**
- npm install `garmin-connect`

---

## Part 5: Day in the Life of Feature

### Purpose
Flagship feature that combines all data sources into a rich, narrative daily summary.

### Navigation & URL Structure

**Route:** `/day-in-life/:date`
- Example: `/day-in-life/2024-01-15`
- Shareable URLs (within authenticated context)

**Access Points:**
1. Top navigation button: "Day in Life"
2. Default: Today's date
3. Date picker in page header to switch dates
4. Prev/Next day navigation arrows

### Page Layout

```
┌────────────────────────────────────────────────────────────┐
│ [< Prev]  January 15, 2024  [📅]  [Next >]                │  ← Header
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────┐  ┌──────────────────┐   │
│  │ Date                         │  │ Weather          │   │  ← Top Row
│  │ January 15, 2024             │  │ 🌤 22°C          │   │
│  └──────────────────────────────┘  │ London, UK       │   │
│                                     └──────────────────┘   │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │  ← Property Tiles
│  │ 💤 7h32m │ │ 👟 12,847│ │ 📍 5     │ │ 🏃 2     │     │
│  │ Score:78 │ │ steps    │ │ check-ins│ │ activities│    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                            │
│  ┌──────────┐ ┌──────────┐                                │
│  │ ❤️ 48-156│ │ 🔥 847   │                                │
│  │ bpm      │ │ calories │                                │
│  └──────────┘ └──────────┘                                │
│                                                            │
│  ───────────────────────────────────────────────────────  │  ← Event Tiles
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ CHECK-INS                                          │   │
│  │ ┌──────────────────────────────────────────────┐  │   │
│  │ │         [Static map with route]              │  │   │
│  │ │         🗺 → Jump to main map                 │  │   │
│  │ └──────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  │ Timeline:                                          │   │
│  │ 9:00 AM          12:30 PM         2:45 PM         │   │
│  │    ●─────────────────●──────────────●             │   │
│  │  Coffee Shop      Restaurant      Museum          │   │
│  │  (📷 2 photos)                   (📷 1 photo)     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ MORNING RUN                                        │   │
│  │ Running • 5.2 km                                   │   │
│  │ ┌──────────────────────────────────────────────┐  │   │
│  │ │         [Static map with tracklog]           │  │   │
│  │ │         🗺 → View on Garmin                   │  │   │
│  │ └──────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  │ 5.2 km  •  32:15  •  287 cal                      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ YOGA CLASS                                         │   │
│  │ Yoga • 45:00                                       │   │
│  │                                                    │   │
│  │ 45:00  •  120 cal                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Property Tiles

**Tile Design:** Icon + Number + Label + Context (Option C/B)

**Property Definitions:**

1. **Weather** (top right, prominent)
   - Icon based on condition (☀️🌤⛅☁️🌧)
   - Temperature in Celsius
   - Location (country, or state/region for large countries)

2. **Sleep**
   - 💤 Duration (7h 32m)
   - Sleep score (0-100)
   - "No data" if missing

3. **Steps**
   - 👟 Step count
   - "No data" if missing

4. **Check-ins**
   - 📍 Count only
   - "0 check-ins" if none

5. **Activities**
   - 🏃 Count of Garmin activities
   - "No data" if Garmin not connected or no activities

6. **Heart Rate Range**
   - ❤️ Min-Max bpm
   - "No data" if missing

7. **Calories**
   - 🔥 Total calories burned (from all Garmin activities)
   - "No data" if no activities

**No Data Handling:**
- Show tile with "No data" text
- Grayed out appearance
- Still visible (don't hide tiles)

### Event Tiles

**Event Types:**
1. Check-in group (contiguous)
2. Garmin mapped activity
3. Garmin unmapped activity

**Ordering:** Chronological by start time

**Contiguous Check-ins:**
- **Definition**: Check-ins not interrupted by Garmin activity
- **Example**: Check-in → Check-in → Check-in = ONE tile
- **Counter-example**: Check-in → Activity → Check-in = TWO tiles

#### Event Tile: Check-in Group

**Components:**
- Static map showing all check-ins as circles
- Curved lines connecting check-ins in chronological order
- Link icon to jump to main interactive map

**Timeline (below map):**
- Horizontal timeline left-to-right (earliest → latest)
- Nodes for each check-in with timestamp
- Venue name under each node
- Photo indicator (📷 X photos) if photos exist
- Click photo indicator → Gallery lightbox

**Static Map Generation:**
- Mapbox Static Images API
- Curved lines between points
- Auto-zoom to fit all check-ins

#### Event Tile: Garmin Mapped Activity

**Components:**
- Activity type and name (header)
- Static map showing tracklog (GPS route)
- Link icon to view on Garmin Connect (external link)
- Stats row: Distance • Duration • Calories

**Example:**
```
MORNING RUN
Running • Central Park Loop
[────── Static map with route ──────]
🗺 View on Garmin

5.2 km  •  32:15  •  287 cal
```

#### Event Tile: Garmin Unmapped Activity

**Components:**
- Activity type and name (header)
- Stats: Duration • Calories
- No map (not GPS-tracked)

**Example:**
```
YOGA CLASS
Yoga • Vinyasa Flow

45:00  •  120 cal
```

### Weather Data Integration

**Table: `daily_weather`**
```sql
CREATE TABLE daily_weather (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100),  -- State/province for large countries
  temp_celsius DECIMAL(4, 1),
  condition VARCHAR(50),  -- sunny, cloudy, rainy, etc.
  weather_icon VARCHAR(20),  -- Icon code
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(date, country, region)
);

CREATE INDEX idx_daily_weather_date_country ON daily_weather(date, country, region);
```

**Data Source:** Open-Meteo API
- Free, no API key required
- Historical weather from 1940-present
- Country/region-level granularity

**Sync Strategy:**
1. **Historical backfill**: When importing historical check-ins, fetch weather for each unique (date, country, region) combination
2. **Incremental sync**: When syncing new check-ins, fetch weather for new days

**Weather Display Logic:**
- For each day, query weather for all countries/regions with check-ins
- If all check-ins in one country: Single weather tile
- If check-ins span multiple countries: Show primary country (most check-ins)
- Temperature in Celsius (°C)

### Technical Implementation

**Backend:**

**New Service:** `server/services/openMeteo.js`
- Fetch historical weather by date, lat/lng
- Cache results in `daily_weather` table

**New Route:** `server/routes/dayInLife.js`
```javascript
GET /api/day-in-life/:date
Returns:
{
  date: "2024-01-15",
  properties: {
    weather: { temp: 22, condition: "partly_cloudy", country: "UK" },
    sleep: { duration: 27120, score: 78 },
    steps: { count: 12847 },
    checkins: { count: 5 },
    activities: { count: 2 },
    heartRate: { min: 48, max: 156 },
    calories: { total: 847 }
  },
  events: [
    {
      type: "checkin_group",
      startTime: "2024-01-15T09:00:00Z",
      checkins: [...],
      staticMapUrl: "...",
      photos: [...]
    },
    {
      type: "garmin_activity_mapped",
      activity: {...},
      staticMapUrl: "...",
      garminUrl: "..."
    },
    {
      type: "garmin_activity_unmapped",
      activity: {...}
    }
  ]
}
```

**Static Map Generation:**
- Use Mapbox Static Images API
- Generate URLs server-side with appropriate overlays
- Curved lines via encoded polyline with curve control points

**Frontend:**

**New Page:** `client/src/pages/DayInLifePage.jsx`
- Route: `/day-in-life/:date`
- Date picker component in header
- Prev/Next navigation
- Property tiles grid
- Event tiles list

**Components:**
- `PropertyTile.jsx` - Reusable property display
- `CheckinEventTile.jsx` - Check-in group with map
- `MappedActivityTile.jsx` - Garmin activity with map
- `UnmappedActivityTile.jsx` - Garmin activity without map
- `DayNavigation.jsx` - Date picker + prev/next

**Database Migrations:**
- `007_add_daily_weather.sql`

**Dependencies:**
- Static map generation (Mapbox Static Images API)
- Lightbox for photos: `react-image-lightbox` or `yet-another-react-lightbox`

---

## Testing Strategy

### Automated Testing Setup

**Install Jest and testing dependencies:**
```bash
npm install --save-dev jest @types/jest supertest
```

**Jest Configuration:**
- Create `jest.config.js` in project root
- Separate test files: `*.test.js` or `*.spec.js`
- Mock external APIs (Garmin, Open-Meteo, Foursquare)
- Use in-memory test database or transactions for DB tests

### Test Coverage Goals

**High Priority (Write tests):**
- Backend services and business logic
- API endpoints
- Data transformation functions
- Event grouping algorithms

**Medium Priority (Optional):**
- Frontend component rendering
- Integration tests

**Low Priority (Manual only):**
- Visual appearance
- Third-party API actual calls
- UX flows

---

## Part 1: Testing Checkpoint

### Automated Tests (Jest)
- [ ] Token validation logic
- [ ] localStorage token detection
- [ ] URL parameter token extraction
- [ ] Auth endpoint returns correct responses

**Test files to create:**
- `server/routes/auth.test.js` - Test auth endpoints

### Manual Tests
- [ ] Splash screen appears on app load
- [ ] Token in URL is stored to localStorage
- [ ] 2-second display for authenticated users
- [ ] Token input appears after 1 second for unauthenticated users
- [ ] Token validation works
- [ ] "Set up new user" redirects to Data Sources screen
- [ ] Data Sources screen displays token with copy functionality
- [ ] Orange gradient and subtle animation look good
- [ ] Responsive on mobile

---

## Part 2: Testing Checkpoint

### Automated Tests (Jest)
- [ ] Sync all endpoint orchestration logic
- [ ] Last sync timestamp calculation
- [ ] Menu state management

**Test files to create:**
- `server/routes/sync.test.js` - Test sync endpoints

### Manual Tests
- [ ] Burger menu appears in top nav
- [ ] Context menu opens/closes correctly
- [ ] "Sync All Data" button triggers sync
- [ ] Last synced timestamp displays correctly
- [ ] "Data Sources" menu item navigates to settings screen
- [ ] Navigation buttons (Map, Year in Review, Day in Life) still work
- [ ] Mobile responsive (burger menu behavior)

---

## Part 3: Testing Checkpoint

### Automated Tests (Jest)
- [ ] Photo URL extraction from Foursquare API response
- [ ] Photo grouping by check-in date logic
- [ ] `/api/venues/:id/photos` endpoint response structure
- [ ] Opportunistic caching logic

**Test files to create:**
- `server/services/foursquare.test.js` - Test photo extraction
- `server/routes/venues.test.js` - Test venue photos endpoint

### Manual Tests
- [ ] Photos imported during Foursquare sync
- [ ] Venue details modal shows "Check-ins" and "Photos" tabs
- [ ] Photos grouped by check-in date
- [ ] Photos display correctly in grid
- [ ] Lightbox opens when clicking photo
- [ ] Navigation in lightbox works
- [ ] "No photos" message displays when appropriate
- [ ] Opportunistic caching populates `photo_url_cached`
- [ ] Photo loading performance acceptable

---

## Part 4: Testing Checkpoint

### Automated Tests (Jest)
- [ ] Garmin data transformation (API → database format)
- [ ] Activity tracklog parsing to PostGIS LineString
- [ ] Session token encryption/decryption
- [ ] Historical import pagination logic
- [ ] Incremental sync date range calculation
- [ ] Garmin sync endpoint behavior

**Test files to create:**
- `server/services/garmin.test.js` - Test data transformation
- `server/services/garminAuth.test.js` - Test auth/token management
- `server/routes/garmin.test.js` - Test Garmin endpoints

**Mocking Strategy:**
- Mock `garmin-connect` library responses
- Use sample Garmin API response fixtures
- Test with various activity types (mapped/unmapped)

### Manual Tests
- [ ] Garmin connect button appears on Data Sources screen
- [ ] Garmin authentication form works (with MFA disabled)
- [ ] Session token stored successfully
- [ ] Historical import completes (activities, steps, HR, sleep)
- [ ] Progress indicator shows during import
- [ ] Incremental sync fetches new data
- [ ] "Sync All Data" includes Garmin sync
- [ ] Garmin connection status displays correctly
- [ ] Mapped activities have tracklog data in database
- [ ] Unmapped activities stored without tracklog
- [ ] All four Garmin tables populated correctly
- [ ] Error handling for failed Garmin API calls

---

## Part 5: Testing Checkpoint

### Automated Tests (Jest)
- [ ] Event grouping algorithm (contiguous check-ins)
- [ ] Event chronological ordering
- [ ] Property calculation (total calories, step count)
- [ ] Weather data deduplication logic
- [ ] Static map URL generation
- [ ] `/api/day-in-life/:date` endpoint response structure
- [ ] Day navigation (prev/next date calculation)

**Test files to create:**
- `server/services/dayInLife.test.js` - Test event grouping logic
- `server/services/openMeteo.test.js` - Test weather service
- `server/services/staticMaps.test.js` - Test static map URL generation
- `server/routes/dayInLife.test.js` - Test day in life endpoint

**Critical Test Cases:**
```javascript
// Event grouping tests
test('groups contiguous check-ins without activity interruption')
test('splits check-in groups when activity occurs between them')
test('orders events chronologically')
test('handles day with no events')
test('handles day with only check-ins')
test('handles day with only activities')

// Property calculation tests
test('calculates total calories from all activities')
test('returns "no data" for missing metrics')
test('aggregates weather by country correctly')

// Static map URL tests
test('generates valid Mapbox Static API URL')
test('includes curved polyline for check-in routes')
test('includes activity tracklog in URL')
```

### Manual Tests
- [ ] Day in Life page accessible from navigation
- [ ] Date picker works
- [ ] Prev/Next day navigation works
- [ ] URL updates when changing dates
- [ ] Direct URL navigation works (`/day-in-life/2024-01-15`)
- [ ] Property tiles display correctly
- [ ] "No data" states display for missing data
- [ ] Weather tile shows correct data and location
- [ ] Event tiles ordered chronologically
- [ ] Check-in groups respect activity interruption rule
- [ ] Static maps generate correctly with check-ins
- [ ] Static maps show tracklogs for activities
- [ ] Curved lines connect check-ins on map
- [ ] Photo indicators appear in check-in timeline
- [ ] Photo lightbox works from event tile
- [ ] Garmin activity links work (external)
- [ ] Unmapped activities display without map
- [ ] Page performs well with many events (10+)
- [ ] Mobile responsive layout
- [ ] Loading states while fetching data
- [ ] Error handling for invalid dates
- [ ] Empty day (no data) displays gracefully

---

## Performance Considerations

1. **Static Maps**: Cache generated map URLs to avoid regeneration
2. **Database Queries**: Use proper indexing on date columns for Day in Life queries
3. **Photo Loading**: Lazy load photos below the fold
4. **Weather API**: Batch requests, cache aggressively in database
5. **Garmin Sync**: Run as background job, show progress indicator
6. **Test Performance**: Keep test suite fast (<30s total run time)

---

## Future Enhancements (Not in Scope)

- Strava integration (similar to Garmin)
- Export day summaries as PDF/image
- Share days publicly (social sharing)
- Calendar view showing all days with activity levels
- Insights/trends across multiple days
- Photo uploads from other sources
- Activity tagging and notes
- Multi-user comparison ("Compare my day with friends")
- E2E tests with Playwright/Cypress

---

## Dependencies

**New NPM Packages:**
- `garmin-connect` - Garmin API client
- `react-image-lightbox` or `yet-another-react-lightbox` - Photo gallery
- `jest` - Testing framework
- `@types/jest` - TypeScript types for Jest
- `supertest` - HTTP assertion library for API tests

**External APIs:**
- Open-Meteo API (weather data, free)
- Mapbox Static Images API (event tile maps, existing account)
- Foursquare API (photos endpoint, existing integration)
- Garmin Connect (unofficial API via library)

---

## Database Migrations Summary

1. `004_add_checkin_photos.sql` - Check-in photos table
2. `005_add_garmin_tables.sql` - Four Garmin tables (activities, steps, HR, sleep)
3. `006_add_garmin_auth.sql` - Add Garmin auth columns to users table
4. `007_add_daily_weather.sql` - Weather data table

---

## Conclusion

This design provides a complete roadmap for implementing the Life Visualizer feature set with integrated automated testing. Each part builds incrementally with clear testing checkpoints combining Jest automated tests for business logic and manual testing for UX validation.

**Estimated Implementation Timeline:**
- Part 0 (Jest Setup): 0.5 days
- Part 1 (Splash + Auth): 2-3 days (includes tests)
- Part 2 (Context Menu): 1-1.5 days (includes tests)
- Part 3 (Photos): 2-3 days (includes tests)
- Part 4 (Garmin): 5-6 days (includes tests)
- Part 5 (Day in Life): 6-7 days (includes tests)

**Total: ~17-21 days** for complete implementation with automated testing.
