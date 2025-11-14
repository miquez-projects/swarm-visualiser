const express = require('express');
const router = express.Router();
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const garminAuth = require('../services/garminAuth');
const { getQueue } = require('../jobs/queue');

/**
 * POST /api/garmin/connect
 * Connect Garmin account with username/password
 */
router.post('/connect', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Authenticate with Garmin
    const { encrypted } = await garminAuth.authenticate(username, password);

    // Save encrypted session token
    await User.update(user.id, {
      garmin_session_token_encrypted: encrypted,
      garmin_connected_at: new Date()
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

/**
 * POST /api/garmin/sync
 * Start Garmin data sync (queues background job)
 */
router.post('/sync', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user.garmin_session_token_encrypted) {
      return res.status(400).json({ error: 'Garmin not connected' });
    }

    const { syncType = 'incremental' } = req.body;

    // Create import job
    const job = await ImportJob.create({
      user_id: user.id,
      data_source: 'garmin',
      status: 'queued'
    });

    // Queue background job
    const boss = getQueue();
    await boss.send('import-garmin-data', {
      jobId: job.id,
      userId: user.id,
      syncType
    });

    console.log(`Queued Garmin sync job ${job.id} for user ${user.id} (${syncType})`);

    res.json({
      success: true,
      jobId: job.id,
      message: 'Garmin sync queued. Check progress in import history.'
    });
  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({
      error: 'Failed to start Garmin sync',
      message: error.message
    });
  }
});

/**
 * DELETE /api/garmin/disconnect
 * Disconnect Garmin account
 */
router.delete('/disconnect', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findBySecretToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await User.update(user.id, {
      garmin_session_token_encrypted: null,
      garmin_connected_at: null,
      last_garmin_sync_at: null
    });

    res.json({
      success: true,
      message: 'Garmin disconnected successfully'
    });
  } catch (error) {
    console.error('Garmin disconnect error:', error);
    res.status(500).json({
      error: 'Failed to disconnect Garmin',
      message: error.message
    });
  }
});

module.exports = router;
