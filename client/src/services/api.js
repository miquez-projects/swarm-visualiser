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
 * @returns {Promise<Object>} Status info
 */
export const getSyncStatus = async (jobId, token) => {
  const response = await api.get(`/api/import/status/${jobId}`, {
    params: { token }
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

export default api;
