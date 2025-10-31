const User = require('../models/user');
const ImportJob = require('../models/importJob');
const Checkin = require('../models/checkin');
const { decrypt } = require('../services/encryption');
const { fetchCheckins, transformCheckin } = require('../services/foursquare');

/**
 * Background job handler for importing check-ins from Foursquare
 * @param {Object} job - pg-boss job object
 * @param {number} job.data.jobId - Import job ID
 * @param {number} job.data.userId - User ID
 */
async function importCheckinsHandler(job) {
  const { jobId, userId } = job.data;

  console.log(`Starting import job ${jobId} for user ${userId}`);

  try {
    // Mark job as started
    await ImportJob.markStarted(jobId);

    // Get user with encrypted access token
    const user = await User.findById(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.access_token_encrypted) {
      throw new Error('User has no access token');
    }

    // Decrypt access token
    const accessToken = decrypt(user.access_token_encrypted);

    // Determine if this is incremental sync
    const afterTimestamp = user.last_sync_at ? new Date(user.last_sync_at) : null;

    console.log(`Fetching check-ins for user ${userId}${afterTimestamp ? ` after ${afterTimestamp}` : ' (all time)'}`);

    // Fetch check-ins from Foursquare with progress callback
    const foursquareCheckins = await fetchCheckins(accessToken, {
      afterTimestamp,
      onProgress: async (progress) => {
        console.log(`Import ${jobId}: Batch ${progress.batch}, ${progress.totalFetched}/${progress.totalExpected} check-ins`);

        // Update job progress
        await ImportJob.update(jobId, {
          totalExpected: progress.totalExpected,
          totalImported: progress.totalFetched,
          currentBatch: progress.batch
        });
      }
    });

    console.log(`Fetched ${foursquareCheckins.length} check-ins from Foursquare`);

    if (foursquareCheckins.length === 0) {
      console.log(`No new check-ins to import for user ${userId}`);
      await ImportJob.markCompleted(jobId);
      await User.updateLastSync(userId);
      return;
    }

    // Transform check-ins to our database format
    const checkins = foursquareCheckins.map(fc => transformCheckin(fc, userId));

    // Insert check-ins in batches
    const BATCH_SIZE = 1000;
    let imported = 0;

    for (let i = 0; i < checkins.length; i += BATCH_SIZE) {
      const batch = checkins.slice(i, i + BATCH_SIZE);

      try {
        await Checkin.bulkInsert(batch);
        imported += batch.length;

        console.log(`Imported batch: ${imported}/${checkins.length}`);

        // Update progress
        await ImportJob.update(jobId, {
          totalImported: imported
        });

      } catch (error) {
        // If batch insert fails, try inserting one by one to identify duplicates
        console.log('Batch insert failed, trying individual inserts...');

        for (const checkin of batch) {
          try {
            await Checkin.insert(checkin);
            imported++;
          } catch (err) {
            // Skip duplicates or other errors
            console.log(`Skipped check-in: ${err.message}`);
          }
        }

        await ImportJob.update(jobId, {
          totalImported: imported
        });
      }
    }

    console.log(`Import job ${jobId} completed: ${imported} check-ins imported`);

    // Mark job as completed
    await ImportJob.markCompleted(jobId);

    // Update user's last sync timestamp
    await User.updateLastSync(userId);

  } catch (error) {
    console.error(`Import job ${jobId} failed:`, error);

    // Mark job as failed
    await ImportJob.markFailed(jobId, error.message);

    throw error; // Re-throw so pg-boss knows it failed
  }
}

module.exports = importCheckinsHandler;
