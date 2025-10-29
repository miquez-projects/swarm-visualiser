import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
 * @returns {Promise<Object>} Filter options
 */
export const getFilterOptions = async () => {
  const response = await api.get('/api/filters/options');
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

export default api;
