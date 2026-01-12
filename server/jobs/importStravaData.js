const User = require('../models/user');
const ImportJob = require('../models/importJob');
const stravaSync = require('../services/stravaSync');
const { RateLimitError } = require('../services/stravaRateLimitService');
const { getQueue } = require('./queue');

/**
 * Background job handler for importing Strava data
 * @param {Object} job - pg-boss job object
 * @param {number} job.data.jobId - Import job ID
 * @param {number} job.data.userId - User ID
 * @param {string} job.data.syncType - 'full' or 'incremental'
 */
async function importStravaDataHandler([job]) {
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

    // Check for existing cursor (resuming partial import)
    const existingJob = await ImportJob.findById(jobId);
    const cursor = existingJob.sync_cursor;

    if (cursor) {
      console.log(`[STRAVA JOB] Resuming job ${jobId} from cursor:`, cursor);
    }

    let result;

    if (syncType === 'full') {
      // Full historical sync - all activities
      result = await stravaSync.fullHistoricalSync(encryptedTokens, userId, cursor, async (progress) => {
        console.log(`Strava import ${jobId}: Progress update`, progress);

        // Update cursor if we have timestamp
        if (progress.oldestActivityTimestamp) {
          await ImportJob.updateCursor(jobId, {
            before: progress.oldestActivityTimestamp,
            activities_imported: progress.inserted || 0,
            photos_imported: 0
          });
        }

        await ImportJob.update(jobId, {
          totalImported: progress.inserted || 0,
          currentBatch: progress.detailed || 0
        });
      });
    } else {
      // Incremental sync
      const user = await User.findById(userId);
      const lastSyncDate = user.last_strava_sync_at;
      console.log(`[STRAVA JOB] User ${userId}: last_strava_sync_at = ${lastSyncDate}`);

      result = await stravaSync.incrementalSync(encryptedTokens, userId, lastSyncDate, cursor, async (progress) => {
        console.log(`Strava import ${jobId}: Progress update`, progress);

        // Update cursor if we have timestamp
        if (progress.oldestActivityTimestamp) {
          await ImportJob.updateCursor(jobId, {
            before: progress.oldestActivityTimestamp,
            activities_imported: progress.inserted || 0,
            photos_imported: 0
          });
        }

        await ImportJob.update(jobId, {
          totalImported: progress.inserted || 0,
          currentBatch: progress.detailed || 0
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

    if (error.name === 'RateLimitError') {
      // Don't fail - schedule retry
      console.log(`[STRAVA JOB] Rate limit hit (${error.window}). Auto-retry at ${error.retryAfter}`);

      await ImportJob.markRateLimited(jobId, error.retryAfter);

      // Schedule delayed retry via pg-boss
      // NOTE: We don't use singletonKey here because:
      // 1. The current job is still 'active' when we call boss.send()
      // 2. pg-boss deduplicates active jobs with same singletonKey
      // 3. This was causing retry jobs to be silently dropped
      const retryDate = new Date(error.retryAfter);
      const delayMs = Math.max(0, retryDate - new Date());
      const boss = getQueue();
      await boss.send('import-strava-data', job.data, {
        startAfter: retryDate
      });

      console.log(`[STRAVA JOB] Scheduled retry in ${Math.round(delayMs / 1000)} seconds`);
      return; // Exit cleanly, no throw
    }

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    // CRITICAL: Don't re-throw rate limit errors - they need permanent failure, not retry
    // Rate limits will not be resolved by retrying immediately
    if (error.message && error.message.includes('Rate limit')) {
      console.log(`[STRAVA JOB] Rate limit error - not retrying job ${jobId}`);
      return; // Exit cleanly so pg-boss doesn't retry
    }

    // For other errors, re-throw to trigger pg-boss retry
    throw error;
  }
}

module.exports = importStravaDataHandler;
