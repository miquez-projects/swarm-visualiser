const axios = require('axios');

const FOURSQUARE_API_BASE = 'https://api.foursquare.com/v2';
const BATCH_SIZE = 100; // Fetch 100 check-ins per request
const DELAY_BETWEEN_REQUESTS = 200; // 200ms delay to stay under rate limit (500/hour)

/**
 * Fetch user's check-in history from Foursquare
 * @param {string} accessToken - Foursquare OAuth access token
 * @param {Object} options
 * @param {Date} options.afterTimestamp - Only fetch check-ins after this date
 * @param {Function} options.onProgress - Callback for progress updates (batch, total)
 * @returns {Promise<Array>} Array of check-ins
 */
async function fetchCheckins(accessToken, options = {}) {
  const { afterTimestamp, onProgress } = options;

  let allCheckins = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      // Add delay between requests to respect rate limits
      if (offset > 0) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }

      const params = {
        oauth_token: accessToken,
        v: '20231201', // API version
        limit: BATCH_SIZE,
        offset: offset
      };

      // If we have an afterTimestamp, only fetch check-ins after that date
      if (afterTimestamp) {
        params.afterTimestamp = Math.floor(afterTimestamp.getTime() / 1000);
      }

      const response = await axios.get(`${FOURSQUARE_API_BASE}/users/self/checkins`, {
        params,
        timeout: 30000 // 30 second timeout
      });

      const data = response.data.response;
      const checkins = data.checkins.items;

      allCheckins = allCheckins.concat(checkins);

      // Update progress
      if (onProgress) {
        onProgress({
          batch: Math.floor(offset / BATCH_SIZE) + 1,
          totalFetched: allCheckins.length,
          totalExpected: data.checkins.count
        });
      }

      // Check if there are more check-ins to fetch
      hasMore = checkins.length === BATCH_SIZE && allCheckins.length < data.checkins.count;
      offset += BATCH_SIZE;

    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limit hit, throw specific error
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 401) {
        // Invalid token
        throw new Error('Invalid or expired access token.');
      }

      throw new Error(`Failed to fetch check-ins: ${error.message}`);
    }
  }

  return allCheckins;
}

/**
 * Get user profile from Foursquare
 * @param {string} accessToken - Foursquare OAuth access token
 * @returns {Promise<Object>} User profile with id, firstName, lastName, photo
 */
async function getUserProfile(accessToken) {
  try {
    const response = await axios.get(`${FOURSQUARE_API_BASE}/users/self`, {
      params: {
        oauth_token: accessToken,
        v: '20231201'
      },
      timeout: 10000
    });

    const user = response.data.response.user;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      photo: user.photo ? `${user.photo.prefix}original${user.photo.suffix}` : null
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Invalid or expired access token.');
    }
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
}

/**
 * Transform Foursquare check-in to our database format
 * @param {Object} checkin - Foursquare check-in object
 * @param {number} userId - Our database user ID
 * @returns {Object} Check-in in our database format with photos array
 */
function transformCheckin(checkin, userId) {
  const venue = checkin.venue;
  const location = venue.location;

  // Extract photos if available
  const photos = [];
  if (checkin.photos && checkin.photos.items && checkin.photos.items.length > 0) {
    checkin.photos.items.forEach(photo => {
      photos.push({
        url: `${photo.prefix}original${photo.suffix}`,
        width: photo.width || null,
        height: photo.height || null
      });
    });
  }

  return {
    user_id: userId,
    venue_id: venue.id,
    venue_name: venue.name,
    venue_category: venue.categories?.[0]?.name || null,
    latitude: location.lat,
    longitude: location.lng,
    checkin_date: new Date(checkin.createdAt * 1000), // Convert Unix timestamp to Date
    city: location.city || null,
    country: location.country || null,
    photos: photos
  };
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  fetchCheckins,
  getUserProfile,
  transformCheckin
};
