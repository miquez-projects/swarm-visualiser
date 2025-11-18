/**
 * Backfill timezone data for existing check-ins and activities
 *
 * This script populates the timezone column for all existing records
 * that have lat/lng coordinates but no timezone set.
 *
 * Usage: node server/scripts/backfill-timezones.js
 */

const db = require('../db/connection');
const { getTimezoneFromCoordinates, getTimezoneFromPoint } = require('../utils/timezoneUtils');

async function backfillCheckins() {
  console.log('[BACKFILL] Starting check-ins timezone backfill...');

  // Get all check-ins with coordinates but no timezone
  const result = await db.query(`
    SELECT id, latitude, longitude
    FROM checkins
    WHERE timezone IS NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY id
  `);

  const checkins = result.rows;
  console.log(`[BACKFILL] Found ${checkins.length} check-ins to process`);

  let updated = 0;
  let failed = 0;

  for (const checkin of checkins) {
    try {
      const timezone = getTimezoneFromCoordinates(checkin.latitude, checkin.longitude);

      if (timezone) {
        await db.query(
          'UPDATE checkins SET timezone = $1 WHERE id = $2',
          [timezone, checkin.id]
        );
        updated++;

        if (updated % 100 === 0) {
          console.log(`[BACKFILL] Processed ${updated}/${checkins.length} check-ins...`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[BACKFILL] Error processing checkin ${checkin.id}:`, error.message);
      failed++;
    }
  }

  console.log(`[BACKFILL] Check-ins complete: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

async function backfillStravaActivities() {
  console.log('[BACKFILL] Starting Strava activities timezone backfill...');

  // Get all Strava activities with start coordinates but no timezone
  // Use ST_AsText to convert geography to WKT string
  const result = await db.query(`
    SELECT id, ST_AsText(start_latlng) as start_point
    FROM strava_activities
    WHERE timezone IS NULL
      AND start_latlng IS NOT NULL
    ORDER BY id
  `);

  const activities = result.rows;
  console.log(`[BACKFILL] Found ${activities.length} Strava activities to process`);

  let updated = 0;
  let failed = 0;

  for (const activity of activities) {
    try {
      // start_point is now WKT format like "POINT(-0.085338 51.480057)"
      const timezone = getTimezoneFromPoint(activity.start_point);

      if (timezone) {
        await db.query(
          'UPDATE strava_activities SET timezone = $1 WHERE id = $2',
          [timezone, activity.id]
        );
        updated++;

        if (updated % 100 === 0) {
          console.log(`[BACKFILL] Processed ${updated}/${activities.length} Strava activities...`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[BACKFILL] Error processing Strava activity ${activity.id}:`, error.message);
      failed++;
    }
  }

  console.log(`[BACKFILL] Strava activities complete: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

async function backfillGarminActivities() {
  console.log('[BACKFILL] Starting Garmin activities timezone backfill...');

  // Get all Garmin activities with tracklog but no timezone
  // Cast geography to geometry, then get start point, then convert to WKT
  const result = await db.query(`
    SELECT id, ST_AsText(ST_StartPoint(tracklog::geometry)) as start_point
    FROM garmin_activities
    WHERE timezone IS NULL
      AND tracklog IS NOT NULL
    ORDER BY id
  `);

  const activities = result.rows;
  console.log(`[BACKFILL] Found ${activities.length} Garmin activities to process`);

  let updated = 0;
  let failed = 0;

  for (const activity of activities) {
    try {
      // start_point is WKT format like "POINT(-0.085338 51.480057)"
      const timezone = getTimezoneFromPoint(activity.start_point);

      if (timezone) {
        await db.query(
          'UPDATE garmin_activities SET timezone = $1 WHERE id = $2',
          [timezone, activity.id]
        );
        updated++;

        if (updated % 100 === 0) {
          console.log(`[BACKFILL] Processed ${updated}/${activities.length} Garmin activities...`);
        }
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[BACKFILL] Error processing Garmin activity ${activity.id}:`, error.message);
      failed++;
    }
  }

  console.log(`[BACKFILL] Garmin activities complete: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}

async function main() {
  try {
    console.log('[BACKFILL] ========================================');
    console.log('[BACKFILL] Starting timezone backfill process');
    console.log('[BACKFILL] ========================================\n');

    const checkinStats = await backfillCheckins();
    console.log('');

    const stravaStats = await backfillStravaActivities();
    console.log('');

    const garminStats = await backfillGarminActivities();
    console.log('');

    console.log('[BACKFILL] ========================================');
    console.log('[BACKFILL] Backfill complete!');
    console.log('[BACKFILL] ========================================');
    console.log(`[BACKFILL] Check-ins:         ${checkinStats.updated} updated, ${checkinStats.failed} failed`);
    console.log(`[BACKFILL] Strava activities: ${stravaStats.updated} updated, ${stravaStats.failed} failed`);
    console.log(`[BACKFILL] Garmin activities: ${garminStats.updated} updated, ${garminStats.failed} failed`);
    console.log(`[BACKFILL] Total:             ${checkinStats.updated + stravaStats.updated + garminStats.updated} updated`);

    process.exit(0);
  } catch (error) {
    console.error('[BACKFILL] Fatal error:', error);
    process.exit(1);
  }
}

main();
