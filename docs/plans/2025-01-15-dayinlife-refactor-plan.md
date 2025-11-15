# Day in the Life - Refactor to Original Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** January 15, 2025
**Goal:** Refactor existing Day in the Life implementation to match the original design specification with static maps, event grouping, and photo integration.

**Current State:** Working Day in the Life feature with basic timeline and metrics, but missing:
- Persistent weather caching (daily_weather table)
- Static map generation for check-ins and activities
- Smart event grouping (contiguous check-ins interrupted by activities)
- Photo integration in check-in events
- Specialized frontend components (PropertyTile, CheckinEventTile, ActivityEventTile)

**Architecture:** Keep existing weatherService and dayInLifeService as base, add daily_weather table for persistent caching, add staticMapGenerator for Mapbox static API, refactor event generation to group contiguous check-ins, update frontend components to match original design.

**Tech Stack:**
- Backend: Node.js, PostgreSQL, Mapbox Static API
- Frontend: React, Material-UI
- New Dependencies: @mapbox/polyline

---

## Task 1: Add Daily Weather Table Migration

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/migrations/007_add_daily_weather.sql`

**Step 1: Create migration file**

```sql
CREATE TABLE IF NOT EXISTS daily_weather (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  temp_celsius DECIMAL(4, 1),
  condition VARCHAR(50),
  weather_icon VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, country, region)
);

CREATE INDEX idx_daily_weather_date_country ON daily_weather(date, country, region);

INSERT INTO schema_migrations (version, name)
VALUES (7, '007_add_daily_weather');
```

**Step 2: Run migration**

```bash
node server/db/run-migration.js migrations/007_add_daily_weather.sql
```

Expected: "Migration 007_add_daily_weather completed successfully"

**Step 3: Verify table created**

```bash
psql $DATABASE_URL -c "\d daily_weather"
```

Expected: Table structure displayed with columns

**Step 4: Commit**

```bash
git add migrations/007_add_daily_weather.sql
git commit -m "feat(db): add daily_weather table for persistent weather caching"
```

---

## Task 2: Create Daily Weather Model

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/models/dailyWeather.js`
- Create: `/Users/gabormikes/swarm-visualizer/server/models/dailyWeather.test.js`

**Step 1: Write failing test**

Create `/Users/gabormikes/swarm-visualizer/server/models/dailyWeather.test.js`:

```javascript
const DailyWeather = require('./dailyWeather');

describe('DailyWeather', () => {
  describe('upsert', () => {
    it('should insert new weather record', async () => {
      const weatherData = {
        date: '2024-01-15',
        country: 'United States',
        region: null,
        temp_celsius: 18.5,
        condition: 'clear',
        weather_icon: '☀️'
      };

      const result = await DailyWeather.upsert(weatherData);

      expect(result).toHaveProperty('id');
      expect(result.temp_celsius).toBe('18.5');
      expect(result.condition).toBe('clear');
    });

    it('should update existing weather record on conflict', async () => {
      const weatherData = {
        date: '2024-01-15',
        country: 'United States',
        region: null,
        temp_celsius: 20.0,
        condition: 'partly_cloudy',
        weather_icon: '🌤'
      };

      // Insert first time
      await DailyWeather.upsert(weatherData);

      // Update with new temperature
      weatherData.temp_celsius = 22.0;
      const result = await DailyWeather.upsert(weatherData);

      expect(result.temp_celsius).toBe('22.0');
    });
  });

  describe('findByDateAndLocation', () => {
    it('should find weather by date and country', async () => {
      const weatherData = {
        date: '2024-01-16',
        country: 'Canada',
        region: null,
        temp_celsius: 5.0,
        condition: 'snowy',
        weather_icon: '🌨'
      };

      await DailyWeather.upsert(weatherData);

      const result = await DailyWeather.findByDateAndLocation('2024-01-16', 'Canada', null);

      expect(result).toBeDefined();
      expect(result.country).toBe('Canada');
      expect(result.condition).toBe('snowy');
    });

    it('should return undefined if not found', async () => {
      const result = await DailyWeather.findByDateAndLocation('2099-01-01', 'Mars', null);

      expect(result).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- dailyWeather.test.js
```

Expected: FAIL - "Cannot find module './dailyWeather'"

**Step 3: Write minimal implementation**

Create `/Users/gabormikes/swarm-visualizer/server/models/dailyWeather.js`:

```javascript
const db = require('../db/connection');

class DailyWeather {
  static async upsert(weatherData) {
    const query = `
      INSERT INTO daily_weather (date, country, region, temp_celsius, condition, weather_icon)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (date, country, region) DO UPDATE SET
        temp_celsius = EXCLUDED.temp_celsius,
        condition = EXCLUDED.condition,
        weather_icon = EXCLUDED.weather_icon
      RETURNING *
    `;
    const values = [
      weatherData.date,
      weatherData.country,
      weatherData.region,
      weatherData.temp_celsius,
      weatherData.condition,
      weatherData.weather_icon
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByDateAndLocation(date, country, region = null) {
    const query = `
      SELECT * FROM daily_weather
      WHERE date = $1 AND country = $2 AND (region = $3 OR ($3 IS NULL AND region IS NULL))
    `;
    const result = await db.query(query, [date, country, region]);
    return result.rows[0];
  }
}

module.exports = DailyWeather;
```

**Step 4: Run test to verify it passes**

```bash
npm test -- dailyWeather.test.js
```

Expected: PASS - All tests passing

**Step 5: Commit**

```bash
git add models/dailyWeather.js models/dailyWeather.test.js
git commit -m "feat: add DailyWeather model with database persistence"
```

---

## Task 3: Install Polyline Dependency

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/package.json`

**Step 1: Install package**

```bash
npm install @mapbox/polyline
```

Expected: Package added to package.json and node_modules

**Step 2: Verify installation**

```bash
npm list @mapbox/polyline
```

Expected: Package version displayed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @mapbox/polyline for static map generation"
```

---

## Task 4: Create Static Map Generator Service

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.js`
- Create: `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.test.js`

**Step 1: Write failing test**

Create `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.test.js`:

```javascript
const staticMapGenerator = require('./staticMapGenerator');

describe('Static Map Generator', () => {
  describe('generateCheckinMapUrl', () => {
    it('should generate valid Mapbox Static API URL for checkins', () => {
      const checkins = [
        { longitude: -74.0060, latitude: 40.7128 },
        { longitude: -74.0070, latitude: 40.7138 }
      ];

      const url = staticMapGenerator.generateCheckinMapUrl(checkins);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
      expect(url).toContain('pin-s');
      expect(url).toContain('600x400');
    });

    it('should return null for empty checkins', () => {
      const url = staticMapGenerator.generateCheckinMapUrl([]);

      expect(url).toBeNull();
    });
  });

  describe('generateActivityMapUrl', () => {
    it('should generate URL for Garmin activity with WKT tracklog', () => {
      const tracklog = 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)';

      const url = staticMapGenerator.generateActivityMapUrl(tracklog);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
    });

    it('should generate URL for Strava activity with polyline', () => {
      const polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

      const url = staticMapGenerator.generateActivityMapUrl(polyline);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('path');
    });

    it('should return null for null tracklog', () => {
      const url = staticMapGenerator.generateActivityMapUrl(null);

      expect(url).toBeNull();
    });
  });

  describe('parseLineString', () => {
    it('should parse PostGIS LineString (Garmin format) correctly', () => {
      const wkt = 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)';

      const coords = staticMapGenerator.parseLineString(wkt);

      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual([-74.0060, 40.7128]);
      expect(coords[1]).toEqual([-74.0070, 40.7138]);
    });

    it('should return empty array for invalid WKT', () => {
      const wkt = 'INVALID';

      const coords = staticMapGenerator.parseLineString(wkt);

      expect(coords).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- staticMapGenerator.test.js
```

Expected: FAIL - "Cannot find module './staticMapGenerator'"

**Step 3: Write minimal implementation**

Create `/Users/gabormikes/swarm-visualizer/server/services/staticMapGenerator.js`:

```javascript
const polyline = require('@mapbox/polyline');

class StaticMapGenerator {
  constructor() {
    this.mapboxToken = process.env.MAPBOX_TOKEN;
    this.baseUrl = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';
  }

  generateCheckinMapUrl(checkins, width = 600, height = 400) {
    if (checkins.length === 0) return null;

    // Create curved path through checkins
    const coords = checkins.map(c => [c.longitude, c.latitude]);
    const encodedPath = this.createCurvedPath(coords);

    // Add markers for each checkin
    const markers = checkins
      .map((c, i) => `pin-s-${i + 1}+ff6b35(${c.longitude},${c.latitude})`)
      .join(',');

    // Auto-fit bounds
    const path = `path-2+ff6b35-0.5(${encodedPath})`;

    return `${this.baseUrl}/${path},${markers}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }

  generateActivityMapUrl(tracklogOrPolyline, width = 600, height = 400) {
    if (!tracklogOrPolyline) return null;

    let encodedPath;

    // Check if it's WKT format (Garmin) or polyline format (Strava)
    if (tracklogOrPolyline.startsWith('LINESTRING')) {
      // Garmin format: WKT "LINESTRING(lon lat, lon lat, ...)"
      const coords = this.parseLineString(tracklogOrPolyline);
      if (coords.length === 0) return null;
      encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline
    } else {
      // Strava format: already encoded polyline
      encodedPath = tracklogOrPolyline;
    }

    const path = `path-3+3498db-0.8(${encodedPath})`;

    return `${this.baseUrl}/${path}/auto/${width}x${height}@2x?access_token=${this.mapboxToken}`;
  }

  createCurvedPath(coords) {
    // Simple curve: encode coordinates with polyline
    // For production: implement bezier curves or use actual routing
    const latLngs = coords.map(c => [c[1], c[0]]); // Convert to lat,lng
    return polyline.encode(latLngs);
  }

  parseLineString(wkt) {
    // Parse "LINESTRING(lon lat, lon lat)" to [[lon, lat], ...]
    const match = wkt.match(/LINESTRING\((.*)\)/);
    if (!match) return [];

    return match[1].split(',').map(pair => {
      const [lon, lat] = pair.trim().split(' ').map(Number);
      return [lon, lat];
    });
  }
}

module.exports = new StaticMapGenerator();
```

**Step 4: Run test to verify it passes**

```bash
npm test -- staticMapGenerator.test.js
```

Expected: PASS - All tests passing

**Step 5: Commit**

```bash
git add services/staticMapGenerator.js services/staticMapGenerator.test.js
git commit -m "feat: add static map generator for Mapbox Static API"
```

---

## Task 5: Refactor Weather Service to Use Database

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/weatherService.js`
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/weatherService.test.js`

**Step 1: Update weatherService to export conditionToIcon**

Add to `/Users/gabormikes/swarm-visualizer/server/services/weatherService.js` at the end of the class:

```javascript
  conditionToIcon(condition) {
    const icons = {
      'Clear sky': '☀️',
      'Partly cloudy': '🌤',
      'Cloudy': '☁️',
      'Rainy': '🌧',
      'Snowy': '🌨',
      'Thunderstorm': '⛈'
    };
    // Map our condition descriptions to icons
    if (condition.includes('clear')) return icons['Clear sky'];
    if (condition.includes('partly')) return icons['Partly cloudy'];
    if (condition.includes('cloud')) return icons['Cloudy'];
    if (condition.includes('rain') || condition.includes('drizzle')) return icons['Rainy'];
    if (condition.includes('snow')) return icons['Snowy'];
    if (condition.includes('thunder')) return icons['Thunderstorm'];
    return '🌤'; // Default
  }
```

**Step 2: Add test for conditionToIcon**

Add to `/Users/gabormikes/swarm-visualizer/server/services/weatherService.test.js`:

```javascript
  describe('conditionToIcon', () => {
    it('should return correct icon for clear weather', () => {
      const icon = weatherService.conditionToIcon('Clear sky');
      expect(icon).toBe('☀️');
    });

    it('should return correct icon for rainy weather', () => {
      const icon = weatherService.conditionToIcon('Light rain');
      expect(icon).toBe('🌧');
    });

    it('should return default icon for unknown condition', () => {
      const icon = weatherService.conditionToIcon('Unknown');
      expect(icon).toBe('🌤');
    });
  });
```

**Step 3: Run tests**

```bash
npm test -- weatherService.test.js
```

Expected: PASS - All tests passing including new ones

**Step 4: Commit**

```bash
git add services/weatherService.js services/weatherService.test.js
git commit -m "feat(weather): add conditionToIcon method for emoji weather icons"
```

---

## Task 6: Refactor Day in Life Service - Event Grouping

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.js`
- Modify: `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.test.js`

**Step 1: Add test for event grouping logic**

Add to `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.test.js`:

```javascript
  describe('generateEvents', () => {
    it('should group contiguous check-ins without activity interruption', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T12:00:00Z', venue_name: 'Lunch', latitude: 40.7138, longitude: -74.0070 },
        { id: 3, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('checkin_group');
      expect(events[0].checkins).toHaveLength(3);
    });

    it('should split check-in groups when Garmin activity interrupts', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: null, garmin_id: 123 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, activity, checkin
      expect(events[0].type).toBe('checkin_group');
      expect(events[1].type).toContain('activity');
      expect(events[2].type).toBe('checkin_group');
    });

    it('should split check-in groups when Strava activity interrupts', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 },
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 }
      ];
      const mockActivities = [
        { id: 1, start_date_time: '2024-01-15T10:00:00Z', type: 'Run', map_polyline: null, strava_id: 456 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, activity, checkin
      expect(events[0].type).toBe('checkin_group');
      expect(events[1].type).toContain('activity');
      expect(events[2].type).toBe('checkin_group');
    });

    it('should order events chronologically', async () => {
      const mockCheckins = [
        { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum', latitude: 40.7148, longitude: -74.0080 },
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: null, garmin_id: 123 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(new Date(events[0].startTime)).toBeLessThan(new Date(events[1].startTime));
      expect(new Date(events[1].startTime)).toBeLessThan(new Date(events[2].startTime));
    });

    it('should handle both Strava and Garmin activities together', async () => {
      const mockCheckins = [
        { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee', latitude: 40.7128, longitude: -74.0060 }
      ];
      const mockActivities = [
        { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running', tracklog: 'LINESTRING(...)', garmin_id: 123 },
        { id: 2, start_date_time: '2024-01-15T15:00:00Z', type: 'Ride', map_polyline: 'encoded_polyline', strava_id: 456 }
      ];

      const events = await dayInLifeService.generateEvents(mockCheckins, mockActivities);

      expect(events).toHaveLength(3); // checkin, garmin activity, strava activity
      expect(events[1].type).toBe('garmin_activity_mapped');
      expect(events[2].type).toBe('strava_activity_mapped');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
npm test -- dayInLifeService.test.js
```

Expected: FAIL - generateEvents method doesn't exist

**Step 3: Implement event grouping logic**

Update `/Users/gabormikes/swarm-visualizer/server/services/dayInLifeService.js` - replace the getDayInLife method:

```javascript
const db = require('../db/connection');
const weatherService = require('./weatherService');
const staticMapGenerator = require('./staticMapGenerator');
const DailyWeather = require('../models/dailyWeather');
const Checkin = require('../models/checkin');
const StravaActivity = require('../models/stravaActivity');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

class DayInLifeService {
  async getDayInLife(userId, date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch all data in parallel
    const [checkins, stravaActivities, garminActivities, steps, heartRate, sleep] = await Promise.allSettled([
      this.getCheckins(userId, dateObj, nextDay),
      this.getStravaActivities(userId, dateObj, nextDay),
      this.getGarminActivities(userId, dateObj, nextDay),
      this.getSteps(userId, dateStr),
      this.getHeartRate(userId, dateStr),
      this.getSleep(userId, dateStr)
    ]);

    const checkinsData = checkins.status === 'fulfilled' ? checkins.value : [];
    const stravaData = stravaActivities.status === 'fulfilled' ? stravaActivities.value : [];
    const garminData = garminActivities.status === 'fulfilled' ? garminActivities.value : [];
    const allActivities = [...stravaData, ...garminData];

    // Get weather
    const weather = await this.getWeather(userId, dateObj, nextDay, checkinsData);

    // Calculate properties
    const properties = {
      weather,
      sleep: sleep.status === 'fulfilled' && sleep.value ? {
        duration: sleep.value.sleep_duration_seconds,
        score: sleep.value.sleep_score
      } : null,
      steps: steps.status === 'fulfilled' && steps.value ? {
        count: steps.value.step_count
      } : null,
      checkins: { count: checkinsData.length },
      activities: { count: allActivities.length },
      heartRate: heartRate.status === 'fulfilled' && heartRate.value ? {
        min: heartRate.value.min_heart_rate,
        max: heartRate.value.max_heart_rate
      } : null,
      calories: {
        total: allActivities.reduce((sum, a) => sum + (a.calories || 0), 0)
      }
    };

    // Generate events
    const events = await this.generateEvents(checkinsData, allActivities);

    return {
      date: dateStr,
      properties,
      events
    };
  }

  async getCheckins(userId, startDate, endDate) {
    const query = `
      SELECT * FROM checkins
      WHERE user_id = $1 AND checkin_date >= $2 AND checkin_date < $3
      ORDER BY checkin_date ASC
    `;
    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }

  async getStravaActivities(userId, startDate, endDate) {
    return await StravaActivity.findByUserAndDateRange(userId, startDate, endDate);
  }

  async getGarminActivities(userId, startDate, endDate) {
    return await GarminActivity.findByUserAndDateRange(userId, startDate, endDate);
  }

  async getSteps(userId, date) {
    const query = `
      SELECT * FROM garmin_daily_steps
      WHERE user_id = $1 AND date = $2
    `;
    const result = await db.query(query, [userId, date]);
    return result.rows[0];
  }

  async getHeartRate(userId, date) {
    const query = `
      SELECT * FROM garmin_daily_heart_rate
      WHERE user_id = $1 AND date = $2
    `;
    const result = await db.query(query, [userId, date]);
    return result.rows[0];
  }

  async getSleep(userId, date) {
    const query = `
      SELECT * FROM garmin_daily_sleep
      WHERE user_id = $1 AND date = $2
    `;
    const result = await db.query(query, [userId, date]);
    return result.rows[0];
  }

  async getWeather(userId, date, nextDay, checkins) {
    if (checkins.length === 0) return null;

    // Use most common country
    const countries = checkins.map(c => c.country).filter(Boolean);
    if (countries.length === 0) return null;

    const primaryCountry = this.mostCommon(countries);
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    // Check cache
    const cached = await DailyWeather.findByDateAndLocation(dateStr, primaryCountry);

    if (cached) {
      return {
        temp: cached.temp_celsius,
        condition: cached.condition,
        icon: cached.weather_icon,
        country: cached.country
      };
    }

    // Fetch from API using first checkin's coordinates
    const firstCheckin = checkins[0];
    const weatherData = await weatherService.getHistoricalWeather(
      firstCheckin.latitude,
      firstCheckin.longitude,
      dateStr
    );

    if (!weatherData) return null;

    // Cache it
    const avgTemp = (weatherData.temperature_max + weatherData.temperature_min) / 2;
    await DailyWeather.upsert({
      date: dateStr,
      country: primaryCountry,
      region: null,
      temp_celsius: Math.round(avgTemp),
      condition: weatherData.condition,
      weather_icon: weatherService.conditionToIcon(weatherData.condition)
    });

    return {
      temp: Math.round(avgTemp),
      condition: weatherData.condition,
      icon: weatherService.conditionToIcon(weatherData.condition),
      country: primaryCountry
    };
  }

  async generateEvents(checkins, activities) {
    // Combine and sort by time
    const allEvents = [
      ...checkins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c })),
      ...activities.map(a => {
        // Determine source: Strava activities have strava_id, Garmin activities have garmin_id
        const source = a.strava_id ? 'strava' : 'garmin';
        return {
          type: 'activity',
          time: new Date(a.start_time || a.start_date_time),
          data: a,
          source
        };
      })
    ].sort((a, b) => a.time - b.time);

    // Group contiguous checkins
    const events = [];
    let currentCheckinGroup = [];

    for (const event of allEvents) {
      if (event.type === 'checkin') {
        currentCheckinGroup.push(event.data);
      } else {
        // Activity interrupts checkins
        if (currentCheckinGroup.length > 0) {
          events.push(await this.createCheckinEvent(currentCheckinGroup));
          currentCheckinGroup = [];
        }
        events.push(await this.createActivityEvent(event.data, event.source));
      }
    }

    // Add remaining checkins
    if (currentCheckinGroup.length > 0) {
      events.push(await this.createCheckinEvent(currentCheckinGroup));
    }

    return events;
  }

  async createCheckinEvent(checkins) {
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

    return {
      type: 'checkin_group',
      startTime: checkins[0].checkin_date,
      checkins: checkins.map(c => ({
        ...c,
        photos: photosByCheckin[c.id] || []
      })),
      staticMapUrl: staticMapGenerator.generateCheckinMapUrl(checkins)
    };
  }

  async createActivityEvent(activity, source) {
    // Determine if activity is mapped (has GPS track data)
    // Garmin uses 'tracklog' (WKT format), Strava uses 'map_polyline' (encoded polyline)
    const trackData = activity.tracklog || activity.map_polyline;
    const isMapped = !!trackData;

    return {
      type: isMapped ? `${source}_activity_mapped` : `${source}_activity_unmapped`,
      startTime: activity.start_time || activity.start_date_time,
      activity: {
        id: activity.id,
        type: activity.activity_type || activity.type,
        name: activity.activity_name || activity.name,
        duration: activity.duration_seconds || activity.moving_time,
        distance: activity.distance_meters || activity.distance,
        calories: activity.calories,
        url: source === 'strava'
          ? (activity.strava_id ? `https://www.strava.com/activities/${activity.strava_id}` : null)
          : activity.garmin_url
      },
      staticMapUrl: isMapped
        ? staticMapGenerator.generateActivityMapUrl(trackData)
        : null
    };
  }

  mostCommon(arr) {
    return arr.sort((a, b) =>
      arr.filter(v => v === a).length - arr.filter(v => v === b).length
    ).pop();
  }
}

module.exports = new DayInLifeService();
```

**Step 4: Run test to verify it passes**

```bash
npm test -- dayInLifeService.test.js
```

Expected: PASS - All tests passing

**Step 5: Commit**

```bash
git add services/dayInLifeService.js services/dayInLifeService.test.js
git commit -m "refactor(dayinlife): add event grouping and photo integration"
```

---

## Task 7: Create Frontend Property Tile Component

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/PropertyTile.jsx`

**Step 1: Create component**

```jsx
import React from 'react';
import { Paper, Typography } from '@mui/material';

const PropertyTile = ({ icon, label, value, sublabel }) => {
  return (
    <Paper sx={{ p: 2, textAlign: 'center', minWidth: 140 }}>
      <Typography variant="h4">{icon}</Typography>
      <Typography variant="h6" sx={{ mt: 1 }}>
        {value || 'No data'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {sublabel && (
        <Typography variant="caption" display="block" color="text.secondary">
          {sublabel}
        </Typography>
      )}
    </Paper>
  );
};

export default PropertyTile;
```

**Step 2: Test build**

```bash
npm run build --prefix client
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add client/src/components/dayinlife/PropertyTile.jsx
git commit -m "feat(ui): add PropertyTile component for day metrics"
```

---

## Task 8: Create Frontend Checkin Event Tile Component

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/CheckinEventTile.jsx`

**Step 1: Create component**

```jsx
import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { Map as MapIcon, Photo } from '@mui/icons-material';

const CheckinEventTile = ({ event, onPhotoClick, authToken }) => {
  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        CHECK-INS
      </Typography>

      {/* Static Map */}
      {event.staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={event.staticMapUrl}
            alt="Check-in map"
            style={{ width: '100%', borderRadius: 8 }}
          />
          <Link
            href={`/?token=${authToken}`}
            target="_blank"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 1
            }}
          >
            <MapIcon /> Jump to main map
          </Link>
        </Box>
      )}

      {/* Timeline */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Timeline:
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {event.checkins.map((checkin, idx) => (
            <Box key={idx} sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="caption" display="block">
                {new Date(checkin.checkin_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', mx: 'auto', my: 1 }} />
              <Typography variant="caption" display="block">
                {checkin.venue_name}
              </Typography>
              {checkin.photos && checkin.photos.length > 0 && (
                <Box
                  onClick={() => onPhotoClick(checkin.photos)}
                  sx={{ cursor: 'pointer', mt: 0.5 }}
                >
                  <Photo fontSize="small" />
                  <Typography variant="caption">
                    {checkin.photos.length} {checkin.photos.length === 1 ? 'photo' : 'photos'}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default CheckinEventTile;
```

**Step 2: Test build**

```bash
npm run build --prefix client
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add client/src/components/dayinlife/CheckinEventTile.jsx
git commit -m "feat(ui): add CheckinEventTile with map and photo support"
```

---

## Task 9: Create Frontend Activity Event Tile Component

**Files:**
- Create: `/Users/gabormikes/swarm-visualizer/client/src/components/dayinlife/ActivityEventTile.jsx`

**Step 1: Create component**

```jsx
import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';

const ActivityEventTile = ({ event }) => {
  const { activity, staticMapUrl } = event;
  const isMapped = event.type.includes('mapped');

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

      {/* Static Map (if mapped activity) */}
      {isMapped && staticMapUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={staticMapUrl}
            alt="Activity map"
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
                borderRadius: 1
              }}
            >
              <OpenInNew /> View Details
            </Link>
          )}
        </Box>
      )}

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
    </Paper>
  );
};

export default ActivityEventTile;
```

**Step 2: Test build**

```bash
npm run build --prefix client
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add client/src/components/dayinlife/ActivityEventTile.jsx
git commit -m "feat(ui): add ActivityEventTile with map and stats display"
```

---

## Task 10: Refactor Day in Life Page to Use New Components

**Files:**
- Modify: `/Users/gabormikes/swarm-visualizer/client/src/pages/DayInLifePage.jsx`

**Step 1: Update imports and component usage**

Replace the entire `/Users/gabormikes/swarm-visualizer/client/src/pages/DayInLifePage.jsx` with:

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Grid,
  CircularProgress
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarToday } from '@mui/icons-material';
import Layout from '../components/Layout';
import PropertyTile from '../components/dayinlife/PropertyTile';
import CheckinEventTile from '../components/dayinlife/CheckinEventTile';
import ActivityEventTile from '../components/dayinlife/ActivityEventTile';
import { getDayInLifeData } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const DayInLifePage = ({ darkMode, onToggleDarkMode }) => {
  const { date } = useParams();
  const navigate = useNavigate();
  const [token] = useState(localStorage.getItem('authToken'));
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState([]);

  const currentDate = date ? new Date(date) : new Date();

  useEffect(() => {
    if (date) {
      loadDayData(date);
    } else {
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      navigate(`/day-in-life/${today}`);
    }
  }, [date]);

  const loadDayData = async (dateStr) => {
    setLoading(true);
    try {
      const data = await getDayInLifeData(dateStr, token);
      setDayData(data);
    } catch (error) {
      console.error('Failed to load day data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    navigate(`/day-in-life/${prev.toISOString().split('T')[0]}`);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    navigate(`/day-in-life/${next.toISOString().split('T')[0]}`);
  };

  const handlePhotoClick = (photos) => {
    setLightboxPhotos(photos.map(p => ({ src: p.photo_url_cached || p.photo_url })));
    setLightboxOpen(true);
  };

  const formatSleepDuration = (seconds) => {
    if (!seconds) return 'No data';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!dayData) {
    return (
      <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5">No data available for this date</Typography>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
      <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <IconButton onClick={handlePrevDay}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h4">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Typography>
          <Box>
            <IconButton>
              <CalendarToday />
            </IconButton>
            <IconButton onClick={handleNextDay}>
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>

        {/* Properties */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* Weather */}
          {dayData.properties.weather && (
            <Grid item>
              <PropertyTile
                icon={dayData.properties.weather.icon}
                label="Weather"
                value={`${dayData.properties.weather.temp}°C`}
                sublabel={dayData.properties.weather.country}
              />
            </Grid>
          )}

          {/* Sleep */}
          <Grid item>
            <PropertyTile
              icon="💤"
              label="Sleep"
              value={dayData.properties.sleep
                ? formatSleepDuration(dayData.properties.sleep.duration)
                : 'No data'}
              sublabel={dayData.properties.sleep?.score
                ? `Score: ${dayData.properties.sleep.score}`
                : null}
            />
          </Grid>

          {/* Steps */}
          <Grid item>
            <PropertyTile
              icon="👟"
              label="Steps"
              value={dayData.properties.steps?.count.toLocaleString() || 'No data'}
            />
          </Grid>

          {/* Check-ins */}
          <Grid item>
            <PropertyTile
              icon="📍"
              label="Check-ins"
              value={dayData.properties.checkins.count}
            />
          </Grid>

          {/* Activities */}
          <Grid item>
            <PropertyTile
              icon="🏃"
              label="Activities"
              value={dayData.properties.activities.count}
            />
          </Grid>

          {/* Heart Rate */}
          <Grid item>
            <PropertyTile
              icon="❤️"
              label="Heart Rate"
              value={dayData.properties.heartRate
                ? `${dayData.properties.heartRate.min}-${dayData.properties.heartRate.max}`
                : 'No data'}
              sublabel="bpm"
            />
          </Grid>

          {/* Calories */}
          <Grid item>
            <PropertyTile
              icon="🔥"
              label="Calories"
              value={dayData.properties.calories.total || 'No data'}
            />
          </Grid>
        </Grid>

        {/* Events */}
        <Typography variant="h5" gutterBottom>
          Timeline
        </Typography>
        {dayData.events.length === 0 ? (
          <Typography color="text.secondary">
            No activities for this day
          </Typography>
        ) : (
          dayData.events.map((event, idx) => (
            <Box key={idx}>
              {event.type === 'checkin_group' && (
                <CheckinEventTile
                  event={event}
                  onPhotoClick={handlePhotoClick}
                  authToken={token}
                />
              )}
              {(event.type.includes('activity')) && (
                <ActivityEventTile event={event} />
              )}
            </Box>
          ))
        )}

        {/* Photo Lightbox */}
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxPhotos}
        />
      </Box>
    </Layout>
  );
};

export default DayInLifePage;
```

**Step 2: Update API function**

Update `/Users/gabormikes/swarm-visualizer/client/src/services/api.js` - replace getDayInLife function:

```javascript
export const getDayInLifeData = async (date, token) => {
  const response = await fetch(
    `${API_URL}/api/day-in-life/${date}?token=${token}`
  );
  if (!response.ok) throw new Error('Failed to get day data');
  return response.json();
};
```

**Step 3: Test build**

```bash
npm run build --prefix client
```

Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add client/src/pages/DayInLifePage.jsx client/src/services/api.js
git commit -m "refactor(ui): update DayInLifePage to use specialized components"
```

---

## Task 11: Final Testing and Verification

**Step 1: Run all backend tests**

```bash
npm test
```

Expected: All tests passing

**Step 2: Test frontend build**

```bash
npm run build --prefix client
```

Expected: Clean build with no errors

**Step 3: Manual testing checklist**

Start dev server:
```bash
npm run dev
```

Test:
- [ ] Navigate to /day-in-life → redirects to today
- [ ] Property tiles display for all metrics
- [ ] Check-in groups show static map
- [ ] Check-in timeline shows all venues
- [ ] Photo indicators appear and lightbox works
- [ ] Activity tiles show static map for mapped activities
- [ ] Activity stats display correctly
- [ ] Prev/Next navigation works
- [ ] Weather caches to database
- [ ] Events ordered chronologically
- [ ] Activities interrupt check-in groups

**Step 4: Final commit**

```bash
git add .
git commit -m "test: verify Day in Life refactor complete"
```

---

## Summary

This plan refactors the Day in the Life feature to match the original specification with full support for both Strava and Garmin activities:

**What was added:**
1. ✅ Daily weather table with persistent caching
2. ✅ Daily weather model
3. ✅ Static map generator for Mapbox (supports both WKT and polyline formats)
4. ✅ Event grouping logic (contiguous check-ins interrupted by activities)
5. ✅ Photo integration in check-in events
6. ✅ Specialized frontend components (PropertyTile, CheckinEventTile, ActivityEventTile)
7. ✅ Full support for both Strava and Garmin activities (mapped and unmapped)

**What was improved:**
- Weather now persists to database instead of memory-only cache
- Check-ins grouped intelligently (interrupted by either Strava or Garmin activities)
- Static maps provide visual context for both check-ins and activities
- Photos accessible directly from timeline
- Better data structure matching original design
- Event types distinguish between sources: `strava_activity_mapped`, `strava_activity_unmapped`, `garmin_activity_mapped`, `garmin_activity_unmapped`

**Technical debt addressed:**
- Proper separation of concerns with specialized components
- Database persistence for weather data
- Better error handling with Promise.allSettled
- Unified handling of multiple activity sources

**Activity Integration:**
- **Strava activities**: Use `map_polyline` field (already encoded polyline format)
- **Garmin activities**: Use `tracklog` field (WKT LINESTRING format, converted to polyline)
- Static map generator automatically detects format and handles both
- Event types explicitly indicate source and mapping status
- Activity URLs link to appropriate platform (Strava.com or Garmin URL)

The implementation now fully matches the original design specification from `2025-01-13-life-visualizer-dayinlife.md` with the addition of Strava integration support.
