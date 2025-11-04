#!/usr/bin/env node
require('dotenv').config();
const { getQueue } = require('./jobs/queue');

/**
 * Test script to manually trigger the daily sync orchestrator
 * Usage: node server/test-daily-sync.js
 */

async function triggerDailySync() {
  try {
    console.log('Manually triggering daily sync orchestrator...');

    const queue = getQueue();

    // Send the orchestrator job
    const jobId = await queue.send('daily-sync-orchestrator', {});

    console.log(`✅ Daily sync orchestrator job queued!`);
    console.log(`   Job ID: ${jobId}`);
    console.log('');
    console.log('📊 Monitor the logs to see:');
    console.log('   - [DAILY-SYNC] Orchestrator started');
    console.log('   - [DAILY-SYNC] Found N active users');
    console.log('   - [DAILY-SYNC] Queued user X...');
    console.log('   - [DAILY-SYNC] Orchestrator completed');
    console.log('');
    console.log('⏱️  Import jobs will start executing immediately and stagger over ~10 minutes');

    // Keep process alive briefly to see initial logs
    setTimeout(() => {
      console.log('\n✨ Test script complete. Check your server logs for progress.');
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Failed to trigger daily sync:', error);
    process.exit(1);
  }
}

triggerDailySync();
