import axios from 'axios';

// API base URL from environment variable (set in Vercel)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Debug logging
console.log('API Configuration:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  API_BASE_URL: API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV
});

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for logging in development
api.interceptors.request.use(
  config => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`, config.params);
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error: No response received');
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch check-ins with filters
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Check-ins data
 */
export const getCheckins = async (filters = {}) => {
  const response = await api.get('/api/checkins', { params: filters });
  return response.data;
};

/**
 * Fetch statistics
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Statistics data
 */
export const getStats = async (filters = {}) => {
  const response = await api.get('/api/stats', { params: filters });
  return response.data;
};

/**
 * Compare two time periods
 * @param {Object} params - Comparison parameters
 * @returns {Promise<Object>} Comparison data
 */
export const compareTimePeriods = async (params) => {
  const response = await api.get('/api/stats/compare', { params });
  return response.data;
};

/**
 * Get available filter options
 * @param {Object} params - Parameters including token
 * @returns {Promise<Object>} Filter options
 */
export const getFilterOptions = async (params = {}) => {
  const response = await api.get('/api/filters/options', { params });
  return response.data;
};

/**
 * Get available years for year in review
 * @param {Object} params - Parameters including token
 * @returns {Promise<Array>} Array of years
 */
export const getAvailableYears = async (params = {}) => {
  const response = await api.get('/api/year-in-review/years', { params });
  return response.data;
};

/**
 * Get annual summary for a specific year
 * @param {number} year - Year to get summary for
 * @param {Object} params - Parameters including token
 * @returns {Promise<Object>} Annual summary data
 */
export const getYearInReview = async (year, params = {}) => {
  const response = await api.get(`/api/year-in-review/${year}`, { params });
  return response.data;
};

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Validate auth token
 * @param {string} token - Auth token to validate
 * @returns {Promise<Object>} User info if valid
 * @throws {Error} If token is invalid
 */
export const validateToken = async (token) => {
  const response = await api.get('/api/auth/me', {
    params: { token }
  });
  return response.data;
};

/**
 * Send message to AI copilot
 * @param {string} message - User message
 * @param {Array} conversationHistory - Previous messages
 * @param {string} token - Auth token
 * @returns {Promise<Object>} AI response
 */
export const sendCopilotMessage = async (message, conversationHistory, token) => {
  const params = {};
  if (token) {
    params.token = token;
  }

  const response = await api.post('/api/copilot/chat', {
    message,
    conversationHistory: conversationHistory.length > 10 ? [] : conversationHistory
  }, { params });

  return response.data;
};

/**
 * Start a new check-in sync
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Job info { jobId, status, message }
 */
export const startSync = async (token) => {
  const response = await api.post('/api/import/start', {}, {
    params: { token }
  });
  return response.data;
};

/**
 * Get sync job status
 * @param {string} jobId - Import job ID
 * @param {string} token - Auth token
 * @param {string} dataSource - Data source ('foursquare', 'strava', 'garmin')
 * @returns {Promise<Object>} Status info
 */
export const getSyncStatus = async (jobId, token, dataSource = 'foursquare') => {
  // Determine the correct endpoint based on data source
  let endpoint;
  if (dataSource === 'strava') {
    endpoint = `/api/strava/sync/status/${jobId}`;
  } else if (dataSource === 'garmin') {
    endpoint = `/api/garmin/sync/status/${jobId}`;
  } else {
    endpoint = `/api/import/status/${jobId}`;
  }

  const response = await api.get(endpoint, {
    headers: { 'x-auth-token': token }
  });
  return response.data;
};

/**
 * Get latest import job for current user
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Latest job or null
 */
export const getLatestImport = async (token) => {
  const response = await api.get('/api/import/latest', {
    params: { token }
  });
  return response.data;
};

/**
 * Sync all data sources
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Sync results
 */
export const syncAllData = async (token) => {
  const response = await api.post('/api/sync/all', {}, {
    headers: {
      'x-auth-token': token
    }
  });

  if (!response.data.success) {
    throw new Error('Sync failed');
  }

  return response.data;
};

/**
 * Get photos for a specific venue
 * @param {string} venueId - Venue ID
 * @param {string} token - Auth token
 * @returns {Promise<Array>} Array of photo groups by date
 */
export const getVenuePhotos = async (venueId, token) => {
  const response = await api.get(`/api/venues/${venueId}/photos`, {
    params: { token }
  });
  return response.data;
};

export default api;
