const User = require('../models/user');
const ImportJob = require('../models/importJob');
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

    // Get encrypted OAuth tokens
    const encryptedTokens = await User.getGarminTokens(userId);
    if (!encryptedTokens) {
      throw new Error('No Garmin OAuth tokens found');
    }

    let result;

    if (syncType === 'full') {
      // Full historical sync (5 years)
      result = await garminSync.fullHistoricalSync(encryptedTokens, userId, 5, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    } else {
      // Incremental sync
      const user = await User.findById(userId);
      const lastSyncDate = user.last_garmin_sync_at;
      console.log(`[GARMIN JOB] User ${userId}: last_garmin_sync_at = ${lastSyncDate}`);

      result = await garminSync.incrementalSync(encryptedTokens, userId, lastSyncDate, async (progress) => {
        console.log(`Garmin import ${jobId}: Progress update`, progress);
        await ImportJob.update(jobId, {
          totalImported: progress.totalImported || progress.daysProcessed || 0,
          currentBatch: progress.batch || 0
        });
      });
    }

    // Calculate total imported
    const totalImported = (result.activities?.imported || 0) + (result.dailyMetrics?.totalInserted || 0);

    console.log(`Garmin import job ${jobId} completed: ${totalImported} items imported`);

    // Mark job as completed
    await ImportJob.markCompleted(jobId);

    // CRITICAL: Only update last_garmin_sync_at when items actually imported
    // This prevents the vicious cycle where:
    // - Empty sync updates timestamp
    // - Next sync starts from updated timestamp
    // - Misses data that was added between syncs
    // - Data never gets imported
    if (totalImported > 0) {
      await User.updateLastGarminSync(userId);
      console.log(`[GARMIN JOB] Imported ${totalImported} items, updated last_sync`);
    } else {
      console.log(`[GARMIN JOB] No items imported - NOT updating last_garmin_sync_at`);
    }

  } catch (error) {
    console.error(`Garmin import job ${jobId} failed:`, error);

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    // CRITICAL: Don't re-throw rate limit errors - they need permanent failure, not retry
    // Rate limits will not be resolved by retrying immediately
    if (error.message && error.message.includes('Rate limit')) {
      console.log(`[GARMIN JOB] Rate limit error - not retrying job ${jobId}`);
      return; // Exit cleanly so pg-boss doesn't retry
    }

    // For other errors, re-throw to trigger pg-boss retry
    throw error;
  }
}

module.exports = importGarminDataHandler;
