require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initQueue, getQueue, stopQueue } = require('./jobs/queue');
const importCheckinsHandler = require('./jobs/importCheckins');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/import', require('./routes/import'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/filters', require('./routes/filters'));
app.use('/api/year-in-review', require('./routes/yearInReview'));

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

    // Register job handlers
    await queue.work('import-checkins', importCheckinsHandler);

    console.log('Job queue initialized and workers registered');

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

start();

module.exports = app;
