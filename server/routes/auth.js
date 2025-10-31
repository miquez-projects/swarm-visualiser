const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user');
const { encrypt } = require('../services/encryption');
const { getUserProfile } = require('../services/foursquare');

// Foursquare OAuth credentials (to be set in .env)
const FOURSQUARE_CLIENT_ID = process.env.FOURSQUARE_CLIENT_ID;
const FOURSQUARE_CLIENT_SECRET = process.env.FOURSQUARE_CLIENT_SECRET;
const FOURSQUARE_REDIRECT_URI = process.env.FOURSQUARE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback';

/**
 * GET /api/auth/login
 * Redirects to Foursquare OAuth login page
 */
router.get('/login', (req, res) => {
  if (!FOURSQUARE_CLIENT_ID) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Foursquare OAuth is not configured'
    });
  }

  const authUrl = `https://foursquare.com/oauth2/authenticate?client_id=${FOURSQUARE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(FOURSQUARE_REDIRECT_URI)}`;

  res.redirect(authUrl);
});

/**
 * GET /api/auth/callback
 * Handles Foursquare OAuth callback
 * Exchanges code for access token, creates/updates user, redirects to frontend with magic link
 */
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code'
      });
    }

    // Exchange code for access token
    const tokenResponse = await axios.get('https://foursquare.com/oauth2/access_token', {
      params: {
        client_id: FOURSQUARE_CLIENT_ID,
        client_secret: FOURSQUARE_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: FOURSQUARE_REDIRECT_URI,
        code
      }
    });

    const accessToken = tokenResponse.data.access_token;

    // Get user profile from Foursquare
    const profile = await getUserProfile(accessToken);

    // Find or create user
    let user = await User.findByFoursquareId(profile.id);

    const encryptedToken = encrypt(accessToken);

    if (user) {
      // Update existing user
      user = await User.update(user.id, {
        displayName: `${profile.firstName} ${profile.lastName}`.trim(),
        avatarUrl: profile.photo,
        accessTokenEncrypted: encryptedToken
      });
    } else {
      // Create new user
      user = await User.create({
        foursquareUserId: profile.id,
        displayName: `${profile.firstName} ${profile.lastName}`.trim(),
        avatarUrl: profile.photo,
        accessTokenEncrypted: encryptedToken
      });
    }

    // Redirect to frontend with magic link token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/import?token=${user.secret_token}`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current user info (requires magic link token)
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const user = await User.findBySecretToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    // Return user info (without sensitive fields)
    res.json({
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      lastSyncAt: user.last_sync_at
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message
    });
  }
});

module.exports = router;
