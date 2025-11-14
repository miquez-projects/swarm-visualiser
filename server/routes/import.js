const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

/**
 * POST /api/import/start
 * Start a new import job for the authenticated user
 * Requires magic link token
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if there's already a running import for this user
    const existingJobs = await ImportJob.findByUserId(userId);
    const runningJob = existingJobs.find(job => job.status === 'running' || job.status === 'pending');

    if (runningJob) {
      return res.status(409).json({
        error: 'Import already in progress',
        jobId: runningJob.id
      });
    }

    // Create a new import job
    const job = await ImportJob.create({
      user_id: userId,
      data_source: 'foursquare',
      status: 'pending'
    });

    // Queue the import job
    const queue = getQueue();
    await queue.send('import-checkins', {
      jobId: job.id,
      userId: userId
    });

    res.json({
      jobId: job.id,
      status: 'pending',
      message: 'Import job queued'
    });

  } catch (error) {
    console.error('Start import error:', error);
    res.status(500).json({
      error: 'Failed to start import',
      message: error.message
    });
  }
});

/**
 * GET /api/import/status/:jobId
 * Get status of an import job
 * Requires magic link token (must be job owner)
 */
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await ImportJob.findById(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found'
      });
    }

    // Verify user owns this job
    if (job.user_id !== userId) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      id: job.id,
      status: job.status,
      dataSource: job.data_source,
      totalExpected: job.total_expected,
      totalImported: job.total_imported,
      currentBatch: job.current_batch,
      errorMessage: job.error_message,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at
    });

  } catch (error) {
    console.error('Get import status error:', error);
    res.status(500).json({
      error: 'Failed to get import status',
      message: error.message
    });
  }
});

/**
 * GET /api/import/latest
 * Get the latest import job for the authenticated user
 * Requires magic link token
 */
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const job = await ImportJob.findLatestByUserId(userId);

    if (!job) {
      return res.json({
        job: null
      });
    }

    res.json({
      job: {
        id: job.id,
        status: job.status,
        dataSource: job.data_source,
        totalExpected: job.total_expected,
        totalImported: job.total_imported,
        currentBatch: job.current_batch,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        createdAt: job.created_at
      }
    });

  } catch (error) {
    console.error('Get latest import error:', error);
    res.status(500).json({
      error: 'Failed to get latest import',
      message: error.message
    });
  }
});

module.exports = router;
