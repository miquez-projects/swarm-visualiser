const axios = require('axios');

/**
 * Weather Service for fetching historical weather data from Open-Meteo API
 * https://open-meteo.com/
 */

// Cache for weather data to avoid repeated API calls
const weatherCache = new Map();

/**
 * Weather code descriptions based on WMO Weather interpretation codes
 * https://open-meteo.com/en/docs
 */
const WEATHER_CODE_DESCRIPTIONS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Drizzle: Light intensity',
  53: 'Drizzle: Moderate intensity',
  55: 'Drizzle: Dense intensity',
  56: 'Freezing Drizzle: Light intensity',
  57: 'Freezing Drizzle: Dense intensity',
  61: 'Rain: Slight intensity',
  63: 'Rain: Moderate intensity',
  65: 'Rain: Heavy intensity',
  66: 'Freezing Rain: Light intensity',
  67: 'Freezing Rain: Heavy intensity',
  71: 'Snow fall: Slight intensity',
  73: 'Snow fall: Moderate intensity',
  75: 'Snow fall: Heavy intensity',
  77: 'Snow grains',
  80: 'Rain showers: Slight intensity',
  81: 'Rain showers: Moderate intensity',
  82: 'Rain showers: Violent intensity',
  85: 'Snow showers: Slight intensity',
  86: 'Snow showers: Heavy intensity',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

/**
 * Validates input parameters
 * @param {number} latitude - Latitude (-90 to 90)
 * @param {number} longitude - Longitude (-180 to 180)
 * @param {string} date - Date in YYYY-MM-DD format
 */
function validateParameters(latitude, longitude, date) {
  // Validate latitude
  if (latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude: must be between -90 and 90');
  }

  // Validate longitude
  if (longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude: must be between -180 and 180');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Invalid date format: must be YYYY-MM-DD');
  }

  // Validate date is not in the future
  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate > today) {
    throw new Error('Date cannot be in the future');
  }
}

/**
 * Generates a cache key for the weather data
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string} Cache key
 */
function getCacheKey(latitude, longitude, startDate, endDate) {
  return `${latitude},${longitude},${startDate},${endDate}`;
}

/**
 * Gets weather description from weather code
 * @param {number} weathercode - WMO Weather code
 * @returns {string} Weather description
 */
function getWeatherDescription(weathercode) {
  return WEATHER_CODE_DESCRIPTIONS[weathercode] || 'Unknown';
}

/**
 * Fetches historical weather data for a single date
 * @param {number} latitude - Latitude of the location
 * @param {number} longitude - Longitude of the location
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Weather data for the specified date
 */
async function getHistoricalWeather(latitude, longitude, date) {
  // Validate parameters
  validateParameters(latitude, longitude, date);

  // Check cache first
  const cacheKey = getCacheKey(latitude, longitude, date, date);
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  try {
    // Fetch data from Open-Meteo API
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude,
        longitude,
        start_date: date,
        end_date: date,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
        timezone: 'auto'
      }
    });

    const { daily } = response.data;

    // Validate we have data
    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('No weather data available for the specified date');
    }

    // Extract weather data for the date
    const weatherData = {
      date: daily.time[0],
      temperature_max: daily.temperature_2m_max[0],
      temperature_min: daily.temperature_2m_min[0],
      precipitation: daily.precipitation_sum[0],
      weathercode: daily.weathercode[0],
      weather_description: getWeatherDescription(daily.weathercode[0])
    };

    // Cache the result
    weatherCache.set(cacheKey, weatherData);

    return weatherData;
  } catch (error) {
    if (error.message.includes('No weather data available')) {
      throw error;
    }
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

/**
 * Fetches historical weather data for a date range
 * @param {number} latitude - Latitude of the location
 * @param {number} longitude - Longitude of the location
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of weather data for each date in the range
 */
async function getWeatherForDateRange(latitude, longitude, startDate, endDate) {
  // Validate parameters
  validateParameters(latitude, longitude, startDate);
  validateParameters(latitude, longitude, endDate);

  // Validate end date is not before start date
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    throw new Error('End date must be after or equal to start date');
  }

  // Check cache first
  const cacheKey = getCacheKey(latitude, longitude, startDate, endDate);
  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  try {
    // Fetch data from Open-Meteo API
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude,
        longitude,
        start_date: startDate,
        end_date: endDate,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
        timezone: 'auto'
      }
    });

    const { daily } = response.data;

    // Validate we have data
    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('No weather data available for the specified date range');
    }

    // Transform data into array of daily weather objects
    const weatherData = daily.time.map((date, index) => ({
      date,
      temperature_max: daily.temperature_2m_max[index],
      temperature_min: daily.temperature_2m_min[index],
      precipitation: daily.precipitation_sum[index],
      weathercode: daily.weathercode[index],
      weather_description: getWeatherDescription(daily.weathercode[index])
    }));

    // Cache the result
    weatherCache.set(cacheKey, weatherData);

    return weatherData;
  } catch (error) {
    if (error.message.includes('No weather data available')) {
      throw error;
    }
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

/**
 * Converts weather condition description to emoji icon
 * @param {string} condition - Weather condition description
 * @returns {string} Emoji icon representing the weather condition
 */
function conditionToIcon(condition) {
  const icons = {
    'Clear sky': '☀️',
    'Partly cloudy': '🌤',
    'Cloudy': '☁️',
    'Rainy': '🌧',
    'Snowy': '🌨',
    'Thunderstorm': '⛈'
  };

  // Map our condition descriptions to icons
  const lowerCondition = condition.toLowerCase();
  if (lowerCondition.includes('clear')) return icons['Clear sky'];
  if (lowerCondition.includes('partly')) return icons['Partly cloudy'];
  if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast')) return icons['Cloudy'];
  if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) return icons['Rainy'];
  if (lowerCondition.includes('snow')) return icons['Snowy'];
  if (lowerCondition.includes('thunder')) return icons['Thunderstorm'];
  return '🌤'; // Default
}

/**
 * Clears the weather cache
 */
function clearCache() {
  weatherCache.clear();
}

module.exports = {
  getHistoricalWeather,
  getWeatherForDateRange,
  clearCache,
  conditionToIcon
};
