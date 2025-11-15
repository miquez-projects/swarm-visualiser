const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const garminOAuth = require('../services/garminOAuth');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');
const garminJsonParser = require('../services/garminJsonParser');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Max 50 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

/**
 * GET /api/garmin/connect
 * Initiate Garmin OAuth2 PKCE flow
 */
router.get('/connect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const callbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/garmin/callback`;

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = garminOAuth.generatePKCE();

    // Store PKCE verifier and user ID in session for callback
    req.session.garminCodeVerifier = codeVerifier;
    req.session.garminUserId = userId;

    // Generate authorization URL
    const authUrl = garminOAuth.getAuthorizationUrl(callbackUrl, codeChallenge);

    console.log(`[GARMIN ROUTE] Generated OAuth URL for user ${userId}`);

    res.json({ authUrl });
  } catch (error) {
    console.error('[GARMIN ROUTE] Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * GET /api/garmin/callback
 * OAuth2 callback - exchange authorization code for tokens
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    console.error('[GARMIN ROUTE] Callback missing authorization code');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?garmin=error&reason=missing_code`);
  }

  try {
    // Retrieve PKCE verifier and user ID from session
    const codeVerifier = req.session?.garminCodeVerifier;
    const userId = req.session?.garminUserId;

    if (!codeVerifier || !userId) {
      console.error('[GARMIN ROUTE] Session expired or missing');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?garmin=error&reason=session_expired`);
    }

    const callbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/garmin/callback`;

    // Exchange authorization code for tokens
    const { accessToken, refreshToken } = await garminOAuth.exchangeCodeForToken(
      code,
      codeVerifier,
      callbackUrl
    );

    // Encrypt and store tokens
    const encryptedTokens = garminOAuth.encryptTokens(accessToken, refreshToken);
    await User.updateGarminAuth(userId, encryptedTokens);

    // Clear session data
    delete req.session.garminCodeVerifier;
    delete req.session.garminUserId;

    console.log(`[GARMIN ROUTE] Successfully connected Garmin for user ${userId}`);

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?garmin=connected`);
  } catch (error) {
    console.error('[GARMIN ROUTE] Callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?garmin=error&reason=token_exchange_failed`);
  }
});

/**
 * POST /api/garmin/sync
 * Queue Garmin data sync job
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { syncType = 'incremental' } = req.body;

    // Verify user has Garmin tokens
    const tokens = await User.getGarminTokens(userId);
    if (!tokens) {
      return res.status(400).json({ error: 'Garmin not connected' });
    }

    // Create import job
    const job = await ImportJob.create({
      user_id: userId,
      data_source: 'garmin',
      status: 'queued'
    });

    // Queue background job
    const boss = getQueue();
    await boss.send('import-garmin-data', {
      jobId: job.id,
      userId,
      syncType
    });

    console.log(`[GARMIN ROUTE] Queued sync job ${job.id} for user ${userId} (${syncType})`);

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('[GARMIN ROUTE] Sync error:', error);
    res.status(500).json({ error: 'Failed to queue sync' });
  }
});

/**
 * GET /api/garmin/status
 * Get Garmin connection status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user.garmin_oauth_tokens_encrypted) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      connectedAt: user.garmin_connected_at,
      lastSyncAt: user.last_garmin_sync_at,
      syncActivities: user.garmin_sync_activities !== false // Include toggle state
    });
  } catch (error) {
    console.error('[GARMIN ROUTE] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /api/garmin/settings
 * Update Garmin sync settings
 */
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { syncActivities } = req.body;

    if (typeof syncActivities !== 'boolean') {
      return res.status(400).json({ error: 'syncActivities must be a boolean' });
    }

    await User.updateGarminSyncSettings(userId, { syncActivities });

    console.log(`[GARMIN ROUTE] Updated settings for user ${userId}: syncActivities=${syncActivities}`);

    res.json({
      success: true,
      syncActivities
    });
  } catch (error) {
    console.error('[GARMIN ROUTE] Settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * DELETE /api/garmin/disconnect
 * Disconnect Garmin account
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Clear OAuth tokens
    await User.updateGarminAuth(userId, null);

    console.log(`[GARMIN ROUTE] Disconnected Garmin for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[GARMIN ROUTE] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * POST /api/garmin/upload
 * Upload Garmin data dump JSON files
 * Accepts UDS files and sleep data files
 */
router.post('/upload', authenticateToken, upload.array('files', 50), async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[GARMIN ROUTE] Processing ${files.length} files for user ${userId}`);

    const results = {
      totalFiles: files.length,
      processed: 0,
      stepsRecords: 0,
      heartRateRecords: 0,
      sleepRecords: 0,
      skippedRecords: 0,
      errors: []
    };

    // Process each file
    for (const file of files) {
      try {
        const content = file.buffer.toString('utf-8');
        const filename = file.originalname;

        console.log(`[GARMIN ROUTE] Processing file: ${filename}`);

        // Determine file type and parse accordingly
        if (filename.includes('sleepData')) {
          // Parse sleep data file
          const rawData = JSON.parse(content);
          const rawCount = rawData.length;
          const sleepData = await garminJsonParser.parseSleepFile(content);
          const validCount = sleepData.length;

          // Track skipped records (those with null/missing dates)
          const skipped = rawCount - validCount;
          if (skipped > 0) {
            results.skippedRecords += skipped;
            console.log(`[GARMIN ROUTE] Skipped ${skipped} sleep record(s) with null/missing dates in ${filename}`);
          }

          // Insert sleep records
          for (const record of sleepData) {
            await GarminDailySleep.upsert({ ...record, user_id: userId });
            results.sleepRecords++;
          }
        } else if (filename.startsWith('UDSFile')) {
          // Parse UDS file (contains steps and heart rate)
          const udsData = await garminJsonParser.parseUDSFile(content);

          // Insert steps records
          for (const record of udsData.steps) {
            await GarminDailySteps.upsert({ ...record, user_id: userId });
            results.stepsRecords++;
          }

          // Insert heart rate records
          for (const record of udsData.heartRate) {
            await GarminDailyHeartRate.upsert({ ...record, user_id: userId });
            results.heartRateRecords++;
          }
        } else {
          console.log(`[GARMIN ROUTE] Skipping unknown file type: ${filename}`);
          results.errors.push(`Skipped unknown file type: ${filename}`);
          continue;
        }

        results.processed++;
      } catch (fileError) {
        console.error(`[GARMIN ROUTE] Error processing file ${file.originalname}:`, fileError);
        results.errors.push(`${file.originalname}: ${fileError.message}`);
      }
    }

    console.log(`[GARMIN ROUTE] Upload complete for user ${userId}:`, results);

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('[GARMIN ROUTE] Upload error:', error);
    res.status(500).json({ error: 'Failed to process uploads' });
  }
});

module.exports = router;
