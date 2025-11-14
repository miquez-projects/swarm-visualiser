const garminOAuth = require('./garminOAuth');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');

class GarminSyncService {
  /**
   * Sync activities from Garmin Health API
   * CRITICAL: Implements lessons learned from Foursquare sync
   * - Only updates last_sync when items actually imported
   * - Uses bulkInsert return value, not array length
   * - 7-day lookback for incremental sync
   */
  async syncActivities(encryptedTokens, userId, afterDate = null, onProgress = null) {
    console.log(`[GARMIN SYNC] Starting activity sync for user ${userId}, afterDate: ${afterDate}`);

    const startDate = afterDate || this.getDefaultStartDate();
    const endDate = new Date();

    let allActivities = [];
    let offset = 0;
    const limit = 100;

    try {
      // Fetch activities in pages
      while (true) {
        const activities = await garminOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/activities',
          {
            uploadStartTimeInSeconds: Math.floor(startDate.getTime() / 1000),
            uploadEndTimeInSeconds: Math.floor(endDate.getTime() / 1000),
            start: offset,
            limit
          }
        );

        if (!activities || activities.length === 0) {
          break;
        }

        allActivities = allActivities.concat(activities);
        offset += activities.length;

        if (onProgress) {
          await onProgress({ fetched: allActivities.length });
        }

        // Safety limit
        if (offset >= 10000) {
          console.log(`[GARMIN SYNC] Reached safety limit`);
          break;
        }

        // No more results
        if (activities.length < limit) {
          break;
        }
      }

      // Transform and bulk insert
      const activitiesToInsert = allActivities.map(activity =>
        this.transformActivity(activity, userId)
      );

      // CRITICAL: Use bulkInsert return value, not array length
      const insertedCount = activitiesToInsert.length > 0
        ? await GarminActivity.bulkInsert(activitiesToInsert)
        : 0;

      console.log(`[GARMIN SYNC] Activity sync complete: ${insertedCount} imported, ${allActivities.length} fetched`);

      return { imported: insertedCount, fetched: allActivities.length };
    } catch (error) {
      console.error(`[GARMIN SYNC] Activity sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Sync daily metrics (steps, heart rate, sleep)
   */
  async syncDailyMetrics(encryptedTokens, userId, startDate, endDate, onProgress = null) {
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
        // Fetch daily summaries
        const summaries = await garminOAuth.makeAuthenticatedRequest(
          encryptedTokens,
          '/dailies',
          {
            uploadStartTimeInSeconds: Math.floor(currentDate.getTime() / 1000),
            uploadEndTimeInSeconds: Math.floor(currentDate.getTime() / 1000) + 86400
          }
        );

        if (summaries && summaries.length > 0) {
          const summary = summaries[0];

          // Steps
          if (summary.totalSteps) {
            stepsArray.push({
              user_id: userId,
              date: dateStr,
              step_count: summary.totalSteps
            });
          }

          // Heart Rate
          if (summary.minHeartRateInBeatsPerMinute) {
            hrArray.push({
              user_id: userId,
              date: dateStr,
              min_heart_rate: summary.minHeartRateInBeatsPerMinute,
              max_heart_rate: summary.maxHeartRateInBeatsPerMinute,
              resting_heart_rate: summary.restingHeartRateInBeatsPerMinute
            });
          }

          // Sleep
          if (summary.sleepTimeInSeconds) {
            sleepArray.push({
              user_id: userId,
              date: dateStr,
              sleep_duration_seconds: summary.sleepTimeInSeconds,
              sleep_score: summary.sleepScores?.overall?.value,
              deep_sleep_seconds: summary.deepSleepTimeInSeconds,
              light_sleep_seconds: summary.lightSleepTimeInSeconds,
              rem_sleep_seconds: summary.remSleepTimeInSeconds,
              awake_seconds: summary.awakeSleepTimeInSeconds
            });
          }
        }
      } catch (err) {
        console.error(`[GARMIN SYNC] Failed to fetch metrics for ${dateStr}:`, err.message);
      }

      daysProcessed++;

      if (onProgress && daysProcessed % 7 === 0) {
        await onProgress({ daysProcessed, totalDays });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Bulk insert all metrics
    // CRITICAL: Use bulkInsert return value
    let totalInserted = 0;

    if (stepsArray.length > 0) {
      totalInserted += await GarminDailySteps.bulkUpsert(stepsArray);
    }

    if (hrArray.length > 0) {
      totalInserted += await GarminDailyHeartRate.bulkUpsert(hrArray);
    }

    if (sleepArray.length > 0) {
      totalInserted += await GarminDailySleep.bulkUpsert(sleepArray);
    }

    console.log(`[GARMIN SYNC] Daily metrics complete: ${totalInserted} records inserted`);

    return { daysProcessed, totalInserted };
  }

  /**
   * Transform Garmin activity to database format
   */
  transformActivity(activity, userId) {
    // Build tracklog if coordinates exist
    let tracklog = null;
    if (activity.geoPolylineDTO && activity.geoPolylineDTO.polyline) {
      // Decode polyline to coordinates
      const coords = this.decodePolyline(activity.geoPolylineDTO.polyline);
      if (coords.length > 0) {
        const lineString = coords
          .map(([lat, lon]) => `${lon} ${lat}`)
          .join(',');
        tracklog = `LINESTRING(${lineString})`;
      }
    }

    return {
      user_id: userId,
      garmin_activity_id: String(activity.activityId),
      activity_type: activity.activityType?.typeKey,
      activity_name: activity.activityName,
      start_time: new Date(activity.startTimeInSeconds * 1000),
      duration_seconds: activity.durationInSeconds,
      distance_meters: activity.distanceInMeters,
      calories: activity.activeKilocalories,
      avg_heart_rate: activity.averageHeartRateInBeatsPerMinute,
      max_heart_rate: activity.maxHeartRateInBeatsPerMinute,
      tracklog,
      garmin_url: `https://connect.garmin.com/modern/activity/${activity.activityId}`
    };
  }

  /**
   * Decode Google polyline format
   */
  decodePolyline(encoded) {
    const coords = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coords.push([lat / 1e5, lng / 1e5]);
    }

    return coords;
  }

  /**
   * Full historical sync
   */
  async fullHistoricalSync(encryptedTokens, userId, yearsBack = 5, onProgress = null) {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);

    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
    const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }

  /**
   * Incremental sync with 7-day lookback
   * CRITICAL: Goes back 7 days to catch missed data
   */
  async incrementalSync(encryptedTokens, userId, lastSyncDate, onProgress = null) {
    const startDate = lastSyncDate ? new Date(lastSyncDate) : new Date();
    startDate.setDate(startDate.getDate() - 7); // CRITICAL: 7-day lookback

    const today = new Date();

    console.log(`[GARMIN SYNC] Incremental sync from ${startDate.toISOString().split('T')[0]}`);

    const activityResult = await this.syncActivities(encryptedTokens, userId, startDate, onProgress);
    const metricsResult = await this.syncDailyMetrics(encryptedTokens, userId, startDate, today, onProgress);

    return {
      success: true,
      activities: activityResult,
      dailyMetrics: metricsResult
    };
  }

  getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
  }
}

module.exports = new GarminSyncService();
