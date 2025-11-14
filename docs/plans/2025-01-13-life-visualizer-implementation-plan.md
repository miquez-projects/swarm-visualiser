# Life Visualizer - Implementation Plan

**Date:** January 13, 2025
**Design Doc:** [2025-01-13-life-visualizer-design.md](./2025-01-13-life-visualizer-design.md)

## Overview

This document provides a detailed, step-by-step implementation plan for the Life Visualizer feature set. The plan is organized into distinct parts with testing checkpoints after each major component.

## Implementation Order

```
Part 0: Jest Setup
  ↓
Part 1: Splash Screen & Auth
  ↓
[TESTING CHECKPOINT #1]
  ↓
Part 2: Context Menu
  ↓
[TESTING CHECKPOINT #2]
  ↓
Part 3: Check-in Photos
  ↓
[TESTING CHECKPOINT #3]
  ↓
Part 4: Garmin Integration
  ↓
[TESTING CHECKPOINT #4]
  ↓
Part 5: Day in the Life
  ↓
[TESTING CHECKPOINT #5]
  ↓
COMPLETE
```

---

## Part 0: Jest Testing Setup

**Estimated Time:** 0.5 days

### Tasks

#### 1. Install Dependencies
```bash
cd /Users/gabormikes/swarm-visualizer
npm install --save-dev jest @types/jest supertest
```

#### 2. Create Jest Configuration

**File:** `jest.config.js`
```javascript
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/*.test.js',
    '!server/**/*.spec.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js']
};
```

#### 3. Create Test Setup File

**File:** `server/tests/setup.js`
```javascript
// Global test setup
// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
```

#### 4. Create Test Utilities

**File:** `server/tests/helpers.js`
```javascript
// Helper functions for tests
const request = require('supertest');

// Mock database query helper
const mockDb = () => {
  return {
    query: jest.fn()
  };
};

// Mock user with token
const mockUser = {
  id: 1,
  secret_token: 'test-token-123',
  display_name: 'Test User',
  foursquare_user_id: '12345'
};

module.exports = {
  mockDb,
  mockUser
};
```

#### 5. Add Test Script to package.json

**Update:** `package.json`
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### 6. Create Sample Test

**File:** `server/routes/auth.test.js`
```javascript
const request = require('supertest');
const { mockDb, mockUser } = require('../tests/helpers');

describe('Auth Routes', () => {
  test('should validate token successfully', async () => {
    // This will be expanded in Part 1
    expect(true).toBe(true);
  });
});
```

#### 7. Verify Setup
```bash
npm test
```

**Expected:** Tests pass (1 passing test from sample)

### Completion Criteria
- [ ] Jest installed and configured
- [ ] Test utilities created
- [ ] Sample test runs successfully
- [ ] Test script works: `npm test`

---

## Part 1: Splash Screen & Authentication

**Estimated Time:** 2-3 days

### Phase 1.1: Backend - Data Sources Page Support

#### Task 1.1.1: No backend changes needed
The existing `/api/auth/me` endpoint already returns user info with token.

**Verify existing endpoint:**
```bash
curl -H "x-auth-token: YOUR_TOKEN" http://localhost:3001/api/auth/me
```

### Phase 1.2: Frontend - Splash Screen Component

#### Task 1.2.1: Create SplashScreen Component

**File:** `client/src/components/SplashScreen.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const SplashScreen = ({ onTokenValidated }) => {
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for token in URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const storedToken = localStorage.getItem('authToken');

    if (urlToken || storedToken) {
      // Token exists - show for 2 seconds then fade
      setTimeout(() => setFadeOut(true), 2000);
      setTimeout(() => onTokenValidated(urlToken || storedToken), 2300);
    } else {
      // No token - show input after 1 second
      setTimeout(() => setShowTokenInput(true), 1000);
    }
  }, [onTokenValidated]);

  const handleTokenSubmit = () => {
    if (token) {
      localStorage.setItem('authToken', token);
      onTokenValidated(token);
    }
  };

  const handleSetupNewUser = () => {
    navigate('/data-sources');
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: 'gradient-shift 3s ease infinite'
      }}
    >
      <Typography variant="h2" sx={{ color: 'white', mb: 4, fontWeight: 'bold' }}>
        Swarm Visualizer
      </Typography>

      {showTokenInput && (
        <Box sx={{ width: 400, maxWidth: '90%' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Enter your token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTokenSubmit()}
            autoFocus
            sx={{
              bgcolor: 'white',
              borderRadius: 1,
              mb: 2,
              '& input': {
                cursor: 'text',
                animation: 'blink 1s step-end infinite'
              }
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleTokenSubmit}
            sx={{ mb: 1, bgcolor: 'white', color: '#ff6b35' }}
          >
            Continue
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={handleSetupNewUser}
            sx={{ color: 'white' }}
          >
            Set up a new user
          </Button>
        </Box>
      )}

      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(10deg); }
        }
        @keyframes blink {
          50% { border-color: transparent; }
        }
      `}</style>
    </Box>
  );
};

export default SplashScreen;
```

#### Task 1.2.2: Create Data Sources Page

**File:** `client/src/pages/DataSourcesPage.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Snackbar
} from '@mui/material';
import { ContentCopy, CheckCircle } from '@mui/icons-material';
import Layout from '../components/Layout';

const DataSourcesPage = ({ darkMode, onToggleDarkMode }) => {
  const [searchParams] = useSearchParams();
  const [token] = useState(
    searchParams.get('token') || localStorage.getItem('authToken')
  );
  const [copied, setCopied] = useState(false);

  const tokenUrl = `${window.location.origin}/?token=${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenUrl);
    setCopied(true);
  };

  return (
    <Layout darkMode={darkMode} onToggleDarkMode={onToggleDarkMode}>
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Data Sources
        </Typography>

        {/* Token Display */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Your Access Token
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Save this URL to access your data:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
              mt: 2
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                flex: 1,
                wordBreak: 'break-all'
              }}
            >
              {tokenUrl}
            </Typography>
            <IconButton onClick={handleCopy} size="small">
              <ContentCopy />
            </IconButton>
          </Box>
        </Paper>

        {/* Data Sources */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Connected Data Sources
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="Foursquare / Swarm"
                secondary="Connected - Sync check-ins and photos"
              />
              <CheckCircle color="success" />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Garmin"
                secondary="Not connected"
              />
              <Button variant="outlined" disabled>
                Connect (Coming Soon)
              </Button>
            </ListItem>
          </List>
        </Paper>

        <Snackbar
          open={copied}
          autoHideDuration={2000}
          onClose={() => setCopied(false)}
          message="URL copied to clipboard!"
        />
      </Box>
    </Layout>
  );
};

export default DataSourcesPage;
```

#### Task 1.2.3: Update App.js to Include Splash Screen

**File:** `client/src/App.js`
```jsx
// Add to existing imports
import SplashScreen from './components/SplashScreen';
import DataSourcesPage from './pages/DataSourcesPage';

// Add state for splash screen
const [showSplash, setShowSplash] = useState(true);

const handleTokenValidated = (token) => {
  if (token) {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
  }
  setShowSplash(false);
};

// In return statement, wrap everything:
return (
  <>
    {showSplash && <SplashScreen onTokenValidated={handleTokenValidated} />}
    <BrowserRouter>
      {/* existing ThemeProvider and Routes */}
      <Routes>
        {/* existing routes */}
        <Route path="/data-sources" element={<DataSourcesPage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
      </Routes>
    </BrowserRouter>
  </>
);
```

### Phase 1.3: Testing

#### Task 1.3.1: Write Automated Tests

**File:** `server/routes/auth.test.js`
```javascript
const request = require('supertest');
const app = require('../app'); // Adjust path as needed
const { mockDb, mockUser } = require('../tests/helpers');

jest.mock('../db/connection');
const db = require('../db/connection');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/me', () => {
    test('returns user info with valid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('displayName');
    });

    test('returns 401 with invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
    });

    test('returns 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
```

#### Task 1.3.2: Run Tests
```bash
npm test
```

**Expected:** All tests pass

### 🔴 TESTING CHECKPOINT #1

Run all automated and manual tests from the design document's "Part 1 Testing Checkpoint" section.

**Automated Tests:**
```bash
npm test -- auth.test.js
```

**Manual Tests:**
1. Visit app without token → See splash screen → Token input appears after 1s
2. Visit app with token in URL → See splash for 2s → Auto-redirect to main app
3. Enter token manually → Validate → Main app loads
4. Click "Set up new user" → Navigate to Data Sources page
5. Data Sources page shows token with copy button
6. Copy button works
7. Visual: Orange gradient looks good, subtle animation present
8. Test on mobile device

**Sign-off:** ✅ All Part 1 tests passing before proceeding to Part 2

---

## Part 2: Context Menu & Navigation

**Estimated Time:** 1-1.5 days

### Phase 2.1: Backend - Sync All Endpoint

#### Task 2.1.1: Create Sync Service

**File:** `server/services/syncAll.js`
```javascript
const User = require('../models/user');
const { syncUserCheckins } = require('./foursquareSync');

async function syncAllDataSources(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const results = {
    foursquare: null,
    garmin: null // Will be implemented in Part 4
  };

  // Sync Foursquare
  try {
    results.foursquare = await syncUserCheckins(userId);
  } catch (error) {
    results.foursquare = { error: error.message };
  }

  // TODO: Sync Garmin (Part 4)

  return results;
}

module.exports = { syncAllDataSources };
```

#### Task 2.1.2: Create Sync Routes

**File:** `server/routes/sync.js`
```javascript
const express = require('express');
const router = express.Router();
const { syncAllDataSources } = require('../services/syncAll');
const User = require('../models/user');

// POST /api/sync/all
router.post('/all', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const results = await syncAllDataSources(user.id);

    // Update last sync timestamp
    await User.updateLastSync(user.id);

    res.json({
      success: true,
      results,
      lastSyncAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync all error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

module.exports = router;
```

#### Task 2.1.3: Register Sync Routes

**File:** `server/app.js` or `server/index.js`
```javascript
// Add with other route imports
const syncRoutes = require('./routes/sync');

// Register routes
app.use('/api/sync', syncRoutes);
```

### Phase 2.2: Frontend - Context Menu

#### Task 2.2.1: Create Context Menu Component

**File:** `client/src/components/ContextMenu.jsx`
```jsx
import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import { Menu as MenuIcon, Sync, Settings } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { syncAllData } from '../services/api';

const ContextMenu = ({ token, lastSyncAt, onSyncComplete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSyncAll = async () => {
    handleClose();
    setSyncing(true);
    try {
      await syncAllData(token);
      onSyncComplete?.();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDataSources = () => {
    handleClose();
    navigate('/data-sources');
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} disabled={syncing}>
        {syncing ? <CircularProgress size={24} color="inherit" /> : <MenuIcon />}
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleSyncAll}>
          <ListItemIcon>
            <Sync fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sync All Data" />
        </MenuItem>

        <MenuItem onClick={handleDataSources}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Data Sources" />
        </MenuItem>

        <Divider />

        <MenuItem disabled>
          <ListItemText
            secondary={
              lastSyncAt
                ? `Last synced: ${new Date(lastSyncAt).toLocaleString()}`
                : 'Never synced'
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ContextMenu;
```

#### Task 2.2.2: Add Sync API Function

**File:** `client/src/services/api.js`
```javascript
// Add to existing exports
export const syncAllData = async (token) => {
  const response = await fetch(`${API_URL}/api/sync/all`, {
    method: 'POST',
    headers: {
      'x-auth-token': token
    }
  });

  if (!response.ok) {
    throw new Error('Sync failed');
  }

  return response.json();
};
```

#### Task 2.2.3: Update Layout Component

**File:** `client/src/components/Layout.jsx`
```jsx
// Add to imports
import ContextMenu from './ContextMenu';

// Add to Layout component (before dark mode toggle)
<ContextMenu
  token={token}
  lastSyncAt={lastSyncAt}
  onSyncComplete={() => {/* refresh data */}}
/>
```

### Phase 2.3: Testing

#### Task 2.3.1: Write Automated Tests

**File:** `server/routes/sync.test.js`
```javascript
const request = require('supertest');
const app = require('../app');
const { mockDb, mockUser } = require('../tests/helpers');
const { syncAllDataSources } = require('../services/syncAll');

jest.mock('../services/syncAll');
jest.mock('../db/connection');

describe('Sync Routes', () => {
  test('POST /api/sync/all returns sync results', async () => {
    syncAllDataSources.mockResolvedValueOnce({
      foursquare: { newCheckins: 5 },
      garmin: null
    });

    const response = await request(app)
      .post('/api/sync/all')
      .set('x-auth-token', 'test-token-123');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toBeDefined();
  });

  test('POST /api/sync/all requires authentication', async () => {
    const response = await request(app).post('/api/sync/all');

    expect(response.status).toBe(401);
  });
});
```

#### Task 2.3.2: Run Tests
```bash
npm test
```

### 🔴 TESTING CHECKPOINT #2

**Automated Tests:**
```bash
npm test -- sync.test.js
```

**Manual Tests:**
1. Context menu icon appears in top nav (burger icon)
2. Click menu → Opens correctly
3. Click "Sync All Data" → Loading spinner appears → Success
4. "Last synced" timestamp updates after sync
5. Click "Data Sources" → Navigates to Data Sources page
6. Primary navigation buttons still visible and working
7. Test on mobile → Burger menu behavior correct
8. Dark mode toggle still works

**Sign-off:** ✅ All Part 2 tests passing before proceeding to Part 3

---

## Part 3: Check-in Photos

**Estimated Time:** 2-3 days

### Phase 3.1: Database Migration

#### Task 3.1.1: Create Migration File

**File:** `migrations/004_add_checkin_photos.sql`
```sql
-- Add checkin_photos table
CREATE TABLE IF NOT EXISTS checkin_photos (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER REFERENCES checkins(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_url_cached TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_checkin_photos_checkin_id ON checkin_photos(checkin_id);

-- Add migration tracking
INSERT INTO schema_migrations (version, name)
VALUES (4, '004_add_checkin_photos');
```

#### Task 3.1.2: Run Migration
```bash
node server/db/run-migration.js migrations/004_add_checkin_photos.sql
```

### Phase 3.2: Backend - Photo Import

#### Task 3.2.1: Update Foursquare Service

**File:** `server/services/foursquare.js`
```javascript
// Update transformCheckin function to include photos
function transformCheckin(checkin, userId) {
  const venue = checkin.venue;
  const location = venue.location;

  // Extract photos
  const photos = checkin.photos?.items || [];
  const photoUrls = photos.map(photo => ({
    url: `${photo.prefix}original${photo.suffix}`,
    width: photo.width,
    height: photo.height
  }));

  return {
    user_id: userId,
    venue_id: venue.id,
    venue_name: venue.name,
    venue_category: venue.categories?.[0]?.name || null,
    latitude: location.lat,
    longitude: location.lng,
    checkin_date: new Date(checkin.createdAt * 1000),
    city: location.city || null,
    country: location.country || null,
    photos: photoUrls // Add photos array
  };
}
```

#### Task 3.2.2: Create Photo Model

**File:** `server/models/checkinPhoto.js`
```javascript
const db = require('../db/connection');

class CheckinPhoto {
  static async create(photoData) {
    const query = `
      INSERT INTO checkin_photos (checkin_id, photo_url, width, height)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      photoData.checkin_id,
      photoData.photo_url,
      photoData.width,
      photoData.height
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByCheckinId(checkinId) {
    const query = 'SELECT * FROM checkin_photos WHERE checkin_id = $1 ORDER BY id';
    const result = await db.query(query, [checkinId]);
    return result.rows;
  }

  static async findByVenueId(venueId, userId) {
    const query = `
      SELECT cp.*, c.checkin_date
      FROM checkin_photos cp
      JOIN checkins c ON cp.checkin_id = c.id
      WHERE c.venue_id = $1 AND c.user_id = $2
      ORDER BY c.checkin_date DESC, cp.id
    `;
    const result = await db.query(query, [venueId, userId]);
    return result.rows;
  }

  static async updateCachedUrl(id, cachedUrl) {
    const query = `
      UPDATE checkin_photos
      SET photo_url_cached = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [cachedUrl, id]);
    return result.rows[0];
  }
}

module.exports = CheckinPhoto;
```

#### Task 3.2.3: Update Sync to Import Photos

**File:** `server/services/foursquareSync.js` (update existing)
```javascript
const CheckinPhoto = require('../models/checkinPhoto');

// In the sync function, after creating checkin:
if (transformedCheckin.photos && transformedCheckin.photos.length > 0) {
  for (const photo of transformedCheckin.photos) {
    await CheckinPhoto.create({
      checkin_id: newCheckin.id,
      photo_url: photo.url,
      width: photo.width,
      height: photo.height
    });
  }
}
```

#### Task 3.2.4: Create Photos Endpoint

**File:** `server/routes/venues.js` (create new or update existing)
```javascript
const express = require('express');
const router = express.Router();
const CheckinPhoto = require('../models/checkinPhoto');
const User = require('../models/user');

// GET /api/venues/:venueId/photos
router.get('/:venueId/photos', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const photos = await CheckinPhoto.findByVenueId(
      req.params.venueId,
      user.id
    );

    // Group photos by check-in date
    const groupedPhotos = photos.reduce((acc, photo) => {
      const dateKey = photo.checkin_date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: photo.checkin_date,
          photos: []
        };
      }
      acc[dateKey].photos.push({
        id: photo.id,
        url: photo.photo_url_cached || photo.photo_url,
        width: photo.width,
        height: photo.height
      });
      return acc;
    }, {});

    res.json(Object.values(groupedPhotos));
  } catch (error) {
    console.error('Get venue photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

module.exports = router;
```

#### Task 3.2.5: Register Venue Routes

**File:** `server/app.js` or `server/index.js`
```javascript
const venueRoutes = require('./routes/venues');
app.use('/api/venues', venueRoutes);
```

### Phase 3.3: Frontend - Photo Gallery

#### Task 3.3.1: Install Lightbox Library
```bash
cd client
npm install yet-another-react-lightbox
```

#### Task 3.3.2: Create Venue Photos Gallery Component

**File:** `client/src/components/VenuePhotosGallery.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, CircularProgress } from '@mui/material';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { getVenuePhotos } from '../services/api';

const VenuePhotosGallery = ({ venueId, token }) => {
  const [photoGroups, setPhotoGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    loadPhotos();
  }, [venueId]);

  const loadPhotos = async () => {
    try {
      const data = await getVenuePhotos(venueId, token);
      setPhotoGroups(data);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const allPhotos = photoGroups.flatMap(g => g.photos);

  const handlePhotoClick = (groupIndex, photoIndex) => {
    const globalIndex = photoGroups
      .slice(0, groupIndex)
      .reduce((sum, g) => sum + g.photos.length, 0) + photoIndex;
    setLightboxIndex(globalIndex);
    setLightboxOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (photoGroups.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No photos for this venue
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {photoGroups.map((group, groupIdx) => (
        <Box key={groupIdx} sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            {new Date(group.date).toLocaleString()}
          </Typography>
          <Grid container spacing={2}>
            {group.photos.map((photo, photoIdx) => (
              <Grid item xs={6} sm={4} md={3} key={photo.id}>
                <Box
                  component="img"
                  src={photo.url}
                  alt="Check-in photo"
                  onClick={() => handlePhotoClick(groupIdx, photoIdx)}
                  sx={{
                    width: '100%',
                    height: 150,
                    objectFit: 'cover',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 }
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={allPhotos.map(p => ({ src: p.url }))}
      />
    </Box>
  );
};

export default VenuePhotosGallery;
```

#### Task 3.3.3: Add API Function

**File:** `client/src/services/api.js`
```javascript
export const getVenuePhotos = async (venueId, token) => {
  const response = await fetch(
    `${API_URL}/api/venues/${venueId}/photos?token=${token}`
  );
  if (!response.ok) throw new Error('Failed to get photos');
  return response.json();
};
```

#### Task 3.3.4: Update MapView to Add Photos Tab

**File:** `client/src/components/MapView.jsx`
```jsx
// Add imports
import { Tabs, Tab } from '@mui/material';
import VenuePhotosGallery from './VenuePhotosGallery';

// Add state for active tab
const [activeTab, setActiveTab] = useState(0);

// Update the venue popup modal to include tabs
<Modal open={showCheckinGrid && selectedVenue !== null} ...>
  <Box ...>
    <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
      <Tab label="Check-ins" />
      <Tab label="Photos" />
    </Tabs>

    {activeTab === 0 && (
      // Existing check-in grid component
    )}

    {activeTab === 1 && (
      <VenuePhotosGallery
        venueId={selectedVenue.venue_id}
        token={token}
      />
    )}
  </Box>
</Modal>
```

### Phase 3.4: Testing

#### Task 3.4.1: Write Automated Tests

**File:** `server/services/foursquare.test.js`
```javascript
const { transformCheckin } = require('../services/foursquare');

describe('Foursquare Service', () => {
  test('extracts photos from checkin response', () => {
    const mockCheckin = {
      venue: {
        id: 'venue123',
        name: 'Test Venue',
        location: { lat: 40.7, lng: -74.0 },
        categories: [{ name: 'Restaurant' }]
      },
      createdAt: 1640000000,
      photos: {
        items: [
          {
            prefix: 'https://example.com/',
            suffix: '/photo1.jpg',
            width: 800,
            height: 600
          }
        ]
      }
    };

    const result = transformCheckin(mockCheckin, 1);

    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].url).toContain('photo1.jpg');
    expect(result.photos[0].width).toBe(800);
  });

  test('handles checkins without photos', () => {
    const mockCheckin = {
      venue: {
        id: 'venue123',
        name: 'Test Venue',
        location: { lat: 40.7, lng: -74.0 }
      },
      createdAt: 1640000000
    };

    const result = transformCheckin(mockCheckin, 1);

    expect(result.photos).toEqual([]);
  });
});
```

**File:** `server/routes/venues.test.js`
```javascript
const request = require('supertest');
const app = require('../app');
const CheckinPhoto = require('../models/checkinPhoto');

jest.mock('../models/checkinPhoto');

describe('Venue Routes', () => {
  test('GET /api/venues/:id/photos returns grouped photos', async () => {
    CheckinPhoto.findByVenueId.mockResolvedValueOnce([
      {
        id: 1,
        photo_url: 'https://example.com/photo1.jpg',
        checkin_date: new Date('2024-01-15')
      },
      {
        id: 2,
        photo_url: 'https://example.com/photo2.jpg',
        checkin_date: new Date('2024-01-15')
      }
    ]);

    const response = await request(app)
      .get('/api/venues/venue123/photos')
      .set('x-auth-token', 'test-token-123');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1); // One date group
    expect(response.body[0].photos).toHaveLength(2);
  });
});
```

#### Task 3.4.2: Run Tests
```bash
npm test
```

### 🔴 TESTING CHECKPOINT #3

**Automated Tests:**
```bash
npm test -- foursquare.test.js venues.test.js
```

**Manual Tests:**
1. Run sync to import photos from existing check-ins
2. Open venue details modal
3. See "Check-ins" and "Photos" tabs
4. Click Photos tab → Photos display grouped by date
5. Photos show in responsive grid (3-4 on desktop, 2 on mobile)
6. Click a photo → Lightbox opens
7. Navigate through photos in lightbox
8. Close lightbox
9. Venue with no photos shows "No photos" message
10. Verify `photo_url_cached` populates (check database after viewing photos)

**Sign-off:** ✅ All Part 3 tests passing before proceeding to Part 4

---

## Part 4: Garmin Integration

**Estimated Time:** 5-6 days

### Phase 4.1: Database Migrations

#### Task 4.1.1: Create Garmin Tables Migration

**File:** `migrations/005_add_garmin_tables.sql`
```sql
-- Garmin Activities
CREATE TABLE IF NOT EXISTS garmin_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  garmin_activity_id VARCHAR(255) UNIQUE NOT NULL,
  activity_type VARCHAR(100),
  activity_name TEXT,
  start_time TIMESTAMP NOT NULL,
  duration_seconds INTEGER,
  distance_meters DECIMAL(10, 2),
  calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  tracklog GEOGRAPHY(LINESTRING, 4326),
  garmin_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_garmin_activities_user_id ON garmin_activities(user_id);
CREATE INDEX idx_garmin_activities_start_time ON garmin_activities(start_time);
CREATE INDEX idx_garmin_activities_tracklog ON garmin_activities USING GIST(tracklog);

-- Garmin Daily Steps
CREATE TABLE IF NOT EXISTS garmin_daily_steps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  step_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_garmin_daily_steps_user_date ON garmin_daily_steps(user_id, date);

-- Garmin Daily Heart Rate
CREATE TABLE IF NOT EXISTS garmin_daily_heart_rate (
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

-- Garmin Daily Sleep
CREATE TABLE IF NOT EXISTS garmin_daily_sleep (
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

INSERT INTO schema_migrations (version, name)
VALUES (5, '005_add_garmin_tables');
```

#### Task 4.1.2: Create Garmin Auth Migration

**File:** `migrations/006_add_garmin_auth.sql`
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_session_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_connected_at TIMESTAMP;

INSERT INTO schema_migrations (version, name)
VALUES (6, '006_add_garmin_auth');
```

#### Task 4.1.3: Run Migrations
```bash
node server/db/run-migration.js migrations/005_add_garmin_tables.sql
node server/db/run-migration.js migrations/006_add_garmin_auth.sql
```

### Phase 4.2: Backend - Garmin Service

#### Task 4.2.1: Install Garmin Library
```bash
npm install garmin-connect
```

#### Task 4.2.2: Create Garmin Authentication Service

**File:** `server/services/garminAuth.js`
```javascript
const { GarminConnect } = require('garmin-connect');
const { encrypt, decrypt } = require('./encryption');

class GarminAuthService {
  async authenticate(username, password) {
    const client = new GarminConnect({
      username,
      password
    });

    await client.login();

    // Export session tokens
    const sessionData = await client.exportToken();

    return {
      encrypted: encrypt(JSON.stringify(sessionData)),
      client
    };
  }

  async getClient(encryptedToken) {
    const sessionData = JSON.parse(decrypt(encryptedToken));

    const client = new GarminConnect();
    await client.restoreOrLogin(undefined, sessionData);

    return client;
  }
}

module.exports = new GarminAuthService();
```

#### Task 4.2.3: Create Garmin Models

**File:** `server/models/garminActivity.js`
```javascript
const db = require('../db/connection');

class GarminActivity {
  static async create(activityData) {
    const query = `
      INSERT INTO garmin_activities (
        user_id, garmin_activity_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, calories,
        avg_heart_rate, max_heart_rate, tracklog, garmin_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (garmin_activity_id) DO UPDATE SET
        activity_name = EXCLUDED.activity_name,
        duration_seconds = EXCLUDED.duration_seconds,
        distance_meters = EXCLUDED.distance_meters,
        calories = EXCLUDED.calories
      RETURNING *
    `;

    const values = [
      activityData.user_id,
      activityData.garmin_activity_id,
      activityData.activity_type,
      activityData.activity_name,
      activityData.start_time,
      activityData.duration_seconds,
      activityData.distance_meters,
      activityData.calories,
      activityData.avg_heart_rate,
      activityData.max_heart_rate,
      activityData.tracklog, // PostGIS LineString
      activityData.garmin_url
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_activities
      WHERE user_id = $1
        AND start_time >= $2
        AND start_time < $3
      ORDER BY start_time ASC
    `;
    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }

  static async findLastSyncDate(userId) {
    const query = `
      SELECT MAX(start_time) as last_sync
      FROM garmin_activities
      WHERE user_id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0]?.last_sync;
  }
}

module.exports = GarminActivity;
```

**File:** `server/models/garminDailySteps.js`
```javascript
const db = require('../db/connection');

class GarminDailySteps {
  static async upsert(stepsData) {
    const query = `
      INSERT INTO garmin_daily_steps (user_id, date, step_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date) DO UPDATE SET
        step_count = EXCLUDED.step_count
      RETURNING *
    `;
    const values = [stepsData.user_id, stepsData.date, stepsData.step_count];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserAndDate(userId, date) {
    const query = `
      SELECT * FROM garmin_daily_steps
      WHERE user_id = $1 AND date = $2
    `;
    const result = await db.query(query, [userId, date]);
    return result.rows[0];
  }
}

module.exports = GarminDailySteps;
```

Create similar models for `garminDailyHeartRate.js` and `garminDailySleep.js`.

#### Task 4.2.4: Create Garmin Sync Service

**File:** `server/services/garminSync.js`
```javascript
const garminAuth = require('./garminAuth');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

class GarminSyncService {
  async syncActivities(client, userId, startDate, limit = 100) {
    let start = 0;
    let hasMore = true;
    let totalImported = 0;

    while (hasMore && start < limit) {
      const activities = await client.getActivities(start, 50);

      if (activities.length === 0) {
        hasMore = false;
        break;
      }

      for (const activity of activities) {
        // Filter by date if provided
        const activityDate = new Date(activity.startTimeGMT);
        if (startDate && activityDate < startDate) {
          hasMore = false;
          break;
        }

        // Transform and save activity
        const activityData = this.transformActivity(activity, userId);
        await GarminActivity.create(activityData);
        totalImported++;
      }

      start += activities.length;
    }

    return { imported: totalImported };
  }

  async syncDailyMetrics(client, userId, date) {
    const dateStr = date.toISOString().split('T')[0];

    // Sync steps
    try {
      const stepsData = await client.getSteps(date);
      if (stepsData) {
        await GarminDailySteps.upsert({
          user_id: userId,
          date: dateStr,
          step_count: stepsData.totalSteps || 0
        });
      }
    } catch (err) {
      console.error(`Failed to sync steps for ${dateStr}:`, err.message);
    }

    // Sync heart rate
    try {
      const hrData = await client.getHeartRate(date);
      if (hrData) {
        await GarminDailyHeartRate.upsert({
          user_id: userId,
          date: dateStr,
          min_heart_rate: hrData.minHeartRate,
          max_heart_rate: hrData.maxHeartRate,
          resting_heart_rate: hrData.restingHeartRate
        });
      }
    } catch (err) {
      console.error(`Failed to sync heart rate for ${dateStr}:`, err.message);
    }

    // Sync sleep
    try {
      const sleepData = await client.getSleepData(dateStr);
      if (sleepData) {
        await GarminDailySleep.upsert({
          user_id: userId,
          date: dateStr,
          sleep_duration_seconds: sleepData.sleepTimeSeconds,
          sleep_score: sleepData.sleepScores?.overall?.value,
          deep_sleep_seconds: sleepData.deepSleepSeconds,
          light_sleep_seconds: sleepData.lightSleepSeconds,
          rem_sleep_seconds: sleepData.remSleepSeconds,
          awake_seconds: sleepData.awakeSleepSeconds
        });
      }
    } catch (err) {
      console.error(`Failed to sync sleep for ${dateStr}:`, err.message);
    }
  }

  transformActivity(activity, userId) {
    // Transform tracklog if exists
    let tracklog = null;
    if (activity.geo?.geoPoints && activity.geo.geoPoints.length > 0) {
      const lineString = activity.geo.geoPoints
        .map(p => `${p.lon} ${p.lat}`)
        .join(',');
      tracklog = `LINESTRING(${lineString})`;
    }

    return {
      user_id: userId,
      garmin_activity_id: String(activity.activityId),
      activity_type: activity.activityType?.typeKey,
      activity_name: activity.activityName,
      start_time: new Date(activity.startTimeGMT),
      duration_seconds: activity.duration,
      distance_meters: activity.distance,
      calories: activity.calories,
      avg_heart_rate: activity.averageHR,
      max_heart_rate: activity.maxHR,
      tracklog,
      garmin_url: `https://connect.garmin.com/modern/activity/${activity.activityId}`
    };
  }

  async fullHistoricalSync(client, userId, yearsBack = 5) {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);

    // Sync activities
    console.log('Syncing activities...');
    await this.syncActivities(client, userId, startDate, 1000);

    // Sync daily metrics (day by day going backwards)
    console.log('Syncing daily metrics...');
    let currentDate = new Date(today);
    while (currentDate >= startDate) {
      await this.syncDailyMetrics(client, userId, currentDate);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return { success: true };
  }

  async incrementalSync(client, userId) {
    // Get last sync date from activities
    const lastActivityDate = await GarminActivity.findLastSyncDate(userId);
    const startDate = lastActivityDate ? new Date(lastActivityDate) : new Date();
    startDate.setDate(startDate.getDate() - 7); // Go back 7 days to catch any missed

    // Sync activities
    await this.syncActivities(client, userId, startDate, 100);

    // Sync daily metrics for last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      await this.syncDailyMetrics(client, userId, date);
    }

    return { success: true };
  }
}

module.exports = new GarminSyncService();
```

#### Task 4.2.5: Create Garmin Routes

**File:** `server/routes/garmin.js`
```javascript
const express = require('express');
const router = express.Router();
const garminAuth = require('../services/garminAuth');
const garminSync = require('../services/garminSync');
const User = require('../models/user');

// POST /api/garmin/connect
router.post('/connect', async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Authenticate with Garmin
    const { encrypted } = await garminAuth.authenticate(username, password);

    // Store encrypted session token
    await User.update(user.id, {
      garminSessionTokenEncrypted: encrypted,
      garminConnectedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Garmin connected successfully'
    });
  } catch (error) {
    console.error('Garmin connect error:', error);
    res.status(500).json({
      error: 'Failed to connect Garmin',
      message: error.message
    });
  }
});

// POST /api/garmin/sync
router.post('/sync', async (req, res) => {
  try {
    const { fullSync } = req.body;
    const token = req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user || !user.garmin_session_token_encrypted) {
      return res.status(400).json({ error: 'Garmin not connected' });
    }

    // Get Garmin client
    const client = await garminAuth.getClient(user.garmin_session_token_encrypted);

    // Sync
    const result = fullSync
      ? await garminSync.fullHistoricalSync(client, user.id)
      : await garminSync.incrementalSync(client, user.id);

    res.json(result);
  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

// GET /api/garmin/status
router.get('/status', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      connected: !!user.garmin_session_token_encrypted,
      connectedAt: user.garmin_connected_at
    });
  } catch (error) {
    console.error('Garmin status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;
```

#### Task 4.2.6: Register Garmin Routes

**File:** `server/app.js`
```javascript
const garminRoutes = require('./routes/garmin');
app.use('/api/garmin', garminRoutes);
```

#### Task 4.2.7: Update Sync All Service

**File:** `server/services/syncAll.js`
```javascript
const garminAuth = require('./garminAuth');
const garminSync = require('./garminSync');

// Update syncAllDataSources function
async function syncAllDataSources(userId) {
  const user = await User.findById(userId);

  const results = {
    foursquare: null,
    garmin: null
  };

  // Sync Foursquare
  try {
    results.foursquare = await syncUserCheckins(userId);
  } catch (error) {
    results.foursquare = { error: error.message };
  }

  // Sync Garmin
  if (user.garmin_session_token_encrypted) {
    try {
      const client = await garminAuth.getClient(user.garmin_session_token_encrypted);
      results.garmin = await garminSync.incrementalSync(client, userId);
    } catch (error) {
      results.garmin = { error: error.message };
    }
  }

  return results;
}
```

### Phase 4.3: Frontend - Garmin Connection

#### Task 4.3.1: Update Data Sources Page

**File:** `client/src/pages/DataSourcesPage.jsx`
```jsx
// Add state for Garmin
const [garminStatus, setGarminStatus] = useState(null);
const [garminModalOpen, setGarminModalOpen] = useState(false);
const [garminCredentials, setGarminCredentials] = useState({ username: '', password: '' });
const [connecting, setConnecting] = useState(false);

useEffect(() => {
  loadGarminStatus();
}, []);

const loadGarminStatus = async () => {
  try {
    const status = await getGarminStatus(token);
    setGarminStatus(status);
  } catch (error) {
    console.error('Failed to load Garmin status:', error);
  }
};

const handleGarminConnect = async () => {
  setConnecting(true);
  try {
    await connectGarmin(token, garminCredentials);
    setGarminModalOpen(false);
    loadGarminStatus();
    alert('Garmin connected! Starting initial sync...');
    // Trigger full sync
    await syncGarmin(token, true);
    alert('Initial sync complete!');
  } catch (error) {
    alert('Failed to connect Garmin: ' + error.message);
  } finally {
    setConnecting(false);
  }
};

// Update the Garmin list item
<ListItem>
  <ListItemText
    primary="Garmin"
    secondary={
      garminStatus?.connected
        ? `Connected ${new Date(garminStatus.connectedAt).toLocaleDateString()}`
        : 'Not connected'
    }
  />
  {garminStatus?.connected ? (
    <CheckCircle color="success" />
  ) : (
    <Button variant="outlined" onClick={() => setGarminModalOpen(true)}>
      Connect
    </Button>
  )}
</ListItem>

// Add Garmin connection modal
<Dialog open={garminModalOpen} onClose={() => setGarminModalOpen(false)}>
  <DialogTitle>Connect Garmin</DialogTitle>
  <DialogContent>
    <Alert severity="warning" sx={{ mb: 2 }}>
      Important: Temporarily disable Two-Factor Authentication on your Garmin account before connecting.
    </Alert>
    <TextField
      fullWidth
      label="Garmin Username"
      value={garminCredentials.username}
      onChange={(e) => setGarminCredentials({ ...garminCredentials, username: e.target.value })}
      sx={{ mb: 2 }}
    />
    <TextField
      fullWidth
      type="password"
      label="Garmin Password"
      value={garminCredentials.password}
      onChange={(e) => setGarminCredentials({ ...garminCredentials, password: e.target.value })}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setGarminModalOpen(false)}>Cancel</Button>
    <Button onClick={handleGarminConnect} variant="contained" disabled={connecting}>
      {connecting ? 'Connecting...' : 'Connect'}
    </Button>
  </DialogActions>
</Dialog>
```

#### Task 4.3.2: Add Garmin API Functions

**File:** `client/src/services/api.js`
```javascript
export const getGarminStatus = async (token) => {
  const response = await fetch(`${API_URL}/api/garmin/status?token=${token}`);
  if (!response.ok) throw new Error('Failed to get Garmin status');
  return response.json();
};

export const connectGarmin = async (token, credentials) => {
  const response = await fetch(`${API_URL}/api/garmin/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
    },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) throw new Error('Failed to connect Garmin');
  return response.json();
};

export const syncGarmin = async (token, fullSync = false) => {
  const response = await fetch(`${API_URL}/api/garmin/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
    },
    body: JSON.stringify({ fullSync })
  });
  if (!response.ok) throw new Error('Garmin sync failed');
  return response.json();
};
```

### Phase 4.4: Testing

#### Task 4.4.1: Write Automated Tests

**File:** `server/services/garminSync.test.js`
```javascript
const garminSync = require('../services/garminSync');

describe('Garmin Sync Service', () => {
  test('transforms Garmin activity to database format', () => {
    const mockActivity = {
      activityId: 12345,
      activityType: { typeKey: 'running' },
      activityName: 'Morning Run',
      startTimeGMT: '2024-01-15T09:00:00Z',
      duration: 1935,
      distance: 5200,
      calories: 287,
      averageHR: 145,
      maxHR: 172,
      geo: {
        geoPoints: [
          { lat: 40.7128, lon: -74.0060 },
          { lat: 40.7129, lon: -74.0061 }
        ]
      }
    };

    const result = garminSync.transformActivity(mockActivity, 1);

    expect(result.garmin_activity_id).toBe('12345');
    expect(result.activity_type).toBe('running');
    expect(result.duration_seconds).toBe(1935);
    expect(result.tracklog).toContain('LINESTRING');
  });

  test('handles unmapped activities without tracklog', () => {
    const mockActivity = {
      activityId: 67890,
      activityType: { typeKey: 'yoga' },
      activityName: 'Yoga Class',
      startTimeGMT: '2024-01-15T18:00:00Z',
      duration: 2700,
      calories: 120
    };

    const result = garminSync.transformActivity(mockActivity, 1);

    expect(result.tracklog).toBeNull();
    expect(result.activity_type).toBe('yoga');
  });
});
```

**File:** `server/routes/garmin.test.js`
```javascript
const request = require('supertest');
const app = require('../app');
const garminAuth = require('../services/garminAuth');

jest.mock('../services/garminAuth');

describe('Garmin Routes', () => {
  test('POST /api/garmin/connect stores session token', async () => {
    garminAuth.authenticate.mockResolvedValueOnce({
      encrypted: 'encrypted-token-data'
    });

    const response = await request(app)
      .post('/api/garmin/connect')
      .set('x-auth-token', 'test-token-123')
      .send({ username: 'test@example.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('GET /api/garmin/status returns connection status', async () => {
    const response = await request(app)
      .get('/api/garmin/status')
      .set('x-auth-token', 'test-token-123');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('connected');
  });
});
```

#### Task 4.4.2: Run Tests
```bash
npm test
```

### 🔴 TESTING CHECKPOINT #4

**Automated Tests:**
```bash
npm test -- garminSync.test.js garmin.test.js
```

**Manual Tests:**
1. Navigate to Data Sources page
2. Click "Connect Garmin"
3. Enter credentials (with MFA disabled)
4. Connection succeeds, token stored
5. Initial full sync starts and completes
6. Check database: All 4 Garmin tables populated
7. Mapped activities have tracklog data
8. Unmapped activities stored without tracklog
9. Garmin status shows "Connected" with date
10. Click "Sync All Data" from context menu → Includes Garmin
11. Incremental sync works (fetches last 7 days)
12. Error handling: Invalid credentials show error
13. Error handling: Garmin API failure handled gracefully

**Sign-off:** ✅ All Part 4 tests passing before proceeding to Part 5

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
