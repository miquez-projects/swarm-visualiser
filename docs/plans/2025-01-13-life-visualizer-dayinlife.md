# Life Visualizer - Implementation Plan

**Date:** January 13, 2025
**Design Doc:** [2025-01-13-life-visualizer-design.md](./2025-01-13-life-visualizer-design.md)

## Overview

This document provides a detailed, step-by-step implementation plan for the Life Visualizer feature set. The plan is organized into distinct parts with testing checkpoints after each major component.

## Implementation Order

```
Part 5: Day in the Life
  ↓
[TESTING CHECKPOINT #5]
  ↓
COMPLETE
```

---


## Part 5: Day in the Life of Feature

**Estimated Time:** 6-7 days

### Phase 5.1: Database Migration - Weather

#### Task 5.1.1: Create Weather Table Migration

**File:** `migrations/007_add_daily_weather.sql`
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

#### Task 5.1.2: Run Migration
```bash
node server/db/run-migration.js migrations/007_add_daily_weather.sql
```

### Phase 5.2: Backend - Weather Service

#### Task 5.2.1: Create Open-Meteo Service

**File:** `server/services/openMeteo.js`
```javascript
const axios = require('axios');

class OpenMeteoService {
  async getHistoricalWeather(latitude, longitude, date) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
        params: {
          latitude,
          longitude,
          start_date: dateStr,
          end_date: dateStr,
          daily: 'temperature_2m_max,temperature_2m_min,weathercode',
          timezone: 'auto'
        }
      });

      const data = response.data.daily;

      return {
        temp_max: data.temperature_2m_max[0],
        temp_min: data.temperature_2m_min[0],
        temp_avg: (data.temperature_2m_max[0] + data.temperature_2m_min[0]) / 2,
        weather_code: data.weathercode[0],
        condition: this.weatherCodeToCondition(data.weathercode[0])
      };
    } catch (error) {
      console.error('Open-Meteo API error:', error);
      return null;
    }
  }

  weatherCodeToCondition(code) {
    // WMO Weather interpretation codes
    if (code === 0) return 'clear';
    if (code <= 3) return 'partly_cloudy';
    if (code <= 48) return 'cloudy';
    if (code <= 67) return 'rainy';
    if (code <= 77) return 'snowy';
    return 'stormy';
  }

  conditionToIcon(condition) {
    const icons = {
      clear: '☀️',
      partly_cloudy: '🌤',
      cloudy: '☁️',
      rainy: '🌧',
      snowy: '🌨',
      stormy: '⛈'
    };
    return icons[condition] || '🌤';
  }
}

module.exports = new OpenMeteoService();
```

#### Task 5.2.2: Create Weather Model

**File:** `server/models/dailyWeather.js`
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

### Phase 5.3: Backend - Day in Life Service

#### Task 5.3.1: Create Static Map Generator

**File:** `server/services/staticMapGenerator.js`
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

  generateActivityMapUrl(tracklog, width = 600, height = 400) {
    if (!tracklog) return null;

    // tracklog is WKT format: "LINESTRING(lon lat, lon lat, ...)"
    const coords = this.parseLineString(tracklog);
    const encodedPath = polyline.encode(coords.map(c => [c[1], c[0]])); // lat,lon for polyline

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

#### Task 5.3.2: Install Polyline Package
```bash
npm install @mapbox/polyline
```

#### Task 5.3.3: Create Day in Life Service

**File:** `server/services/dayInLife.js`
```javascript
const db = require('../db/connection');
const openMeteo = require('./openMeteo');
const staticMapGenerator = require('./staticMapGenerator');
const DailyWeather = require('../models/dailyWeather');

class DayInLifeService {
  async getDayData(userId, date) {
    const dateStr = date.toISOString().split('T')[0];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch all data for the day
    const [checkins, activities, steps, heartRate, sleep, weather] = await Promise.all([
      this.getCheckins(userId, date, nextDay),
      this.getActivities(userId, date, nextDay),
      this.getSteps(userId, dateStr),
      this.getHeartRate(userId, dateStr),
      this.getSleep(userId, dateStr),
      this.getWeather(userId, date, nextDay)
    ]);

    // Calculate properties
    const properties = {
      weather,
      sleep: sleep ? {
        duration: sleep.sleep_duration_seconds,
        score: sleep.sleep_score
      } : null,
      steps: steps ? { count: steps.step_count } : null,
      checkins: { count: checkins.length },
      activities: { count: activities.length },
      heartRate: heartRate ? {
        min: heartRate.min_heart_rate,
        max: heartRate.max_heart_rate
      } : null,
      calories: {
        total: activities.reduce((sum, a) => sum + (a.calories || 0), 0)
      }
    };

    // Generate events
    const events = await this.generateEvents(checkins, activities);

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

  async getActivities(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_activities
      WHERE user_id = $1 AND start_time >= $2 AND start_time < $3
      ORDER BY start_time ASC
    `;
    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
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

  async getWeather(userId, date, nextDay) {
    // Get checkins for the day to determine location
    const checkins = await this.getCheckins(userId, date, nextDay);
    if (checkins.length === 0) return null;

    // Use most common country
    const countries = checkins.map(c => c.country).filter(Boolean);
    if (countries.length === 0) return null;

    const primaryCountry = this.mostCommon(countries);

    // Check cache
    const cached = await DailyWeather.findByDateAndLocation(
      date.toISOString().split('T')[0],
      primaryCountry
    );

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
    const weatherData = await openMeteo.getHistoricalWeather(
      firstCheckin.latitude,
      firstCheckin.longitude,
      date
    );

    if (!weatherData) return null;

    // Cache it
    await DailyWeather.upsert({
      date: date.toISOString().split('T')[0],
      country: primaryCountry,
      region: null,
      temp_celsius: Math.round(weatherData.temp_avg),
      condition: weatherData.condition,
      weather_icon: openMeteo.conditionToIcon(weatherData.condition)
    });

    return {
      temp: Math.round(weatherData.temp_avg),
      condition: weatherData.condition,
      icon: openMeteo.conditionToIcon(weatherData.condition),
      country: primaryCountry
    };
  }

  async generateEvents(checkins, activities) {
    // Combine and sort by time
    const allEvents = [
      ...checkins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c })),
      ...activities.map(a => ({ type: 'activity', time: new Date(a.start_time), data: a }))
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
        events.push(await this.createActivityEvent(event.data));
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

  async createActivityEvent(activity) {
    const isMapped = !!activity.tracklog;

    return {
      type: isMapped ? 'garmin_activity_mapped' : 'garmin_activity_unmapped',
      startTime: activity.start_time,
      activity: {
        id: activity.id,
        type: activity.activity_type,
        name: activity.activity_name,
        duration: activity.duration_seconds,
        distance: activity.distance_meters,
        calories: activity.calories,
        garminUrl: activity.garmin_url
      },
      staticMapUrl: isMapped
        ? staticMapGenerator.generateActivityMapUrl(activity.tracklog)
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

#### Task 5.3.4: Create Day in Life Routes

**File:** `server/routes/dayInLife.js`
```javascript
const express = require('express');
const router = express.Router();
const dayInLifeService = require('../services/dayInLife');
const User = require('../models/user');

// GET /api/day-in-life/:date
router.get('/:date', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const dayData = await dayInLifeService.getDayData(user.id, date);

    res.json(dayData);
  } catch (error) {
    console.error('Day in life error:', error);
    res.status(500).json({
      error: 'Failed to get day data',
      message: error.message
    });
  }
});

module.exports = router;
```

#### Task 5.3.5: Register Day in Life Routes

**File:** `server/app.js`
```javascript
const dayInLifeRoutes = require('./routes/dayInLife');
app.use('/api/day-in-life', dayInLifeRoutes);
```

### Phase 5.4: Frontend - Day in Life Page

#### Task 5.4.1: Create Property Tile Component

**File:** `client/src/components/dayinlife/PropertyTile.jsx`
```jsx
import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

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

#### Task 5.4.2: Create Event Tile Components

**File:** `client/src/components/dayinlife/CheckinEventTile.jsx`
```jsx
import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { Map as MapIcon, Photo } from '@mui/icons-material';

const CheckinEventTile = ({ event, onPhotoClick }) => {
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
            href={`/?token=${localStorage.getItem('authToken')}`}
            target="_blank"
            sx={{ position: 'absolute', top: 8, right: 8 }}
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
              {checkin.photos.length > 0 && (
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

**File:** `client/src/components/dayinlife/ActivityEventTile.jsx`
```jsx
import React from 'react';
import { Paper, Typography, Box, Link } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';

const ActivityEventTile = ({ event }) => {
  const { activity, staticMapUrl } = event;
  const isMapped = event.type === 'garmin_activity_mapped';

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
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
          {activity.garminUrl && (
            <Link
              href={activity.garminUrl}
              target="_blank"
              sx={{ position: 'absolute', top: 8, right: 8 }}
            >
              <OpenInNew /> View on Garmin
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

#### Task 5.4.3: Create Day in Life Page

**File:** `client/src/pages/DayInLifePage.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Grid,
  CircularProgress,
  Button
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarToday } from '@mui/icons-material';
import Layout from '../components/Layout';
import PropertyTile from '../components/dayinlife/PropertyTile';
import CheckinEventTile from '../components/dayinlife/CheckinEventTile';
import ActivityEventTile from '../components/dayinlife/ActivityEventTile';
import { getDayInLifeData } from '../services/api';
import Lightbox from 'yet-another-react-lightbox';

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
                <CheckinEventTile event={event} onPhotoClick={handlePhotoClick} />
              )}
              {(event.type === 'garmin_activity_mapped' || event.type === 'garmin_activity_unmapped') && (
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

#### Task 5.4.4: Add API Function

**File:** `client/src/services/api.js`
```javascript
export const getDayInLifeData = async (date, token) => {
  const response = await fetch(
    `${API_URL}/api/day-in-life/${date}?token=${token}`
  );
  if (!response.ok) throw new Error('Failed to get day data');
  return response.json();
};
```

#### Task 5.4.5: Add Route to App

**File:** `client/src/App.js`
```jsx
import DayInLifePage from './pages/DayInLifePage';

// In Routes:
<Route path="/day-in-life/:date" element={<DayInLifePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
<Route path="/day-in-life" element={<DayInLifePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
```

#### Task 5.4.6: Update Layout to Add Navigation

**File:** `client/src/components/Layout.jsx`
```jsx
// Add to navigation buttons
<Button
  color="inherit"
  startIcon={<CalendarMonth />}
  onClick={() => navigate('/day-in-life')}
  sx={{ mr: 1 }}
>
  Day in Life
</Button>
```

### Phase 5.5: Testing

#### Task 5.5.1: Write Automated Tests

**File:** `server/services/dayInLife.test.js`
```javascript
const dayInLifeService = require('../services/dayInLife');

describe('Day in Life Service', () => {
  test('groups contiguous check-ins without activity interruption', async () => {
    const checkins = [
      { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee' },
      { id: 2, checkin_date: '2024-01-15T12:00:00Z', venue_name: 'Lunch' },
      { id: 3, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum' }
    ];
    const activities = [];

    const events = await dayInLifeService.generateEvents(checkins, activities);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('checkin_group');
    expect(events[0].checkins).toHaveLength(3);
  });

  test('splits check-in groups when activity interrupts', async () => {
    const checkins = [
      { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee' },
      { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum' }
    ];
    const activities = [
      { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running' }
    ];

    const events = await dayInLifeService.generateEvents(checkins, activities);

    expect(events).toHaveLength(3); // checkin, activity, checkin
    expect(events[0].type).toBe('checkin_group');
    expect(events[1].type).toContain('garmin_activity');
    expect(events[2].type).toBe('checkin_group');
  });

  test('orders events chronologically', async () => {
    const checkins = [
      { id: 2, checkin_date: '2024-01-15T14:00:00Z', venue_name: 'Museum' },
      { id: 1, checkin_date: '2024-01-15T09:00:00Z', venue_name: 'Coffee' }
    ];
    const activities = [
      { id: 1, start_time: '2024-01-15T10:00:00Z', activity_type: 'running' }
    ];

    const events = await dayInLifeService.generateEvents(checkins, activities);

    expect(new Date(events[0].startTime)).toBeLessThan(new Date(events[1].startTime));
    expect(new Date(events[1].startTime)).toBeLessThan(new Date(events[2].startTime));
  });
});
```

**File:** `server/services/staticMapGenerator.test.js`
```javascript
const staticMapGenerator = require('../services/staticMapGenerator');

describe('Static Map Generator', () => {
  test('generates valid Mapbox Static API URL for checkins', () => {
    const checkins = [
      { longitude: -74.0060, latitude: 40.7128 },
      { longitude: -74.0070, latitude: 40.7138 }
    ];

    const url = staticMapGenerator.generateCheckinMapUrl(checkins);

    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('path');
    expect(url).toContain('pin-s');
  });

  test('parses PostGIS LineString correctly', () => {
    const wkt = 'LINESTRING(-74.0060 40.7128, -74.0070 40.7138)';

    const coords = staticMapGenerator.parseLineString(wkt);

    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual([-74.0060, 40.7128]);
  });
});
```

#### Task 5.5.2: Run Tests
```bash
npm test
```

### 🔴 TESTING CHECKPOINT #5

**Automated Tests:**
```bash
npm test -- dayInLife.test.js staticMapGenerator.test.js openMeteo.test.js
```

**Manual Tests:**
1. Navigate to "Day in Life" from top nav
2. Default shows today's date
3. Date picker allows selecting different dates
4. Prev/Next navigation works
5. URL updates when changing dates: `/day-in-life/2024-01-15`
6. Direct URL navigation works
7. Property tiles display correctly for all metrics
8. "No data" states show for missing data
9. Weather tile shows correct temperature and location
10. Event tiles ordered chronologically
11. Check-in groups respect activity interruption rule
12. Check-in event tile:
    - Static map displays correctly
    - Curved lines connect check-ins
    - Timeline shows all check-ins with times
    - Photo indicators appear when photos exist
    - Clicking photo indicator opens lightbox
13. Garmin mapped activity tile:
    - Static map shows tracklog
    - External link to Garmin works
    - Stats display correctly (distance, duration, calories)
14. Garmin unmapped activity tile:
    - No map shown
    - Stats display correctly
15. Page performs well with 10+ events
16. Mobile responsive layout works
17. Loading state displays while fetching data
18. Error handling for invalid dates
19. Empty day (no data) displays gracefully
20. Photo lightbox navigation works

**Sign-off:** ✅ All Part 5 tests passing - IMPLEMENTATION COMPLETE

---

## Final Verification

### Complete Test Suite Run
```bash
npm test
```

**Expected:** All tests passing

### Manual End-to-End Flow

1. **Fresh user onboarding:**
   - Visit app without token → Splash screen
   - Click "Set up new user" → Data Sources page
   - Copy token URL, bookmark it
   - Connect Foursquare (existing flow)
   - Connect Garmin → Initial sync starts
   - Wait for sync to complete

2. **Daily usage:**
   - Return to app via bookmarked URL → 2-second splash → Main app
   - Click context menu → "Sync All Data" → Both sources sync
   - Navigate to "Day in Life" → View today
   - Browse previous days
   - View venue details → See photos
   - Click photo → Lightbox

3. **Verify data integrity:**
   - Check database tables populated correctly
   - Verify weather cached properly
   - Confirm static maps generating correctly

### Performance Check

- [ ] Page load times acceptable (<2s)
- [ ] Static map generation fast (<1s per map)
- [ ] Day in Life page loads quickly with 10+ events
- [ ] Photo lightbox performs well
- [ ] Test suite runs in <30s

### Deployment Checklist

- [ ] All migrations run on production database
- [ ] Environment variables set (MAPBOX_TOKEN, etc.)
- [ ] Frontend built and deployed
- [ ] Backend deployed with new dependencies
- [ ] Cron job updated to include Garmin sync
- [ ] Monitoring in place for new endpoints

---

## Conclusion

✅ **Life Visualizer Implementation Complete**

This implementation plan provides a complete, step-by-step guide to building the Life Visualizer feature set with integrated automated testing. Each part includes:
- Clear task breakdown
- Code examples
- Testing checkpoints (automated + manual)
- Dependencies and migrations

**Total Estimated Time:** 17-21 days

**Next Steps:**
1. Commit this plan to git
2. Create implementation branch
3. Begin Part 0 (Jest setup)
4. Proceed sequentially through parts
5. Test thoroughly at each checkpoint

Good luck with the implementation!
