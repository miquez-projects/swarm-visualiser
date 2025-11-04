const User = require('../models/user');

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

    // Update last login timestamp for activity tracking
    await User.update(user.id, { lastLoginAt: new Date() });

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
        // Update last login timestamp
        await User.update(user.id, { lastLoginAt: new Date() });

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
