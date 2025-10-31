const PgBoss = require('pg-boss');

let boss = null;

/**
 * Initialize pg-boss job queue
 * @returns {Promise<PgBoss>}
 */
async function initQueue() {
  if (boss) {
    return boss;
  }

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    // Run maintenance every 5 minutes
    maintenanceIntervalSeconds: 300,
    // Delete completed jobs after 1 day
    retentionDays: 1,
    // Monitor state changes
    monitorStateIntervalSeconds: 10
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
