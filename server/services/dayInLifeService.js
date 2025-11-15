const Checkin = require('../models/checkin');
const StravaActivity = require('../models/stravaActivity');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const weatherService = require('./weatherService');

/**
 * Day in Life Service
 * Aggregates all data sources for a specific date and user into a timeline
 */

/**
 * Validates date format (YYYY-MM-DD)
 * @param {string} date - Date string
 * @returns {boolean}
 */
function isValidDateFormat(date) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date);
}

/**
 * Converts a date string (YYYY-MM-DD) to start and end timestamps
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} { startTime, endTime }
 */
function getDateTimestamps(date) {
  const startTime = new Date(`${date}T00:00:00.000Z`).toISOString();
  const endTime = new Date(`${date}T23:59:59.999Z`).toISOString();
  return { startTime, endTime };
}

/**
 * Transforms check-ins into timeline items
 * @param {Array} checkins - Array of check-in objects
 * @returns {Array} Timeline items
 */
function transformCheckins(checkins) {
  return checkins.map(checkin => ({
    type: 'checkin',
    time: checkin.checkin_date,
    data: checkin
  }));
}

/**
 * Transforms Strava activities into timeline items
 * @param {Array} activities - Array of Strava activity objects
 * @returns {Array} Timeline items
 */
function transformStravaActivities(activities) {
  return activities.map(activity => ({
    type: 'strava_activity',
    time: activity.start_time,
    data: activity
  }));
}

/**
 * Transforms Garmin activities into timeline items
 * @param {Array} activities - Array of Garmin activity objects
 * @returns {Array} Timeline items
 */
function transformGarminActivities(activities) {
  return activities.map(activity => ({
    type: 'garmin_activity',
    time: activity.start_time,
    data: activity
  }));
}

/**
 * Sorts timeline items by time (ascending)
 * @param {Array} timeline - Array of timeline items
 * @returns {Array} Sorted timeline
 */
function sortTimeline(timeline) {
  return timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Gets aggregated day in life data for a specific user and date
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} latitude - Optional latitude for weather data
 * @param {number} longitude - Optional longitude for weather data
 * @returns {Promise<Object>} Aggregated day in life data
 */
async function getDayInLife(userId, date, latitude = null, longitude = null) {
  // Validate required parameters
  if (!userId) {
    throw new Error('userId is required');
  }

  if (!date) {
    throw new Error('date is required');
  }

  // Validate date format
  if (!isValidDateFormat(date)) {
    throw new Error('Invalid date format: must be YYYY-MM-DD');
  }

  // Get date range timestamps for activities
  const { startTime, endTime } = getDateTimestamps(date);

  try {
    // Fetch all data in parallel
    const [
      checkinsResult,
      stravaActivities,
      garminActivities,
      dailySteps,
      dailyHeartRate,
      dailySleep,
      weather
    ] = await Promise.allSettled([
      // Check-ins (uses startDate/endDate filters)
      Checkin.find({
        userId,
        startDate: startTime,
        endDate: endTime
      }),

      // Strava activities
      StravaActivity.findByUserAndDateRange(userId, startTime, endTime),

      // Garmin activities
      GarminActivity.findByUserAndDateRange(userId, startTime, endTime),

      // Daily metrics (use date format YYYY-MM-DD)
      GarminDailySteps.findByUserAndDateRange(userId, date, date),
      GarminDailyHeartRate.findByUserAndDateRange(userId, date, date),
      GarminDailySleep.findByUserAndDateRange(userId, date, date),

      // Weather data (only if lat/lng provided)
      latitude && longitude
        ? weatherService.getHistoricalWeather(latitude, longitude, date)
        : Promise.resolve(null)
    ]);

    // Extract data from settled promises
    const checkins = checkinsResult.status === 'fulfilled' ? checkinsResult.value.data : [];
    const stravaData = stravaActivities.status === 'fulfilled' ? stravaActivities.value : [];
    const garminData = garminActivities.status === 'fulfilled' ? garminActivities.value : [];
    const stepsData = dailySteps.status === 'fulfilled' ? dailySteps.value : [];
    const heartRateData = dailyHeartRate.status === 'fulfilled' ? dailyHeartRate.value : [];
    const sleepData = dailySleep.status === 'fulfilled' ? dailySleep.value : [];
    const weatherData = weather.status === 'fulfilled' ? weather.value : null;

    // Build timeline by combining all time-based events
    const timeline = [
      ...transformCheckins(checkins),
      ...transformStravaActivities(stravaData),
      ...transformGarminActivities(garminData)
    ];

    // Sort timeline by time
    const sortedTimeline = sortTimeline(timeline);

    // Return aggregated data
    return {
      date,
      timeline: sortedTimeline,
      dailyMetrics: {
        steps: stepsData[0] || null,
        heartRate: heartRateData[0] || null,
        sleep: sleepData[0] || null
      },
      weather: weatherData
    };
  } catch (error) {
    throw new Error(`Failed to aggregate day in life data: ${error.message}`);
  }
}

module.exports = {
  getDayInLife
};
