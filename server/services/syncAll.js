const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

/**
 * Sync all data sources for a user
 * Currently syncs Foursquare check-ins and Garmin activities
 *
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Sync results for each data source
 */
async function syncAllDataSources(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  const results = {
    foursquare: null,
    garmin: null
  };

  // Sync Foursquare
  try {
    // Check if there's already a running import for this user
    const existingJobs = await ImportJob.findByUserId(userId);
    const runningJob = existingJobs.find(job => job.status === 'running' || job.status === 'pending');

    if (runningJob) {
      results.foursquare = {
        status: 'already_running',
        jobId: runningJob.id,
        message: 'Import already in progress'
      };
    } else {
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

      results.foursquare = {
        status: 'queued',
        jobId: job.id,
        message: 'Import job queued'
      };
    }
  } catch (error) {
    results.foursquare = {
      status: 'error',
      message: error.message
    };
  }

  // Sync Garmin if connected
  if (user.garmin_session_token_encrypted) {
    try {
      const garminJob = await ImportJob.create({
        user_id: userId,
        data_source: 'garmin',
        status: 'queued'
      });

      const boss = getQueue();
      await boss.send('import-garmin-data', {
        jobId: garminJob.id,
        userId,
        syncType: 'incremental'
      });

      results.garmin = { jobId: garminJob.id, status: 'queued' };
    } catch (error) {
      console.error('Failed to queue Garmin sync:', error);
      results.garmin = { error: error.message };
    }
  } else {
    results.garmin = { skipped: 'Not connected' };
  }

  return results;
}

module.exports = { syncAllDataSources };
