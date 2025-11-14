const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { decrypt } = require('../services/encryption');
const garminSync = require('../services/garminSync');

/**
 * Background job handler for importing Garmin data
 * @param {Object} job - pg-boss job object
 * @param {number} job.data.jobId - Import job ID
 * @param {number} job.data.userId - User ID
 * @param {string} job.data.syncType - 'full' or 'incremental'
 */
async function importGarminDataHandler(job) {
  const { jobId, userId, syncType = 'incremental' } = job.data;

  console.log(`Starting Garmin import job ${jobId} for user ${userId} (${syncType})`);

  try {
    // Mark job as started
    await ImportJob.markStarted(jobId);

    // Get user with encrypted Garmin token
    const user = await User.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.garmin_session_token_encrypted) {
      throw new Error('User has no Garmin session token');
    }

    // Decrypt session token
    const sessionToken = user.garmin_session_token_encrypted;

    let result;

    if (syncType === 'full') {
      // Full historical sync (5 years)
      result = await garminSync.fullHistoricalSync(sessionToken, userId, 5, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    } else {
      // Incremental sync
      const lastSyncDate = user.last_garmin_sync_at;
      console.log(`[GARMIN JOB] User ${userId}: last_garmin_sync_at = ${lastSyncDate}`);

      result = await garminSync.incrementalSync(sessionToken, userId, lastSyncDate, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    }

    const totalImported = (result.activities?.imported || 0) + (result.dailyMetrics?.totalInserted || 0);

    console.log(`Garmin import job ${jobId} completed: ${totalImported} items imported`);

    // Mark job as completed
    await ImportJob.markCompleted(jobId);

    // CRITICAL: Only update last_garmin_sync_at when items were actually imported
    // This prevents the vicious cycle we had with Foursquare
    if (totalImported > 0) {
      await User.updateLastGarminSync(userId);
    } else {
      console.log(`[GARMIN JOB] No items imported - NOT updating last_garmin_sync_at`);
    }

  } catch (error) {
    console.error(`Garmin import job ${jobId} failed:`, error);

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    throw error; // Re-throw so pg-boss knows it failed
  }
}

module.exports = importGarminDataHandler;
