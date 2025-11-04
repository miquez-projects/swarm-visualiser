const express = require('express');
const router = express.Router();
const { getQueue } = require('../jobs/queue');

/**
 * POST /api/admin/trigger-daily-sync
 * Manually trigger the daily sync orchestrator (for testing)
 *
 * Security: Should be protected in production (add auth if needed)
 */
router.post('/trigger-daily-sync', async (req, res) => {
  try {
    console.log('[ADMIN] Manual trigger of daily-sync-orchestrator requested');

    const queue = getQueue();
    const jobId = await queue.send('daily-sync-orchestrator', {});

    console.log(`[ADMIN] Daily sync orchestrator queued with job ID: ${jobId}`);

    res.json({
      success: true,
      message: 'Daily sync orchestrator triggered successfully',
      jobId: jobId,
      note: 'Check server logs for [DAILY-SYNC] messages to monitor progress'
    });

  } catch (error) {
    console.error('[ADMIN] Failed to trigger daily sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger daily sync',
      message: error.message
    });
  }
});

module.exports = router;
