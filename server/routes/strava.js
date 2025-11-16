const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stravaOAuth = require('../services/stravaOAuth');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

/**
 * GET /api/strava/auth/start
 * Initiate Strava OAuth2 flow
 * Note: Strava uses standard OAuth2, NOT PKCE (unlike Garmin)
 */
router.get('/auth/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const callbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/strava/auth/callback`;

    // Generate authorization URL (no PKCE for Strava)
    // Use state parameter to pass user ID (more reliable than sessions)
    const state = `user_${userId}`;

    const authUrl = stravaOAuth.getAuthorizationUrl(
      callbackUrl,
      state,
      'read,activity:read_all'
    );

    console.log(`[STRAVA ROUTE] Generated OAuth URL for user ${userId}`);

    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    console.error('[STRAVA ROUTE] Auth start error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * GET /api/strava/auth/callback
 * OAuth2 callback - exchange authorization code for tokens
 * Strava redirects here with code in query params
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    console.error('[STRAVA ROUTE] Callback missing authorization code');
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Extract user ID from state parameter (format: "user_123")
    if (!state || !state.startsWith('user_')) {
      console.error('[STRAVA ROUTE] Invalid or missing state parameter');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?error=invalid_state`);
    }

    const userId = parseInt(state.replace('user_', ''), 10);

    if (!userId || isNaN(userId)) {
      console.error('[STRAVA ROUTE] Invalid user ID in state');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?error=invalid_state`);
    }

    const callbackUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/strava/auth/callback`;

    // Exchange authorization code for tokens
    const { accessToken, refreshToken, expiresAt, athleteId } = await stravaOAuth.exchangeCodeForToken(
      code,
      callbackUrl
    );

    // Encrypt and store tokens with athlete ID
    const encryptedTokens = stravaOAuth.encryptTokens(accessToken, refreshToken, expiresAt);
    await User.updateStravaAuth(userId, encryptedTokens, athleteId);

    // Queue initial full import
    const job = await ImportJob.create({
      user_id: userId,
      data_source: 'strava',
      status: 'queued'
    });

    const boss = getQueue();
    await boss.send('import-strava-data', {
      jobId: job.id,
      userId,
      syncType: 'full'  // Initial import should be full
    });

    console.log(`[STRAVA ROUTE] Successfully connected Strava for user ${userId}, athlete ID: ${athleteId}`);
    console.log(`[STRAVA ROUTE] Queued initial import job ${job.id} for user ${userId}`);

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?strava=connected`);
  } catch (error) {
    console.error('[STRAVA ROUTE] Callback error:', error);
    console.error('[STRAVA ROUTE] Error details:', error.message);
    console.error('[STRAVA ROUTE] Error stack:', error.stack);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/data-sources?error=strava_failed`);
  }
});

/**
 * GET /api/strava/status
 * Get Strava connection status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user.strava_oauth_tokens_encrypted) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      athleteId: user.strava_athlete_id,
      connectedAt: user.strava_connected_at,
      lastSyncAt: user.last_strava_sync_at
    });
  } catch (error) {
    console.error('[STRAVA ROUTE] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/strava/disconnect
 * Disconnect Strava account
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Clear OAuth tokens
    await User.updateStravaAuth(userId, null);

    console.log(`[STRAVA ROUTE] Disconnected Strava for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[STRAVA ROUTE] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * POST /api/strava/sync
 * Queue Strava data sync job
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify user has Strava tokens
    const tokens = await User.getStravaTokens(userId);
    if (!tokens) {
      return res.status(400).json({ error: 'Strava not connected' });
    }

    // Auto-detect sync type: full if never synced, incremental otherwise
    const user = await User.findById(userId);
    const syncType = user.last_strava_sync_at ? 'incremental' : 'full';

    // Create import job
    const job = await ImportJob.create({
      user_id: userId,
      data_source: 'strava',
      status: 'queued'
    });

    // Queue background job
    const boss = getQueue();
    await boss.send('import-strava-data', {
      jobId: job.id,
      userId,
      syncType
    });

    console.log(`[STRAVA ROUTE] Queued sync job ${job.id} for user ${userId} (${syncType})`);

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('[STRAVA ROUTE] Sync error:', error);
    res.status(500).json({
      error: 'Failed to queue sync',
      details: error.message
    });
  }
});

/**
 * GET /api/strava/sync/status/:jobId
 * Check sync job status
 */
router.get('/sync/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await ImportJob.findById(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to user
    if (job.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      dataSource: job.data_source,
      totalImported: job.total_imported,
      totalExpected: job.total_expected,
      currentBatch: job.current_batch,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message
    });
  } catch (error) {
    console.error('[STRAVA ROUTE] Sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

module.exports = router;
