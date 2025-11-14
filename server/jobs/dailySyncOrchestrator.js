const User = require('../models/user');
const ImportJob = require('../models/importJob');
// Note: queue module is lazy-loaded inside the function to avoid circular dependency

/**
 * Daily sync orchestrator job handler
 * Runs once per day to queue check-in imports for all active users
 *
 * Active users = users with tokens who logged in within last 30 days
 * Jobs are staggered with 2-minute delays to respect API rate limits
 *
 * @param {Object} job - pg-boss job object
 */
async function dailySyncOrchestrator(job) {
  console.log('[DAILY-SYNC] Orchestrator started');

  try {
    // Fetch all active users
    const activeUsers = await User.findActive();

    console.log(`[DAILY-SYNC] Found ${activeUsers.length} active users`);

    if (activeUsers.length === 0) {
      console.log('[DAILY-SYNC] No active users to sync');
      return;
    }

    // Lazy-load queue module to avoid circular dependency
    const { getQueue } = require('./queue');
    const queue = getQueue();
    let queuedCount = 0;

    // Queue import job for each user with staggered delays
    // Note: For >20 active users, consider batch-fetching import jobs to reduce DB queries
    for (let i = 0; i < activeUsers.length; i++) {
      const user = activeUsers[i];
      const delayMinutes = i * 2; // 0, 2, 4, 6, 8... minutes

      // Check if user already has a running import
      // Note: On orchestrator retry, duplicate detection prevents re-queueing users
      // that still have pending/running imports from the previous attempt
      const existingJobs = await ImportJob.findByUserId(user.id);
      const runningJob = existingJobs.find(
        j => j.status === 'running' || j.status === 'pending'
      );

      if (runningJob) {
        console.log(
          `[DAILY-SYNC] Skipping user ${user.id} - import already in progress (job ${runningJob.id})`
        );
        continue;
      }

      // Create import job record
      const importJob = await ImportJob.create({
        user_id: user.id,
        data_source: 'foursquare',
        status: 'pending'
      });

      // Queue the import with delay
      await queue.send(
        'import-checkins',
        {
          jobId: importJob.id,
          userId: user.id
        },
        {
          startAfter: delayMinutes > 0 ? `${delayMinutes} minutes` : '0 seconds'
        }
      );

      queuedCount++;

      console.log(
        `[DAILY-SYNC] Queued user ${user.id} (${user.display_name || 'Unknown'}) - starts in ${delayMinutes} min`
      );
    }

    console.log(`[DAILY-SYNC] Orchestrator completed - queued ${queuedCount}/${activeUsers.length} users`);

  } catch (error) {
    console.error('[DAILY-SYNC] Orchestrator failed:', error);
    throw error; // Re-throw so pg-boss marks as failed
  }
}

module.exports = dailySyncOrchestrator;
