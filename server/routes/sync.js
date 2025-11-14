const express = require('express');
const router = express.Router();
const { syncAllDataSources } = require('../services/syncAll');
const User = require('../models/user');

/**
 * POST /api/sync/all
 * Sync all data sources for the authenticated user
 * Supports both query param and header token authentication
 */
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

    // DO NOT update last sync timestamp here - it's updated by the background job
    // when it actually completes successfully. Updating it here causes a race condition
    // where last_sync_at is set before the job runs, creating a vicious cycle.

    res.json({
      success: true,
      results,
      message: 'Sync jobs queued. Check progress in import history.'
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
