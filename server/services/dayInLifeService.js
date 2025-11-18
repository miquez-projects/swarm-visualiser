const db = require('../db/connection');
const weatherService = require('./weatherService');
const staticMapGenerator = require('./staticMapGenerator');
const DailyWeather = require('../models/dailyWeather');
const Checkin = require('../models/checkin');
const StravaActivity = require('../models/stravaActivity');
const GarminActivity = require('../models/garminActivity');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const GarminDailyCalories = require('../models/garminDailyCalories');

/**
 * Day in Life Service
 * Aggregates all data sources for a specific date and user into a timeline with event grouping
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
 * Find the most common value in an array
 * @param {Array} arr - Array of values
 * @returns {*} Most common value
 */
function mostCommon(arr) {
  return arr.sort((a, b) =>
    arr.filter(v => v === a).length - arr.filter(v => v === b).length
  ).pop();
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
      dailyCalories,
      weather
    ] = await Promise.allSettled([
      // Check-ins (uses localDate filter to get all check-ins on this local date regardless of timezone)
      Checkin.find({
        userId,
        localDate: date  // Use local date instead of UTC timestamps
      }),

      // Strava activities (use local date to match check-ins)
      StravaActivity.findByUserAndDateRange(userId, date),

      // Garmin activities (use local date to match check-ins)
      GarminActivity.findByUserAndDateRange(userId, date),

      // Daily metrics (use date format YYYY-MM-DD)
      GarminDailySteps.findByUserAndDateRange(userId, date, date),
      GarminDailyHeartRate.findByUserAndDateRange(userId, date, date),
      GarminDailySleep.findByUserAndDateRange(userId, date, date),
      GarminDailyCalories.findByUserAndDateRange(userId, date, date),

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
    const caloriesData = dailyCalories.status === 'fulfilled' ? dailyCalories.value : [];
    const weatherData = weather.status === 'fulfilled' ? weather.value : null;

    // Combine activities from both sources
    const allActivities = [...stravaData, ...garminData];

    // Get weather with caching
    const weatherResult = await getWeather(userId, date, checkins);

    // Calculate properties
    const properties = {
      weather: weatherResult,
      sleep: sleepData[0] ? {
        duration: sleepData[0].sleep_duration_seconds,
        score: sleepData[0].sleep_score
      } : null,
      steps: stepsData[0] ? {
        count: stepsData[0].step_count
      } : null,
      checkins: { count: checkins.length },
      activities: { count: allActivities.length },
      heartRate: heartRateData[0] ? {
        min: heartRateData[0].min_heart_rate,
        max: heartRateData[0].max_heart_rate
      } : null,
      calories: caloriesData[0] ? {
        total: caloriesData[0].total_calories
      } : null
    };

    // Generate events with grouping
    const events = await generateEvents(checkins, allActivities);

    // Build timeline by combining all time-based events (legacy format for compatibility)
    const timeline = [
      ...checkins.map(c => ({ type: 'checkin', time: c.checkin_date, data: c })),
      ...stravaData.map(a => ({ type: 'strava_activity', time: a.start_time, data: a })),
      ...garminData.map(a => ({ type: 'garmin_activity', time: a.start_time, data: a }))
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    // Transform daily metrics to match frontend expectations (legacy)
    const transformedMetrics = {};

    if (stepsData[0] && stepsData[0].step_count !== null && stepsData[0].step_count !== undefined) {
      transformedMetrics.steps = stepsData[0].step_count;
    }

    if (heartRateData[0]) {
      const hr = heartRateData[0];
      const validValues = [];
      if (hr.min_heart_rate !== null && hr.min_heart_rate !== undefined) validValues.push(hr.min_heart_rate);
      if (hr.max_heart_rate !== null && hr.max_heart_rate !== undefined) validValues.push(hr.max_heart_rate);
      if (hr.resting_heart_rate !== null && hr.resting_heart_rate !== undefined) validValues.push(hr.resting_heart_rate);

      if (validValues.length > 0) {
        transformedMetrics.avgHeartRate = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
      }
    }

    if (sleepData[0] && sleepData[0].sleep_duration_seconds !== null && sleepData[0].sleep_duration_seconds !== undefined) {
      transformedMetrics.sleepHours = sleepData[0].sleep_duration_seconds / 3600;
    }

    transformedMetrics.activities = allActivities.length;

    // Return both formats
    return {
      date,
      // New format
      properties,
      events,
      // Legacy format
      timeline,
      dailyMetrics: transformedMetrics,
      weather: weatherData
    };
  } catch (error) {
    throw new Error(`Failed to aggregate day in life data: ${error.message}`);
  }
}

/**
 * Gets weather with database caching
 * @param {string} userId - User ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {Array} checkins - Array of check-ins for the day
 * @returns {Promise<Object|null>} Weather data
 */
async function getWeather(userId, date, checkins) {
  if (checkins.length === 0) return null;

  // Use most common country
  const countries = checkins.map(c => c.country).filter(Boolean);
  if (countries.length === 0) return null;

  const primaryCountry = mostCommon(countries);

  // Check cache
  const cached = await DailyWeather.findByDateAndLocation(date, primaryCountry);

  if (cached) {
    return {
      temp: cached.temp_celsius,
      condition: cached.condition,
      icon: cached.weather_icon,
      country: cached.country
    };
  }

  // Fetch from API using first checkin's coordinates
  const firstCheckin = checkins[0];
  const weatherData = await weatherService.getHistoricalWeather(
    firstCheckin.latitude,
    firstCheckin.longitude,
    date
  );

  if (!weatherData) return null;

  // Cache it
  const avgTemp = (weatherData.temperature_max + weatherData.temperature_min) / 2;
  await DailyWeather.upsert({
    date,
    country: primaryCountry,
    region: null,
    temp_celsius: Math.round(avgTemp),
    condition: weatherData.weather_description,
    weather_icon: weatherService.conditionToIcon(weatherData.weather_description)
  });

  return {
    temp: Math.round(avgTemp),
    condition: weatherData.weather_description,
    icon: weatherService.conditionToIcon(weatherData.weather_description),
    country: primaryCountry
  };
}

/**
 * Generates events with smart grouping
 * CRITICAL: Check-ins during mapped activities are merged with the activity.
 * Standalone check-ins are grouped together. Each activity is displayed individually.
 * @param {Array} checkins - Array of check-in objects
 * @param {Array} activities - Array of activity objects (Strava and Garmin combined)
 * @returns {Promise<Array>} Array of event objects
 */
async function generateEvents(checkins, activities) {
  // First pass: assign check-ins to activities
  const mappedActivities = activities
    .filter(a => !!a.tracklog)
    .map(a => ({
      ...a,
      startTime: new Date(a.start_time),
      endTime: new Date(new Date(a.start_time).getTime() + (a.duration_seconds || 0) * 1000),
      source: a.strava_activity_id ? 'strava' : 'garmin',
      checkins: []
    }));

  const unmappedActivities = activities
    .filter(a => !a.tracklog)
    .map(a => ({
      ...a,
      startTime: new Date(a.start_time),
      source: a.strava_activity_id ? 'strava' : 'garmin'
    }));

  // Assign check-ins to activities or standalone groups
  const standAloneCheckins = [];

  for (const checkin of checkins) {
    const checkinTime = new Date(checkin.checkin_date);

    // Find if this check-in falls within any mapped activity
    const containingActivity = mappedActivities.find(
      a => checkinTime >= a.startTime && checkinTime <= a.endTime
    );

    if (containingActivity) {
      containingActivity.checkins.push(checkin);
    } else {
      standAloneCheckins.push(checkin);
    }
  }

  // Second pass: create events in chronological order
  const allEvents = [
    ...mappedActivities.map(a => ({ type: 'mapped_activity', time: a.startTime, data: a })),
    ...unmappedActivities.map(a => ({ type: 'unmapped_activity', time: a.startTime, data: a })),
    ...standAloneCheckins.map(c => ({ type: 'checkin', time: new Date(c.checkin_date), data: c }))
  ].sort((a, b) => a.time - b.time);

  // Group standalone check-ins
  const events = [];
  let currentCheckinGroup = [];

  for (const event of allEvents) {
    if (event.type === 'checkin') {
      currentCheckinGroup.push(event.data);
    } else {
      // Activity interrupts check-in grouping
      if (currentCheckinGroup.length > 0) {
        events.push(await createCheckinEvent(currentCheckinGroup));
        currentCheckinGroup = [];
      }

      if (event.type === 'mapped_activity') {
        if (event.data.checkins.length > 0) {
          events.push(await createActivityWithCheckinsEvent(event.data, event.data.source, event.data.checkins));
        } else {
          events.push(await createActivityEvent(event.data, event.data.source));
        }
      } else {
        events.push(await createActivityEvent(event.data, event.data.source));
      }
    }
  }

  // Add remaining checkins
  if (currentCheckinGroup.length > 0) {
    events.push(await createCheckinEvent(currentCheckinGroup));
  }

  return events;
}

/**
 * Creates a check-in event with photos and static map
 * @param {Array} checkins - Array of check-in objects
 * @returns {Promise<Object>} Check-in event object
 */
async function createCheckinEvent(checkins) {
  // Get photos for these checkins
  const checkinIds = checkins.map(c => c.id);
  const photosQuery = `
    SELECT checkin_id, photo_url, photo_url_cached
    FROM checkin_photos
    WHERE checkin_id = ANY($1)
  `;
  const photosResult = await db.query(photosQuery, [checkinIds]);
  const photosByCheckin = photosResult.rows.reduce((acc, p) => {
    if (!acc[p.checkin_id]) acc[p.checkin_id] = [];
    acc[p.checkin_id].push(p);
    return acc;
  }, {});

  return {
    type: 'checkin_group',
    startTime: checkins[0].checkin_date,
    checkins: checkins.map(c => ({
      ...c,
      photos: photosByCheckin[c.id] || []
    })),
    staticMapUrl: staticMapGenerator.generateCheckinMapUrl(checkins)
  };
}

/**
 * Creates an activity event with static map
 * @param {Object} activity - Activity object (Strava or Garmin)
 * @param {string} source - 'strava' or 'garmin'
 * @returns {Promise<Object>} Activity event object
 */
async function createActivityEvent(activity, source) {
  // Determine if activity is mapped (has GPS track data)
  // Both Strava and Garmin use 'tracklog' field (WKT LINESTRING format)
  const trackData = activity.tracklog;
  const isMapped = !!trackData;

  return {
    type: isMapped ? `${source}_activity_mapped` : `${source}_activity_unmapped`,
    startTime: activity.start_time,
    activity: {
      id: activity.id,
      type: activity.activity_type,
      name: activity.activity_name,
      duration: activity.duration_seconds,
      distance: activity.distance_meters,
      calories: activity.calories,
      url: source === 'strava'
        ? (activity.strava_activity_id ? `https://www.strava.com/activities/${activity.strava_activity_id}` : null)
        : activity.garmin_url
    },
    staticMapUrl: isMapped
      ? staticMapGenerator.generateActivityMapUrl(trackData)
      : null
  };
}

/**
 * Creates an activity event with check-ins merged
 * @param {Object} activity - Activity object (Strava or Garmin) with tracklog
 * @param {string} source - 'strava' or 'garmin'
 * @param {Array} checkins - Array of check-in objects that occurred during the activity
 * @returns {Promise<Object>} Activity with check-ins event object
 */
async function createActivityWithCheckinsEvent(activity, source, checkins) {
  // Get photos for these checkins
  const checkinIds = checkins.map(c => c.id);
  const photosQuery = `
    SELECT checkin_id, photo_url, photo_url_cached
    FROM checkin_photos
    WHERE checkin_id = ANY($1)
  `;
  const photosResult = await db.query(photosQuery, [checkinIds]);
  const photosByCheckin = photosResult.rows.reduce((acc, p) => {
    if (!acc[p.checkin_id]) acc[p.checkin_id] = [];
    acc[p.checkin_id].push(p);
    return acc;
  }, {});

  // Enrich checkins with photos
  const enrichedCheckins = checkins.map(c => ({
    ...c,
    photos: photosByCheckin[c.id] || []
  }));

  // Generate combined map: activity tracklog + check-in markers
  const staticMapUrl = staticMapGenerator.generateActivityWithCheckinsMapUrl(
    activity.tracklog,
    checkins // Just coordinates needed
  );

  return {
    type: `${source}_activity_with_checkins_mapped`,
    startTime: activity.start_time,
    activity: {
      id: activity.id,
      type: activity.activity_type,
      name: activity.activity_name,
      duration: activity.duration_seconds,
      distance: activity.distance_meters,
      calories: activity.calories,
      url: source === 'strava'
        ? (activity.strava_activity_id ? `https://www.strava.com/activities/${activity.strava_activity_id}` : null)
        : activity.garmin_url
    },
    checkins: enrichedCheckins,
    staticMapUrl
  };
}

module.exports = {
  getDayInLife,
  generateEvents,
  createCheckinEvent,
  createActivityEvent,
  createActivityWithCheckinsEvent
};
