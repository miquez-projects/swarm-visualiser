const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');

/**
 * Sync all data sources for a user
 * Currently syncs Foursquare check-ins
 * Will be expanded to include Garmin in Part 4
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
    garmin: null // Will be implemented in Part 4
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
        userId,
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

  // TODO: Sync Garmin (Part 4)
  results.garmin = {
    status: 'not_implemented',
    message: 'Garmin sync will be implemented in Part 4'
  };

  return results;
}

module.exports = { syncAllDataSources };
