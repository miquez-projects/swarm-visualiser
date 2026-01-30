const dailySyncOrchestrator = require('./dailySyncOrchestrator');

let boss = null;

/**
 * Initialize pg-boss job queue
 * @returns {Promise<PgBoss>}
 */
async function initQueue() {
  if (boss) {
    return boss;
  }

  // pg-boss v12+ is ESM-only, use dynamic import for CommonJS compatibility
  const { PgBoss } = await import('pg-boss');

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    // Run maintenance every 10 minutes
    maintenanceIntervalSeconds: 600,
    // Delete completed jobs after 1 day
    retentionDays: 1,
    // Monitor state changes every 60 seconds (was 10)
    monitorStateIntervalSeconds: 60,
    // Disable scheduler polling (we only have one scheduled job)
    noScheduling: false,
    // Retry configuration
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  boss.on('error', error => {
    console.error('pg-boss error:', error);
  });

  boss.on('monitor-states', states => {
    if (states.created || states.active || states.failed) {
      console.log('Job queue states:', states);
    }
  });

  await boss.start();
  console.log('pg-boss job queue started');

  // Create queues (required in pg-boss v10+)
  await boss.createQueue('daily-sync-orchestrator');
  await boss.createQueue('import-checkins');
  await boss.createQueue('import-strava-data');
  console.log('Created job queues');

  // Register daily sync orchestrator handler
  await boss.work('daily-sync-orchestrator', dailySyncOrchestrator);
  console.log('Registered handler: daily-sync-orchestrator');

  // Schedule daily sync at 2:00 AM UTC
  await boss.schedule('daily-sync-orchestrator', '0 2 * * *', {}, { tz: 'UTC' });
  console.log('Scheduled daily-sync-orchestrator: 2:00 AM UTC daily');

  return boss;
}

/**
 * Get the job queue instance
 * @returns {PgBoss}
 */
function getQueue() {
  if (!boss) {
    throw new Error('Job queue not initialized. Call initQueue() first.');
  }
  return boss;
}

/**
 * Stop the job queue (for graceful shutdown)
 * @returns {Promise<void>}
 */
async function stopQueue() {
  if (boss) {
    await boss.stop();
    boss = null;
    console.log('pg-boss job queue stopped');
  }
}

module.exports = {
  initQueue,
  getQueue,
  stopQueue
};
