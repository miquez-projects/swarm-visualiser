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
