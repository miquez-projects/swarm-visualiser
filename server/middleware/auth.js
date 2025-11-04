const User = require('../models/user');

// Throttle last_login_at updates to reduce database load
// Only update if last update was more than 5 minutes ago
const lastLoginCache = new Map(); // userId -> lastUpdateTime
const UPDATE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to authenticate user via magic link token
 * Expects token in query parameter: ?token=xxx
 * Sets req.user if valid
 */
async function authenticateToken(req, res, next) {
  try {
    const token = req.query.token || req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided'
      });
    }

    const user = await User.findBySecretToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired'
      });
    }

    // Update last login timestamp for activity tracking (throttled to every 5 minutes)
    const now = Date.now();
    const lastUpdate = lastLoginCache.get(user.id);
    if (!lastUpdate || (now - lastUpdate) > UPDATE_THROTTLE_MS) {
      // Fire-and-forget to avoid blocking request
      User.update(user.id, { lastLoginAt: new Date() }).catch(err =>
        console.error('Failed to update last_login_at:', err)
      );
      lastLoginCache.set(user.id, now);
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate request'
    });
  }
}

/**
 * Optional authentication - allows request to proceed without token
 * but sets req.user if token is provided and valid
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.query.token || req.headers['x-auth-token'];

    if (token) {
      const user = await User.findBySecretToken(token);
      if (user) {
        // Update last login timestamp for activity tracking (throttled to every 5 minutes)
        const now = Date.now();
        const lastUpdate = lastLoginCache.get(user.id);
        if (!lastUpdate || (now - lastUpdate) > UPDATE_THROTTLE_MS) {
          // Fire-and-forget to avoid blocking request
          User.update(user.id, { lastLoginAt: new Date() }).catch(err =>
            console.error('Failed to update last_login_at:', err)
          );
          lastLoginCache.set(user.id, now);
        }

        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Don't fail the request, just continue without user
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuth
};
