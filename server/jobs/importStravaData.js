const User = require('../models/user');
const ImportJob = require('../models/importJob');
const stravaSync = require('../services/stravaSync');

/**
 * Background job handler for importing Strava data
 * @param {Object} job - pg-boss job object
 * @param {number} job.data.jobId - Import job ID
 * @param {number} job.data.userId - User ID
 * @param {string} job.data.syncType - 'full' or 'incremental'
 */
async function importStravaDataHandler(job) {
  const { jobId, userId, syncType = 'incremental' } = job.data;

  console.log(`Starting Strava import job ${jobId} for user ${userId} (${syncType})`);

  try {
    // Mark job as started
    await ImportJob.markStarted(jobId);

    // Get encrypted OAuth tokens
    const encryptedTokens = await User.getStravaTokens(userId);
    if (!encryptedTokens) {
      throw new Error('No Strava OAuth tokens found');
    }

    let result;

    if (syncType === 'full') {
      // Full historical sync (5 years)
      result = await stravaSync.fullHistoricalSync(encryptedTokens, userId, 5, async (progress) => {
        console.log(`Strava import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.detailed || progress.fetched || 0,
          currentBatch: progress.activitiesProcessed || 0
        });
      });
    } else {
      // Incremental sync
      const user = await User.findById(userId);
      const lastSyncDate = user.last_strava_sync_at;
      console.log(`[STRAVA JOB] User ${userId}: last_strava_sync_at = ${lastSyncDate}`);

      result = await stravaSync.incrementalSync(encryptedTokens, userId, lastSyncDate, async (progress) => {
        console.log(`Strava import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.detailed || progress.fetched || 0,
          currentBatch: progress.activitiesProcessed || 0
        });
      });
    }

    // Calculate total imported
    const totalImported = (result.activities?.imported || 0) + (result.photos?.photosInserted || 0);

    console.log(`Strava import job ${jobId} completed: ${totalImported} items imported`);

    // Mark job as completed
    await ImportJob.markCompleted(jobId);

    // CRITICAL: Only update last_strava_sync_at when items actually imported
    // This prevents the vicious cycle where:
    // - Empty sync updates timestamp
    // - Next sync starts from updated timestamp
    // - Misses data that was added between syncs
    // - Data never gets imported
    if (totalImported > 0) {
      await User.updateLastStravaSync(userId);
      console.log(`[STRAVA JOB] Imported ${totalImported} items, updated last_sync`);
    } else {
      console.log(`[STRAVA JOB] No items imported - NOT updating last_strava_sync_at`);
    }

  } catch (error) {
    console.error(`Strava import job ${jobId} failed:`, error);

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    throw error; // Re-throw so pg-boss knows it failed
  }
}

module.exports = importStravaDataHandler;
