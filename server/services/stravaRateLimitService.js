const db = require('../db/connection');

/**
 * Custom error for rate limit exceeded
 */
class RateLimitError extends Error {
  constructor({ window, retryAfter }) {
    super(`Rate limit exceeded: ${window} window`);
    this.name = 'RateLimitError';
    this.window = window;
    this.retryAfter = retryAfter;
  }
}

/**
 * Strava Rate Limit Service
 *
 * Tracks API usage and enforces rate limits:
 * - 100 requests per 15 minutes
 * - 1000 requests per 24 hours
 *
 * Uses conservative limits (95/950) to leave buffer for edge cases.
 */
class StravaRateLimitService {
  constructor() {
    this.limits = {
      short: { max: 95, windowMs: 15 * 60 * 1000 },
      daily: { max: 950, windowMs: 24 * 60 * 60 * 1000 }
    };
  }

  /**
   * Check if user can make a Strava API request
   * @param {number} userId - User ID
   * @returns {Promise<{allowed: boolean, limitType?: string, resetAt?: Date}>}
   */
  async checkQuota(userId) {
    // Count requests in last 15 minutes
    const shortWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '15 minutes'
    `, [userId]);

    const shortCount = parseInt(shortWindow.rows[0].count, 10);
    console.log(`[RATE LIMIT] User ${userId} - 15min: ${shortCount}/${this.limits.short.max}`);

    if (shortCount >= this.limits.short.max) {
      const resetAt = await this.getResetTime('short', userId);
      console.log(`[RATE LIMIT] 15min limit exceeded! Reset at: ${resetAt}`);
      return {
        allowed: false,
        limitType: '15min',
        resetAt
      };
    }

    // Count requests in last 24 hours
    const dailyWindow = await db.query(`
      SELECT COUNT(*) FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '24 hours'
    `, [userId]);

    const dailyCount = parseInt(dailyWindow.rows[0].count, 10);
    console.log(`[RATE LIMIT] User ${userId} - 24hrs: ${dailyCount}/${this.limits.daily.max}`);

    if (dailyCount >= this.limits.daily.max) {
      const resetAt = await this.getResetTime('daily', userId);
      console.log(`[RATE LIMIT] 24hr limit exceeded! Reset at: ${resetAt}`);
      return {
        allowed: false,
        limitType: 'daily',
        resetAt
      };
    }

    console.log(`[RATE LIMIT] Quota check passed`);
    return { allowed: true };
  }

  /**
   * Record a successful API request
   * @param {number} userId - User ID
   * @param {string} endpoint - API endpoint called
   */
  async recordRequest(userId, endpoint) {
    await db.query(`
      INSERT INTO strava_api_requests (user_id, endpoint, requested_at)
      VALUES ($1, $2, NOW())
    `, [userId, endpoint]);
  }

  /**
   * Calculate when rate limit will reset
   * @param {string} limitType - 'short' or 'daily'
   * @param {number} userId - User ID
   * @returns {Promise<Date>}
   */
  async getResetTime(limitType, userId) {
    const isShort = limitType === 'short';
    const limit = isShort ? this.limits.short : this.limits.daily;
    const interval = isShort ? '15 minutes' : '24 hours';

    // Find the oldest request in the current window
    const query = `
      SELECT requested_at
      FROM strava_api_requests
      WHERE user_id = $1
        AND requested_at > NOW() - INTERVAL '${interval}'
      ORDER BY requested_at ASC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      // No requests in window, reset is now
      return new Date();
    }

    const oldestRequest = new Date(result.rows[0].requested_at);
    const resetTime = new Date(oldestRequest.getTime() + limit.windowMs);

    return resetTime;
  }
}

module.exports = {
  StravaRateLimitService,
  RateLimitError
};
