# Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** January 15, 2025
**Previous Plan:** [2025-01-13-life-visualizer-implementation-plan.md](./2025-01-13-life-visualizer-implementation-plan.md)

## Status Update

**Completed (Parts 1-4):**
- ✅ Part 0: Jest Testing Setup
- ✅ Part 1: Splash Screen & Authentication
- ✅ Part 2: Context Menu & Navigation
- ✅ Part 3: Check-in Photos
- ✅ Part 4: Activity Data Integration
  - **Note:** Implemented both Garmin OAuth integration AND Strava OAuth integration
  - Both support mapped activities (with tracklogs) and unmapped activities
  - Strava includes activity photo sync

**Remaining:**
- Part 4.5: Garmin Data Dump Import (NEW)
- Part 5: Day in the Life Feature

---

## Part 4.5: Garmin Data Dump Import

**Goal:** Allow users to upload Garmin data export files to import daily metrics (steps, heart rate, sleep) for "Day in the Life" feature.

**Architecture:** File upload endpoint that parses Garmin CSV exports and imports into existing daily metrics tables. No OAuth needed - pure file-based import.

**Tech Stack:**
- Multer (file upload)
- csv-parser (CSV parsing)
- Existing Garmin models (garminDailySteps, garminDailyHeartRate, garminDailySleep)

---

###Task 4.5.1: Add File Upload Dependencies

**Step 1: Install dependencies**

```bash
cd /Users/gabormikes/swarm-visualizer
npm install multer csv-parser
```

**Step 2: Verify installation**

```bash
npm list multer csv-parser
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add file upload dependencies for Garmin data dump"
```

---

### Task 4.5.2: Create Garmin CSV Parser Service

**Files:**
- Create: `server/services/garminCsvParser.js`
- Test: `server/services/garminCsvParser.test.js`

**Step 1: Write failing test**

Create `server/services/garminCsvParser.test.js`:

```javascript
const GarminCsvParser = require('./garminCsvParser');
const fs = require('fs');
const path = require('path');

describe('GarminCsvParser', () => {
  describe('parseStepsFile', () => {
    it('should parse daily steps CSV', async () => {
      const csvContent = `Date,Steps
2024-01-15,10523
2024-01-16,8942`;

      const result = await GarminCsvParser.parseStepsFile(csvContent);

      expect(result).toEqual([
        { date: '2024-01-15', step_count: 10523 },
        { date: '2024-01-16', step_count: 8942 }
      ]);
    });
  });

  describe('parseHeartRateFile', () => {
    it('should parse daily heart rate CSV', async () => {
      const csvContent = `Date,Resting HR,Min HR,Max HR
2024-01-15,62,45,168`;

      const result = await GarminCsvParser.parseHeartRateFile(csvContent);

      expect(result).toEqual([{
        date: '2024-01-15',
        resting_heart_rate: 62,
        min_heart_rate: 45,
        max_heart_rate: 168
      }]);
    });
  });

  describe('parseSleepFile', () => {
    it('should parse daily sleep CSV', async () => {
      const csvContent = `Date,Total Sleep (seconds),Deep Sleep (seconds),Light Sleep (seconds),REM Sleep (seconds),Awake (seconds)
2024-01-15,28800,7200,14400,5400,1800`;

      const result = await GarminCsvParser.parseSleepFile(csvContent);

      expect(result).toEqual([{
        date: '2024-01-15',
        sleep_duration_seconds: 28800,
        deep_sleep_seconds: 7200,
        light_sleep_seconds: 14400,
        rem_sleep_seconds: 5400,
        awake_seconds: 1800
      }]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/gabormikes/swarm-visualizer/server
npm test -- garminCsvParser.test.js
```

Expected: FAIL - "Cannot find module './garminCsvParser'"

**Step 3: Implement minimal service**

Create `server/services/garminCsvParser.js`:

```javascript
const csv = require('csv-parser');
const { Readable } = require('stream');

class GarminCsvParser {
  /**
   * Parse steps CSV content
   * Expected format: Date,Steps
   */
  async parseStepsFile(csvContent) {
    return this._parseCSV(csvContent, (row) => ({
      date: row.Date || row.date,
      step_count: parseInt(row.Steps || row.steps, 10)
    }));
  }

  /**
   * Parse heart rate CSV content
   * Expected format: Date,Resting HR,Min HR,Max HR
   */
  async parseHeartRateFile(csvContent) {
    return this._parseCSV(csvContent, (row) => ({
      date: row.Date || row.date,
      resting_heart_rate: this._parseInt(row['Resting HR'] || row.resting_hr),
      min_heart_rate: this._parseInt(row['Min HR'] || row.min_hr),
      max_heart_rate: this._parseInt(row['Max HR'] || row.max_hr)
    }));
  }

  /**
   * Parse sleep CSV content
   * Expected format: Date,Total Sleep (seconds),Deep Sleep (seconds),Light Sleep (seconds),REM Sleep (seconds),Awake (seconds)
   */
  async parseSleepFile(csvContent) {
    return this._parseCSV(csvContent, (row) => ({
      date: row.Date || row.date,
      sleep_duration_seconds: this._parseInt(row['Total Sleep (seconds)'] || row.total_sleep),
      deep_sleep_seconds: this._parseInt(row['Deep Sleep (seconds)'] || row.deep_sleep),
      light_sleep_seconds: this._parseInt(row['Light Sleep (seconds)'] || row.light_sleep),
      rem_sleep_seconds: this._parseInt(row['REM Sleep (seconds)'] || row.rem_sleep),
      awake_seconds: this._parseInt(row['Awake (seconds)'] || row.awake)
    }));
  }

  /**
   * Generic CSV parser
   */
  async _parseCSV(csvContent, transformer) {
    const results = [];

    return new Promise((resolve, reject) => {
      const stream = Readable.from([csvContent]);

      stream
        .pipe(csv())
        .on('data', (row) => {
          try {
            const transformed = transformer(row);
            results.push(transformed);
          } catch (err) {
            console.error('Error transforming row:', err);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  /**
   * Safely parse integer, return null if invalid
   */
  _parseInt(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
}

module.exports = new GarminCsvParser();
```

**Step 4: Run test to verify it passes**

```bash
npm test -- garminCsvParser.test.js
```

Expected: PASS - All tests green

**Step 5: Commit**

```bash
git add server/services/garminCsvParser.js server/services/garminCsvParser.test.js
git commit -m "feat: add Garmin CSV parser service with tests"
```

---

### Task 4.5.3: Create File Upload Route

**Files:**
- Create: `server/routes/garminDataDump.js`
- Modify: `server/server.js` (add route)

**Step 1: Create route file**

Create `server/routes/garminDataDump.js`:

```javascript
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const garminCsvParser = require('../services/garminCsvParser');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * POST /api/garmin-dump/steps
 * Upload daily steps CSV
 */
router.post('/steps', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = await garminCsvParser.parseStepsFile(csvContent);

    let imported = 0;
    for (const record of records) {
      await GarminDailySteps.upsert({
        user_id: req.user.id,
        ...record
      });
      imported++;
    }

    res.json({
      message: `Successfully imported ${imported} daily step records`,
      imported
    });
  } catch (error) {
    console.error('Steps upload error:', error);
    res.status(500).json({ error: 'Failed to import steps data' });
  }
});

/**
 * POST /api/garmin-dump/heart-rate
 * Upload daily heart rate CSV
 */
router.post('/heart-rate', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = await garminCsvParser.parseHeartRateFile(csvContent);

    let imported = 0;
    for (const record of records) {
      await GarminDailyHeartRate.upsert({
        user_id: req.user.id,
        ...record
      });
      imported++;
    }

    res.json({
      message: `Successfully imported ${imported} daily heart rate records`,
      imported
    });
  } catch (error) {
    console.error('Heart rate upload error:', error);
    res.status(500).json({ error: 'Failed to import heart rate data' });
  }
});

/**
 * POST /api/garmin-dump/sleep
 * Upload daily sleep CSV
 */
router.post('/sleep', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = await garminCsvParser.parseSleepFile(csvContent);

    let imported = 0;
    for (const record of records) {
      await GarminDailySleep.upsert({
        user_id: req.user.id,
        ...record
      });
      imported++;
    }

    res.json({
      message: `Successfully imported ${imported} daily sleep records`,
      imported
    });
  } catch (error) {
    console.error('Sleep upload error:', error);
    res.status(500).json({ error: 'Failed to import sleep data' });
  }
});

module.exports = router;
```

**Step 2: Register route in server.js**

Modify `server/server.js` - add after other routes:

```javascript
// Garmin data dump upload
const garminDataDumpRoutes = require('./routes/garminDataDump');
app.use('/api/garmin-dump', garminDataDumpRoutes);
```

**Step 3: Manual test with curl**

Start server:
```bash
npm run dev
```

Create test CSV file `test-steps.csv`:
```csv
Date,Steps
2024-01-15,10523
```

Upload:
```bash
curl -X POST http://localhost:3001/api/garmin-dump/steps \
  -H "x-auth-token: YOUR_TOKEN" \
  -F "file=@test-steps.csv"
```

Expected: `{"message":"Successfully imported 1 daily step records","imported":1}`

**Step 4: Verify in database**

```bash
psql $DATABASE_URL -c "SELECT * FROM garmin_daily_steps ORDER BY date DESC LIMIT 5;"
```

Expected: See the uploaded step data

**Step 5: Commit**

```bash
git add server/routes/garminDataDump.js server/server.js
git commit -m "feat: add Garmin data dump upload endpoints"
```

---

### Task 4.5.4: Add Frontend Upload UI

**Files:**
- Modify: `client/src/pages/DataSourcesPage.jsx`

**Step 1: Add file upload UI to Garmin card**

In `client/src/pages/DataSourcesPage.jsx`, add upload section after the sync buttons in the Garmin connected state:

```javascript
{garminStatus.connected && (
  <>
    {/* Existing sync buttons... */}

    {/* Data Dump Upload Section */}
    <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>
        Upload Garmin Data Export
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Import daily metrics from Garmin Connect data export (steps, heart rate, sleep)
      </Typography>

      <Box display="flex" flexDirection="column" gap={1}>
        <input
          accept=".csv"
          style={{ display: 'none' }}
          id="steps-file-upload"
          type="file"
          onChange={(e) => handleFileUpload(e, 'steps')}
        />
        <label htmlFor="steps-file-upload">
          <Button variant="outlined" component="span" size="small">
            Upload Steps CSV
          </Button>
        </label>

        <input
          accept=".csv"
          style={{ display: 'none' }}
          id="hr-file-upload"
          type="file"
          onChange={(e) => handleFileUpload(e, 'heart-rate')}
        />
        <label htmlFor="hr-file-upload">
          <Button variant="outlined" component="span" size="small">
            Upload Heart Rate CSV
          </Button>
        </label>

        <input
          accept=".csv"
          style={{ display: 'none' }}
          id="sleep-file-upload"
          type="file"
          onChange={(e) => handleFileUpload(e, 'sleep')}
        />
        <label htmlFor="sleep-file-upload">
          <Button variant="outlined" component="span" size="small">
            Upload Sleep CSV
          </Button>
        </label>
      </Box>
    </Box>
  </>
)}
```

**Step 2: Add file upload handler**

Add this function in `DataSourcesPage.jsx`:

```javascript
const handleFileUpload = async (event, dataType) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_URL}/api/garmin-dump/${dataType}`, {
      method: 'POST',
      headers: {
        'x-auth-token': token
      },
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      setSuccess(data.message);
    } else {
      const error = await response.json();
      setError(error.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    setError('Failed to upload file');
  }

  // Clear file input
  event.target.value = '';
};
```

**Step 3: Manual test**

1. Start dev server: `npm run dev`
2. Navigate to Data Sources page
3. Connect Garmin (or use existing connection)
4. Click "Upload Steps CSV"
5. Select a valid CSV file
6. Verify success message appears

**Step 4: Commit**

```bash
git add client/src/pages/DataSourcesPage.jsx
git commit -m "feat: add Garmin data dump upload UI"
```

---

### CHECKPOINT: Part 4.5 Complete

**Manual Testing Checklist:**
- [ ] Can upload steps CSV and see success message
- [ ] Can upload heart rate CSV and see success message
- [ ] Can upload sleep CSV and see success message
- [ ] Data appears in database tables
- [ ] Invalid file types are rejected
- [ ] Missing auth token returns 401

**Push to production:**
```bash
git push origin main
```

---

## Part 5: Day in the Life Feature

**Goal:** Generate "Day in the Life" timeline pages showing integrated view of check-ins, activities, photos, and daily metrics for any single day.

**Architecture:**
- Backend endpoint aggregates all data for a given date
- Frontend route displays timeline with maps, photos, and stats
- Weather data enrichment from Open-Meteo API
- Static map generation via Mapbox Static API

**Tech Stack:**
- Open-Meteo API (weather)
- Mapbox Static API (activity maps)
- React Timeline component
- Existing models (checkins, activities, daily metrics)

---

### Task 5.1: Create Weather Service

**Files:**
- Create: `server/services/openMeteo.js`
- Test: `server/services/openMeteo.test.js`

**Step 1: Write failing test**

Create `server/services/openMeteo.test.js`:

```javascript
const openMeteo = require('./openMeteo');
const axios = require('axios');

jest.mock('axios');

describe('OpenMeteoService', () => {
  it('should fetch historical weather', async () => {
    axios.get.mockResolvedValue({
      data: {
        daily: {
          temperature_2m_max: [18.5],
          temperature_2m_min: [12.3],
          weathercode: [2]
        }
      }
    });

    const result = await openMeteo.getHistoricalWeather(51.5074, -0.1278, new Date('2024-01-15'));

    expect(result).toEqual({
      temp_max: 18.5,
      temp_min: 12.3,
      temp_avg: 15.4,
      weather_code: 2,
      condition: 'partly_cloudy'
    });

    expect(axios.get).toHaveBeenCalledWith(
      'https://archive-api.open-meteo.com/v1/archive',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 51.5074,
          longitude: -0.1278,
          start_date: '2024-01-15',
          end_date: '2024-01-15'
        })
      })
    );
  });

  it('should convert weather code to condition', () => {
    expect(openMeteo.weatherCodeToCondition(0)).toBe('clear');
    expect(openMeteo.weatherCodeToCondition(2)).toBe('partly_cloudy');
    expect(openMeteo.weatherCodeToCondition(61)).toBe('rainy');
  });

  it('should get icon for condition', () => {
    expect(openMeteo.conditionToIcon('clear')).toBe('☀️');
    expect(openMeteo.conditionToIcon('rainy')).toBe('🌧');
  });
});
```

**Step 2: Run test**

```bash
npm test -- openMeteo.test.js
```

Expected: FAIL - Module not found

**Step 3: Implement service**

Create `server/services/openMeteo.js`:

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

**Step 4: Run test**

```bash
npm test -- openMeteo.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/services/openMeteo.js server/services/openMeteo.test.js
git commit -m "feat: add Open-Meteo weather service"
```

---

### Task 5.2: Create Day in Life Data Aggregation Service

**Files:**
- Create: `server/services/dayInLife.js`
- Test: `server/services/dayInLife.test.js`

**Step 1: Write failing test**

Create `server/services/dayInLife.test.js`:

```javascript
const dayInLife = require('./dayInLife');
const Checkin = require('../models/checkin');
const GarminActivity = require('../models/garminActivity');
const StravaActivity = require('../models/stravaActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const openMeteo = require('./openMeteo');

jest.mock('../models/checkin');
jest.mock('../models/garminActivity');
jest.mock('../models/stravaActivity');
jest.mock('../models/garminDailySteps');
jest.mock('./openMeteo');

describe('DayInLifeService', () => {
  it('should aggregate all data for a single day', async () => {
    const userId = 1;
    const date = '2024-01-15';

    // Mock data
    Checkin.find.mockResolvedValue({
      data: [
        { id: 1, venue_name: 'Coffee Shop', checkin_date: '2024-01-15T08:00:00Z', latitude: 51.5, longitude: -0.1 }
      ]
    });

    GarminActivity.findByUserAndDateRange.mockResolvedValue([
      { id: 1, activity_name: 'Morning Run', start_time: '2024-01-15T06:00:00Z' }
    ]);

    StravaActivity.findByUserAndDateRange.mockResolvedValue([
      { id: 1, name: 'Bike Commute', start_date: '2024-01-15T18:00:00Z' }
    ]);

    GarminDailySteps.findByUserAndDate.mockResolvedValue({ step_count: 12543 });

    openMeteo.getHistoricalWeather.mockResolvedValue({
      temp_avg: 15.4,
      condition: 'partly_cloudy'
    });

    const result = await dayInLife.aggregateDay(userId, date);

    expect(result).toMatchObject({
      date: '2024-01-15',
      checkins: expect.arrayContaining([
        expect.objectContaining({ venue_name: 'Coffee Shop' })
      ]),
      garmin_activities: expect.any(Array),
      strava_activities: expect.any(Array),
      daily_metrics: expect.objectContaining({
        steps: 12543
      }),
      weather: expect.objectContaining({
        temp_avg: 15.4,
        condition: 'partly_cloudy'
      })
    });
  });
});
```

**Step 2: Run test**

```bash
npm test -- dayInLife.test.js
```

Expected: FAIL - Module not found

**Step 3: Implement service**

Create `server/services/dayInLife.js`:

```javascript
const Checkin = require('../models/checkin');
const GarminActivity = require('../models/garminActivity');
const StravaActivity = require('../models/stravaActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const openMeteo = require('./openMeteo');

class DayInLifeService {
  /**
   * Aggregate all data for a single day
   * @param {number} userId
   * @param {string} date - YYYY-MM-DD
   */
  async aggregateDay(userId, date) {
    const startDate = new Date(date + 'T00:00:00Z');
    const endDate = new Date(date + 'T23:59:59Z');

    // Fetch all data in parallel
    const [
      checkinsResult,
      garminActivities,
      stravaActivities,
      steps,
      heartRate,
      sleep
    ] = await Promise.all([
      Checkin.find({
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }),
      GarminActivity.findByUserAndDateRange(userId, startDate, endDate),
      StravaActivity.findByUserAndDateRange(userId, startDate, endDate),
      GarminDailySteps.findByUserAndDate(userId, date),
      GarminDailyHeartRate.findByUserAndDate(userId, date),
      GarminDailySleep.findByUserAndDate(userId, date)
    ]);

    // Get weather based on first checkin location
    let weather = null;
    if (checkinsResult.data.length > 0) {
      const firstCheckin = checkinsResult.data[0];
      if (firstCheckin.latitude && firstCheckin.longitude) {
        weather = await openMeteo.getHistoricalWeather(
          firstCheckin.latitude,
          firstCheckin.longitude,
          startDate
        );
      }
    }

    return {
      date,
      checkins: checkinsResult.data,
      garmin_activities: garminActivities || [],
      strava_activities: stravaActivities || [],
      daily_metrics: {
        steps: steps?.step_count || null,
        resting_hr: heartRate?.resting_heart_rate || null,
        sleep_hours: sleep?.sleep_duration_seconds ? Math.round(sleep.sleep_duration_seconds / 3600) : null
      },
      weather: weather || null
    };
  }
}

module.exports = new DayInLifeService();
```

**Step 4: Run test**

```bash
npm test -- dayInLife.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/services/dayInLife.js server/services/dayInLife.test.js
git commit -m "feat: add day in life data aggregation service"
```

---

### Task 5.3: Create Day in Life API Endpoint

**Files:**
- Create: `server/routes/dayInLife.js`
- Modify: `server/server.js`

**Step 1: Create route**

Create `server/routes/dayInLife.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const dayInLife = require('../services/dayInLife');

/**
 * GET /api/day-in-life/:date
 * Get aggregated data for a single day
 */
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const data = await dayInLife.aggregateDay(req.user.id, date);
    res.json(data);
  } catch (error) {
    console.error('Day in life error:', error);
    res.status(500).json({ error: 'Failed to fetch day data' });
  }
});

module.exports = router;
```

**Step 2: Register route**

Modify `server/server.js`:

```javascript
// Day in Life
const dayInLifeRoutes = require('./routes/dayInLife');
app.use('/api/day-in-life', dayInLifeRoutes);
```

**Step 3: Manual test**

```bash
curl http://localhost:3001/api/day-in-life/2024-01-15 \
  -H "x-auth-token: YOUR_TOKEN"
```

Expected: JSON with aggregated day data

**Step 4: Commit**

```bash
git add server/routes/dayInLife.js server/server.js
git commit -m "feat: add day in life API endpoint"
```

---

### Task 5.4: Create Day in Life Frontend Page

**Files:**
- Create: `client/src/pages/DayInLifePage.jsx`
- Create: `client/src/components/DayTimeline.jsx`
- Modify: `client/src/App.js` (add route)

**Step 1: Create timeline component**

Create `client/src/components/DayTimeline.jsx`:

```javascript
import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Avatar } from '@mui/material';
import { Place, DirectionsRun, DirectionsBike, Favorite } from '@mui/icons-material';

function DayTimeline({ data }) {
  // Combine all events and sort by time
  const events = [
    ...data.checkins.map(c => ({
      type: 'checkin',
      time: new Date(c.checkin_date),
      data: c
    })),
    ...data.garmin_activities.map(a => ({
      type: 'garmin_activity',
      time: new Date(a.start_time),
      data: a
    })),
    ...data.strava_activities.map(a => ({
      type: 'strava_activity',
      time: new Date(a.start_date),
      data: a
    }))
  ].sort((a, b) => a.time - b.time);

  const getEventIcon = (type) => {
    switch (type) {
      case 'checkin': return <Place />;
      case 'garmin_activity': return <DirectionsRun />;
      case 'strava_activity': return <DirectionsBike />;
      default: return null;
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box sx={{ position: 'relative', pl: 4 }}>
      {/* Timeline line */}
      <Box
        sx={{
          position: 'absolute',
          left: 12,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: 'divider'
        }}
      />

      {/* Events */}
      {events.map((event, index) => (
        <Box key={index} sx={{ position: 'relative', mb: 3 }}>
          {/* Timeline dot */}
          <Avatar
            sx={{
              position: 'absolute',
              left: -37,
              width: 28,
              height: 28,
              bgcolor: 'primary.main'
            }}
          >
            {getEventIcon(event.type)}
          </Avatar>

          {/* Event card */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {formatTime(event.time)}
                  </Typography>
                  <Typography variant="h6">
                    {event.type === 'checkin' && event.data.venue_name}
                    {event.type === 'garmin_activity' && event.data.activity_name}
                    {event.type === 'strava_activity' && event.data.name}
                  </Typography>
                  {event.type === 'checkin' && (
                    <Typography variant="body2" color="text.secondary">
                      {event.data.city}, {event.data.country}
                    </Typography>
                  )}
                  {(event.type === 'garmin_activity' || event.type === 'strava_activity') && (
                    <Box display="flex" gap={1} mt={1}>
                      {event.data.distance_meters && (
                        <Chip
                          size="small"
                          label={`${(event.data.distance_meters / 1000).toFixed(1)} km`}
                        />
                      )}
                      {event.data.duration_seconds && (
                        <Chip
                          size="small"
                          label={`${Math.round(event.data.duration_seconds / 60)} min`}
                        />
                      )}
                    </Box>
                  )}
                </Box>
                <Chip
                  label={event.type.replace('_', ' ')}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
}

export default DayTimeline;
```

**Step 2: Create page component**

Create `client/src/pages/DayInLifePage.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, Paper, Grid, Card, CardContent, CircularProgress } from '@mui/material';
import Layout from '../components/Layout';
import DayTimeline from '../components/DayTimeline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DayInLifePage({ darkMode, onToggleDarkMode }) {
  const { date } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || localStorage.getItem('authToken');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDayData = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/day-in-life/${date}`, {
          headers: { 'x-auth-token': token }
        });
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch day data:', err);
        setError('Failed to load day data');
      } finally {
        setLoading(false);
      }
    };

    fetchDayData();
  }, [date, token]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} token={token}>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        {loading && <CircularProgress />}

        {error && <Typography color="error">{error}</Typography>}

        {data && (
          <>
            <Typography variant="h4" gutterBottom>
              {formatDate(date)}
            </Typography>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Steps
                    </Typography>
                    <Typography variant="h5">
                      {data.daily_metrics.steps?.toLocaleString() || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Check-ins
                    </Typography>
                    <Typography variant="h5">
                      {data.checkins.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Activities
                    </Typography>
                    <Typography variant="h5">
                      {data.garmin_activities.length + data.strava_activities.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      Weather
                    </Typography>
                    <Typography variant="h5">
                      {data.weather ? `${Math.round(data.weather.temp_avg)}°C` : 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Timeline */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <DayTimeline data={data} />
            </Paper>
          </>
        )}
      </Box>
    </Layout>
  );
}

export default DayInLifePage;
```

**Step 3: Add route to App.js**

Modify `client/src/App.js`:

```javascript
import DayInLifePage from './pages/DayInLifePage';

// In routes:
<Route path="/day/:date" element={<DayInLifePage darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />} />
```

**Step 4: Manual test**

1. Start dev server
2. Navigate to http://localhost:3000/day/2024-01-15?token=YOUR_TOKEN
3. Verify timeline shows check-ins and activities
4. Verify summary cards show metrics

**Step 5: Commit**

```bash
git add client/src/pages/DayInLifePage.jsx client/src/components/DayTimeline.jsx client/src/App.js
git commit -m "feat: add day in life frontend page with timeline"
```

---

### CHECKPOINT: Part 5 Complete

**Manual Testing Checklist:**
- [ ] Day page loads for valid date
- [ ] Timeline shows check-ins in chronological order
- [ ] Timeline shows activities (Garmin and Strava)
- [ ] Summary cards display correct metrics
- [ ] Weather displays if available
- [ ] Page handles dates with no data gracefully

**Push to production:**
```bash
git push origin main
```

---

## Implementation Complete!

All remaining features have been implemented:
- ✅ Garmin Data Dump import (CSV upload for daily metrics)
- ✅ Day in the Life feature (timeline view with weather)

**Next steps:**
- Test all features end-to-end
- Update user documentation
- Monitor production for issues
