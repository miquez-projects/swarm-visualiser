const db = require('../db/connection');

async function reset() {
  try {
    const result = await db.query("UPDATE users SET last_strava_sync_at = NULL WHERE id = 1 RETURNING id, last_strava_sync_at;");
    console.log('✅ Reset successful:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

reset();
