const User = require('../models/user');
const ImportJob = require('../models/importJob');
const Checkin = require('../models/checkin');
const CheckinPhoto = require('../models/checkinPhoto');
const db = require('../db/connection');
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
    let photosImported = 0;

    for (let i = 0; i < checkins.length; i += BATCH_SIZE) {
      const batch = checkins.slice(i, i + BATCH_SIZE);

      try {
        // Separate checkins from photos
        const checkinsToInsert = batch.map(c => {
          const { photos, ...checkinData } = c;
          return checkinData;
        });

        const insertedCount = await Checkin.bulkInsert(checkinsToInsert);
        imported += insertedCount;

        console.log(`Imported batch: ${imported}/${checkins.length} (${insertedCount} inserted, ${batch.length - insertedCount} duplicates skipped)`);

        // Update progress
        await ImportJob.update(jobId, {
          totalImported: imported
        });

      } catch (error) {
        // If batch insert fails, try inserting one by one to identify duplicates
        console.log('Batch insert failed, trying individual inserts...');

        for (const checkin of batch) {
          try {
            const { photos, ...checkinData } = checkin;
            const insertedCheckin = await Checkin.insert(checkinData);

            // Insert photos for this check-in if any
            if (photos && photos.length > 0 && insertedCheckin) {
              const photoRecords = photos.map(photo => ({
                checkin_id: insertedCheckin.id,
                photo_url: photo.url,
                width: photo.width,
                height: photo.height
              }));

              try {
                const photoCount = await CheckinPhoto.bulkInsert(photoRecords);
                photosImported += photoCount;
              } catch (photoErr) {
                console.log(`Failed to insert photos for check-in ${insertedCheckin.id}: ${photoErr.message}`);
              }
            }

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

    console.log(`Import completed: ${imported} check-ins, ${photosImported} photos`);

    // Now insert photos for successfully imported check-ins
    // We need to fetch the inserted check-in IDs
    // This is a second pass to handle bulk inserts
    console.log('Inserting photos for bulk-inserted check-ins...');

    for (const checkin of checkins) {
      if (!checkin.photos || checkin.photos.length === 0) continue;

      try {
        // Find the check-in by venue_id and date to get the database ID
        const result = await db.query(
          'SELECT id FROM checkins WHERE user_id = $1 AND venue_id = $2 AND checkin_date = $3 LIMIT 1',
          [userId, checkin.venue_id, checkin.checkin_date]
        );

        if (result.rows.length > 0) {
          const checkinId = result.rows[0].id;
          const photoRecords = checkin.photos.map(photo => ({
            checkin_id: checkinId,
            photo_url: photo.url,
            width: photo.width,
            height: photo.height
          }));

          const photoCount = await CheckinPhoto.bulkInsert(photoRecords);
          photosImported += photoCount;
        }
      } catch (err) {
        // Skip errors
        console.log(`Failed to insert photos for venue ${checkin.venue_id}: ${err.message}`);
      }
    }

    console.log(`Total photos imported: ${photosImported}`);

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
