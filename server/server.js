require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { initQueue, getQueue, stopQueue } = require('./jobs/queue');
const importCheckinsHandler = require('./jobs/importCheckins');
const importGarminDataHandler = require('./jobs/importGarminData');
const importStravaDataHandler = require('./jobs/importStravaData');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Session middleware for OAuth flows (Garmin PKCE)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 3600000 // 1 hour
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check encryption key setup
app.get('/debug/encryption', (req, res) => {
  const hasKey = !!process.env.ENCRYPTION_KEY;
  const keyLength = process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 0;
  res.json({
    hasEncryptionKey: hasKey,
    keyLength: keyLength,
    expectedLength: 64,
    isValid: keyLength === 64
  });
});

// Debug endpoint to check Mapbox token setup
app.get('/debug/mapbox', (req, res) => {
  const hasToken = !!process.env.MAPBOX_TOKEN;
  const tokenPrefix = process.env.MAPBOX_TOKEN ? process.env.MAPBOX_TOKEN.substring(0, 10) : null;
  res.json({
    hasMapboxToken: hasToken,
    tokenPrefix: tokenPrefix,
    isPublicKey: tokenPrefix?.startsWith('pk.')
  });
});

// Debug endpoint to test static map generation
app.get('/debug/static-map', (req, res) => {
  const staticMapGenerator = require('./services/staticMapGenerator');
  // Test checkins
  const testCheckins = [
    { latitude: 51.5074, longitude: -0.1278 }, // London
    { latitude: 51.5094, longitude: -0.1180 }  // Near London
  ];
  try {
    const url = staticMapGenerator.generateCheckinMapUrl(testCheckins);
    res.json({
      success: true,
      tokenInGenerator: !!staticMapGenerator.mapboxToken,
      tokenPrefix: staticMapGenerator.mapboxToken ? staticMapGenerator.mapboxToken.substring(0, 10) : null,
      urlGenerated: !!url,
      urlPreview: url ? url.substring(0, 250) + '...' : null,
      fullUrl: url
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/import', require('./routes/import'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/filters', require('./routes/filters'));
app.use('/api/year-in-review', require('./routes/yearInReview'));
app.use('/api/copilot', require('./routes/copilot'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/garmin', require('./routes/garmin'));
app.use('/api/strava', require('./routes/strava'));
app.use('/api/day-in-life', require('./routes/dayInLife'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize job queue and start server
async function start() {
  try {
    // Initialize pg-boss
    await initQueue();
    const queue = getQueue();

    // Register job handlers (queues created in initQueue)
    await queue.work('import-checkins', importCheckinsHandler);

    // Register Garmin import job
    await queue.work('import-garmin-data', importGarminDataHandler);
    console.log('Registered job: import-garmin-data');

    // Register Strava import job
    await queue.work('import-strava-data', importStravaDataHandler);
    console.log('Registered job: import-strava-data');

    console.log('Job queue initialized and workers registered');

    // Start Gemini session cleanup
    const sessionManager = require('./services/geminiSessionManager');
    sessionManager.startCleanupInterval();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await stopQueue();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await stopQueue();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = app;
