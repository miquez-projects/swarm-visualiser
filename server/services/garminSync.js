const garminAuth = require('./garminAuth');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

class GarminSyncService {
  /**
   * Sync activities from Garmin
   * @param {GarminConnect} client - Authenticated Garmin client
   * @param {number} userId - User ID
   * @param {Date|null} afterDate - Only sync activities after this date (incremental sync)
   * @param {function} onProgress - Progress callback
   */
  async syncActivities(client, userId, afterDate = null, onProgress = null) {
    let start = 0;
    const limit = 50; // Activities per page
    let hasMore = true;
    let totalImported = 0;
    let totalFetched = 0;

    console.log(`[GARMIN SYNC] Starting activity sync for user ${userId}, afterDate: ${afterDate}`);

    while (hasMore) {
      try {
        const activities = await client.getActivities(start, limit);

        if (activities.length === 0) {
          console.log(`[GARMIN SYNC] No more activities to fetch`);
          hasMore = false;
          break;
        }

        totalFetched += activities.length;

        // Filter activities by date if afterDate provided
        const activitiesToInsert = [];
        for (const activity of activities) {
          const activityDate = new Date(activity.startTimeGMT);

          // If we've gone past the afterDate, stop fetching more
          if (afterDate && activityDate < afterDate) {
            console.log(`[GARMIN SYNC] Reached activities before ${afterDate}, stopping`);
            hasMore = false;
            break;
          }

          // Transform and queue for insertion
          const activityData = this.transformActivity(activity, userId);
          activitiesToInsert.push(activityData);
        }

        // Insert activities in bulk
        if (activitiesToInsert.length > 0) {
          const insertedCount = await GarminActivity.bulkInsert(activitiesToInsert);
          totalImported += insertedCount;

          console.log(`[GARMIN SYNC] Batch: fetched ${activities.length}, inserted ${insertedCount}, total imported: ${totalImported}/${totalFetched}`);

          // Report progress
          if (onProgress) {
            await onProgress({
              totalFetched,
              totalImported,
              batch: Math.floor(start / limit) + 1
            });
          }
        }

        start += activities.length;

        // Safety limit to prevent infinite loops
        if (start >= 10000) {
          console.log(`[GARMIN SYNC] Reached safety limit of 10,000 activities`);
          hasMore = false;
        }
      } catch (error) {
        console.error(`[GARMIN SYNC] Error fetching activities at offset ${start}:`, error.message);
        throw error;
      }
    }

    console.log(`[GARMIN SYNC] Activity sync complete: ${totalImported} imported, ${totalFetched} fetched`);

    return { imported: totalImported, fetched: totalFetched };
  }

  /**
   * Sync daily metrics (steps, heart rate, sleep) for a date range
   * @param {GarminConnect} client - Authenticated Garmin client
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {function} onProgress - Progress callback
   */
  async syncDailyMetrics(client, userId, startDate, endDate, onProgress = null) {
    console.log(`[GARMIN SYNC] Syncing daily metrics from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const stepsArray = [];
    const hrArray = [];
    const sleepArray = [];

    let currentDate = new Date(startDate);
    let daysProcessed = 0;
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      try {
        // Fetch steps
        const stepsData = await client.getSteps(dateStr);
        if (stepsData && stepsData.totalSteps) {
          stepsArray.push({
            user_id: userId,
            date: dateStr,
            step_count: stepsData.totalSteps
          });
        }
      } catch (err) {
        console.error(`[GARMIN SYNC] Failed to fetch steps for ${dateStr}:`, err.message);
      }

      try {
        // Fetch heart rate
        const hrData = await client.getHeartRate(dateStr);
        if (hrData) {
          hrArray.push({
            user_id: userId,
            date: dateStr,
            min_heart_rate: hrData.minHeartRate,
            max_heart_rate: hrData.maxHeartRate,
            resting_heart_rate: hrData.restingHeartRate
          });
        }
      } catch (err) {
        console.error(`[GARMIN SYNC] Failed to fetch heart rate for ${dateStr}:`, err.message);
      }

      try {
        // Fetch sleep
        const sleepData = await client.getSleepData(dateStr);
        if (sleepData && sleepData.dailySleepDTO) {
          const sleep = sleepData.dailySleepDTO;
          sleepArray.push({
            user_id: userId,
            date: dateStr,
            sleep_duration_seconds: sleep.sleepTimeSeconds,
            sleep_score: sleep.sleepScores?.overall?.value,
            deep_sleep_seconds: sleep.deepSleepSeconds,
            light_sleep_seconds: sleep.lightSleepSeconds,
            rem_sleep_seconds: sleep.remSleepSeconds,
            awake_seconds: sleep.awakeSleepSeconds
          });
        }
      } catch (err) {
        console.error(`[GARMIN SYNC] Failed to fetch sleep for ${dateStr}:`, err.message);
      }

      daysProcessed++;

      // Report progress every 7 days
      if (onProgress && daysProcessed % 7 === 0) {
        await onProgress({
          daysProcessed,
          totalDays,
          currentDate: dateStr
        });
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Bulk insert all metrics
    let totalInserted = 0;

    if (stepsArray.length > 0) {
      const stepsInserted = await GarminDailySteps.bulkUpsert(stepsArray);
      totalInserted += stepsInserted;
      console.log(`[GARMIN SYNC] Inserted ${stepsInserted} daily steps records`);
    }

    if (hrArray.length > 0) {
      const hrInserted = await GarminDailyHeartRate.bulkUpsert(hrArray);
      totalInserted += hrInserted;
      console.log(`[GARMIN SYNC] Inserted ${hrInserted} daily heart rate records`);
    }

    if (sleepArray.length > 0) {
      const sleepInserted = await GarminDailySleep.bulkUpsert(sleepArray);
      totalInserted += sleepInserted;
      console.log(`[GARMIN SYNC] Inserted ${sleepInserted} daily sleep records`);
    }

    return { daysProcessed, totalInserted };
  }

  /**
   * Transform Garmin activity to our database format
   */
  transformActivity(activity, userId) {
    // Transform tracklog if exists
    let tracklog = null;
    if (activity.geo?.geoPoints && activity.geo.geoPoints.length > 0) {
      const lineString = activity.geo.geoPoints
        .map(p => `${p.lon} ${p.lat}`)
        .join(',');
      tracklog = `LINESTRING(${lineString})`;
    }

    return {
      user_id: userId,
      garmin_activity_id: String(activity.activityId),
      activity_type: activity.activityType?.typeKey,
      activity_name: activity.activityName,
      start_time: new Date(activity.startTimeGMT),
      duration_seconds: activity.duration,
      distance_meters: activity.distance,
      calories: activity.calories,
      avg_heart_rate: activity.averageHR,
      max_heart_rate: activity.maxHR,
      tracklog,
      garmin_url: `https://connect.garmin.com/modern/activity/${activity.activityId}`
    };
  }

  /**
   * Full historical sync (for first-time setup)
   * @param {string} encryptedToken - Encrypted Garmin session token
   * @param {number} userId - User ID
   * @param {number} yearsBack - How many years of history to sync
   * @param {function} onProgress - Progress callback
   */
  async fullHistoricalSync(encryptedToken, userId, yearsBack = 5, onProgress = null) {
    const client = await garminAuth.getClient(encryptedToken);

    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);

    console.log(`[GARMIN SYNC] Starting full historical sync (${yearsBack} years)`);

    // Sync activities
    const activityResult = await this.syncActivities(client, userId, startDate, onProgress);

    // Sync daily metrics
    const metricsResult = await this.syncDailyMetrics(client, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }

  /**
   * Incremental sync (for subsequent syncs)
   * Uses last_garmin_sync_at to determine where to start
   * CRITICAL: Goes back 7 days to catch any missed data
   */
  async incrementalSync(encryptedToken, userId, lastSyncDate, onProgress = null) {
    const client = await garminAuth.getClient(encryptedToken);

    // Go back 7 days from last sync to catch any missed data
    const startDate = lastSyncDate ? new Date(lastSyncDate) : new Date();
    startDate.setDate(startDate.getDate() - 7);

    const today = new Date();

    console.log(`[GARMIN SYNC] Starting incremental sync from ${startDate.toISOString().split('T')[0]}`);

    // Sync activities
    const activityResult = await this.syncActivities(client, userId, startDate, onProgress);

    // Sync daily metrics for last 7 days
    const metricsResult = await this.syncDailyMetrics(client, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }
}

module.exports = new GarminSyncService();
