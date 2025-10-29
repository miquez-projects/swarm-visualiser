# Swarm Check-in Visualizer - Design Document

**Date:** 2025-10-29
**Project:** Personal Swarm/Foursquare check-in data visualization and analytics web application

## Project Overview

### Purpose
Build a shareable web application to visualize and analyze 15 years (27,000 check-ins) of Swarm/Foursquare check-in data on an interactive map with filtering, search, and analytics capabilities.

### Key Requirements
- Interactive map showing check-in locations
- Search and filter by venue name, category, date range, location
- Analytics dashboard with interesting statistics
- Time period comparison feature (must-have)
- Professional, polished user interface
- Shareable/deployable web application

### User Profile
- Non-technical user with good technical affinity
- Familiar with concepts but won't maintain code
- Values visual polish and user experience

## Architecture

### Tech Stack Selection: Modern JAMstack

**Frontend:**
- React (component-based UI)
- Material-UI (professional component library for polished look)
- Mapbox GL JS (beautiful interactive maps, 50k free map loads/month)

**Backend:**
- Node.js with Express (REST API)
- PostgreSQL with PostGIS extension (geospatial queries)

**Hosting:**
- Frontend: Vercel or Netlify (free tier, GitHub auto-deploy)
- Backend: Render or Railway (free tier with PostgreSQL included)

**Rationale:** Professional appearance, excellent developer experience, generous free hosting tiers, suitable for 27k records.

## Project Structure

```
swarm-visualizer/
├── client/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── MapView.jsx
│   │   │   ├── FilterPanel.jsx
│   │   │   ├── StatsPanel.jsx
│   │   │   ├── ComparisonView.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── pages/
│   │   │   └── Dashboard.jsx
│   │   ├── services/
│   │   │   └── api.js      # API client
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── README.md
│
├── server/                 # Node.js backend API
│   ├── routes/
│   │   ├── checkins.js
│   │   ├── stats.js
│   │   └── filters.js
│   ├── models/
│   │   └── checkin.js
│   ├── db/
│   │   ├── connection.js
│   │   └── schema.sql
│   ├── scripts/
│   │   └── import-swarm-data.js
│   ├── server.js
│   └── package.json
│
├── docs/
│   └── plans/
│       └── 2025-10-29-swarm-visualizer-design.md
│
└── README.md
```

## Data Model

### Database Schema (PostgreSQL + PostGIS)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE checkins (
    id SERIAL PRIMARY KEY,
    venue_id VARCHAR(255),           -- Swarm venue ID
    venue_name TEXT NOT NULL,
    venue_category VARCHAR(255),     -- e.g., "Restaurant", "Bar", "Museum"
    latitude DECIMAL(10, 8),         -- Can be NULL for unmappable check-ins
    longitude DECIMAL(11, 8),        -- Can be NULL for unmappable check-ins
    location GEOGRAPHY(POINT, 4326), -- PostGIS point for spatial queries
    checkin_date TIMESTAMP NOT NULL,
    city VARCHAR(255),
    country VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_checkin_date ON checkins(checkin_date);
CREATE INDEX idx_country ON checkins(country);
CREATE INDEX idx_category ON checkins(venue_category);
CREATE INDEX idx_location ON checkins USING GIST(location);
```

### Data Import Process

1. User exports Swarm data via Foursquare API (JSON format)
2. Run one-time import script: `npm run import -- <path-to-export.json>`
3. Script validates and parses:
   - Required fields: venue_name, checkin_date
   - Optional: coordinates, category, location info
   - Logs warnings for incomplete records
4. Bulk insert into PostgreSQL
5. Generate import summary report

## API Design

### Base URL
`/api/v1`

### Endpoints

#### 1. Get Check-ins
```
GET /api/checkins
```

**Query Parameters:**
- `startDate` (ISO 8601): Filter check-ins after this date
- `endDate` (ISO 8601): Filter check-ins before this date
- `category` (string, repeatable): Filter by venue category
- `country` (string): Filter by country
- `city` (string): Filter by city
- `search` (string): Search venue names (case-insensitive)
- `limit` (number): Max results (default: 1000)
- `offset` (number): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "venue_name": "The Old Pub",
      "venue_category": "Bar",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "checkin_date": "2023-06-15T19:30:00Z",
      "city": "London",
      "country": "United Kingdom"
    }
  ],
  "total": 27000,
  "limit": 1000,
  "offset": 0
}
```

#### 2. Get Statistics
```
GET /api/stats
```

**Query Parameters:** (Same as `/api/checkins` for filtered stats)

**Response:**
```json
{
  "total_checkins": 27000,
  "date_range": {
    "first_checkin": "2010-03-15T10:00:00Z",
    "last_checkin": "2025-10-28T15:30:00Z"
  },
  "top_countries": [
    { "country": "United States", "count": 12500 },
    { "country": "United Kingdom", "count": 8000 },
    { "country": "France", "count": 3500 }
  ],
  "top_categories": [
    { "category": "Restaurant", "count": 9000 },
    { "category": "Bar", "count": 6500 },
    { "category": "Café", "count": 4000 }
  ],
  "top_venue": {
    "venue_name": "My Favorite Coffee Shop",
    "count": 347
  },
  "timeline": [
    { "year": 2010, "month": 3, "count": 45 },
    { "year": 2010, "month": 4, "count": 67 }
  ],
  "unmappable_count": 134
}
```

#### 3. Compare Time Periods
```
GET /api/stats/compare
```

**Query Parameters:**
- `period1_start` (ISO 8601): First period start date
- `period1_end` (ISO 8601): First period end date
- `period2_start` (ISO 8601): Second period start date
- `period2_end` (ISO 8601): Second period end date
- Additional filters: category, country, city

**Response:**
```json
{
  "period1": {
    "label": "2015",
    "total_checkins": 2300,
    "top_countries": [...],
    "top_categories": [...]
  },
  "period2": {
    "label": "2020",
    "total_checkins": 1800,
    "top_countries": [...],
    "top_categories": [...]
  },
  "comparison": {
    "checkins_change": -500,
    "checkins_change_percent": -21.7,
    "new_countries": ["Japan", "Thailand"],
    "new_categories": ["Museum"]
  }
}
```

#### 4. Get Filter Options
```
GET /api/filters/options
```

**Response:**
```json
{
  "countries": ["United States", "United Kingdom", "France"],
  "cities": ["London", "New York", "Paris"],
  "categories": ["Restaurant", "Bar", "Café", "Museum"]
}
```

## Frontend Components

### 1. MapView Component
**Purpose:** Display all check-ins on an interactive map

**Features:**
- Mapbox GL map with custom styling
- Clustered markers for performance (27k check-ins)
- Color-coded markers by venue category
- Click marker → popup with venue details
- Zoom/pan controls
- Responsive to filter updates

**Props:**
- `checkins`: Array of check-in objects
- `onMarkerClick`: Handler for marker interactions

### 2. FilterPanel Component
**Purpose:** Control what data is displayed

**Features:**
- Date range picker (start/end dates)
- Category multi-select dropdown
- Country dropdown (populated from actual data)
- City dropdown (dependent on country selection)
- Venue name search box
- "Apply Filters" button
- "Clear All" button
- Collapsible on mobile (drawer/modal)

**State Management:**
- Filter state managed in parent Dashboard component
- Applies filters via API call on submit

### 3. StatsPanel Component
**Purpose:** Show analytics and insights

**Displays:**
- Total check-ins count
- Date range of check-ins
- Top 5 countries (bar chart)
- Top 5 categories (pie chart)
- Most visited venue
- Timeline chart (check-ins over time)
- Count of unmappable check-ins

**Props:**
- `stats`: Statistics object from API
- `loading`: Boolean for loading state

### 4. ComparisonView Component
**Purpose:** Compare two time periods side-by-side

**Features:**
- Two date range pickers (Period 1 vs Period 2)
- Side-by-side stats display
- Visual indicators for increases/decreases (↑↓ with colors)
- Comparative charts (overlaid timeline, category comparison)
- Highlight new countries/categories in Period 2
- "Switch to normal view" toggle

**Layout:**
```
┌─────────────────────────────────────┐
│  Period 1: 2015      Period 2: 2020 │
│  [Date picker]       [Date picker]   │
│                                      │
│  2,300 check-ins    1,800 check-ins │
│                     ↓ -21.7%         │
│                                      │
│  Top Countries       Top Countries   │
│  🇺🇸 USA: 1,200      🇺🇸 USA: 800     │
│  🇬🇧 UK: 600         🇬🇧 UK: 500      │
│  ...                 🇯🇵 Japan: 200 ⭐│
└─────────────────────────────────────┘
```

### 5. Layout & Theme
**Framework:** Material-UI

**Layout:**
```
┌────────────────────────────────────────┐
│  [Logo] Swarm Visualizer    [Theme 🌓] │
├───────────┬────────────────────────────┤
│  Filters  │                            │
│  ────────│        Map View            │
│  [Date]   │      (Full screen)         │
│  [Cat]    │                            │
│  [Loc]    │                            │
│  [Search] │                            │
│           │                            │
│  Stats    │                            │
│  ────────│                            │
│  Total    │                            │
│  Charts   │                            │
└───────────┴────────────────────────────┘
```

**Mobile:** Filters collapse into drawer, map full screen

**Theme:** Dark/light mode toggle using Material-UI theming

## Error Handling & Edge Cases

### Missing/Invalid Data
- **No coordinates:** Skip from map but include in stats, show "unmappable count"
- **Invalid dates:** Log during import, skip record
- **Missing category:** Assign to "Unknown" category
- **Missing location info:** Mark as "Unknown" city/country

### API & Network Failures
- Show user-friendly error messages
- Retry logic with exponential backoff (3 attempts)
- Loading skeletons while fetching
- Graceful degradation if stats fail (show map only)

### Performance Optimization
- **Map clustering:** Mapbox supercluster for 27k markers
- **Server pagination:** Load max 1000 check-ins at a time
- **Stats caching:** Cache common queries (full dataset stats) for 1 hour
- **Database indexing:** Indexes on date, country, category, location
- **Lazy loading:** Load map library only when needed

### Data Import Quality
- **Validation rules:**
  - Required: venue_name, checkin_date
  - Latitude/longitude ranges: -90 to 90, -180 to 180
  - Date format: ISO 8601
- **Import report:** Success count, skipped count, error details
- **Idempotency:** Can re-run import safely (upsert logic)

## User Flows

### Primary Flow: Exploration
1. User lands on dashboard
2. Map loads with all 27k check-ins (clustered)
3. Stats panel shows overall totals
4. User applies filters (e.g., "2018", "Restaurants", "Japan")
5. Map updates to show filtered markers
6. Stats recalculate for filtered subset
7. User clicks marker → sees venue details in popup

### Secondary Flow: Time Comparison
1. User clicks "Compare Periods" button
2. UI switches to comparison mode
3. User selects Period 1: "2015-01-01 to 2015-12-31"
4. User selects Period 2: "2020-01-01 to 2020-12-31"
5. Stats load side-by-side with change indicators
6. Timeline chart shows both periods overlaid
7. New countries/categories highlighted

### Mobile Flow
1. User opens on mobile device
2. Map displays full screen
3. Tap hamburger icon → filters drawer slides in
4. Apply filters → drawer closes, map updates
5. Stats accessible via bottom sheet (swipe up)

## Testing Strategy

### Data Import Testing
- Test with actual 27k Swarm export
- Verify all records imported correctly
- Check handling of incomplete records
- Validate geospatial data accuracy

### Performance Testing
- Load 27k check-ins, measure render time
- Test map clustering at various zoom levels
- Test filter combinations (date + category + country)
- Monitor API response times with pagination

### Functionality Testing
- All filters work individually and in combination
- Map markers display correct venue information
- Stats calculations are accurate
- Comparison mode shows correct differences
- Search returns relevant results

### Responsive Testing
- Desktop (1920x1080, 1366x768)
- Tablet (iPad)
- Mobile (iPhone, Android)
- Filter panel behavior on small screens

### Browser Testing
- Chrome, Firefox, Safari, Edge
- Focus on Mapbox compatibility

## Deployment

### Frontend Deployment (Vercel)
1. Push code to GitHub repository
2. Connect Vercel to repository
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `build`
   - Environment variables: `REACT_APP_API_URL`, `REACT_APP_MAPBOX_TOKEN`
4. Auto-deploys on push to main branch

### Backend Deployment (Render/Railway)
1. Create new web service from GitHub repo
2. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables: `DATABASE_URL`, `PORT`
3. Provision PostgreSQL database (built-in on Render/Railway)
4. Run schema.sql to set up tables
5. Auto-deploys on push to main branch

### Environment Variables
**Frontend:**
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_MAPBOX_TOKEN`: Mapbox access token

**Backend:**
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: production

### Post-Deployment Steps
1. Run data import script with Swarm export
2. Verify all 27k check-ins loaded
3. Test filtering and stats accuracy
4. Share URL with user

## Future Enhancements (Optional)

### Nice-to-Have Features
- Export filtered results as CSV
- Share specific filtered views via URL (query params)
- Heatmap view toggle (alternative to markers)
- Custom date range comparison (not just full years)
- Venue photos integration (if Swarm export includes them)
- Social features (if building for multiple users)

### Technical Improvements
- Server-side rendering (SSR) with Next.js
- Progressive Web App (PWA) for offline access
- Real-time sync with Swarm API (live check-ins)
- Advanced analytics (patterns, recommendations)

## Summary

This design provides a polished, professional web application for visualizing 27,000 Swarm check-ins with:
- Interactive map with smart clustering
- Flexible filtering and search
- Rich analytics dashboard
- Time period comparison feature (must-have)
- Modern, responsive UI
- Free hosting on Vercel + Render/Railway
- Straightforward deployment process

The JAMstack architecture ensures excellent performance, maintainability, and a great user experience while staying within free hosting tiers.
