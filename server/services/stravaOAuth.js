const crypto = require('crypto');
const axios = require('axios');
const { encrypt, decrypt } = require('./encryption');

class StravaOAuthService {
  constructor() {
    this.clientId = process.env.STRAVA_CLIENT_ID;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
    this.authorizationUrl = 'https://www.strava.com/oauth/authorize';
    this.tokenUrl = 'https://www.strava.com/oauth/token';
    this.baseURL = 'https://www.strava.com/api/v3';

    // Rate limits: 100 requests per 15 minutes, 1000 per day
    this.rateLimits = {
      short: { limit: 100, window: 15 * 60 * 1000 }, // 15 minutes in ms
      daily: { limit: 1000, window: 24 * 60 * 60 * 1000 } // 24 hours in ms
    };

    if (!this.clientId || !this.clientSecret) {
      console.warn('[STRAVA OAUTH] Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
    }
  }

  /**
   * Generate OAuth2 authorization URL
   * Note: Strava uses standard OAuth2, NOT PKCE (unlike Garmin)
   * @param {string} redirectUri - OAuth callback URL
   * @param {string} state - Optional state parameter for CSRF protection
   * @param {string} scope - OAuth scope (default: 'read,activity:read_all')
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(redirectUri, state = '', scope = 'read,activity:read_all') {
    if (!redirectUri) {
      throw new Error('Redirect URI is required');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      state: state
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   * Note: Strava response includes expires_at (timestamp), not expires_in (seconds)
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - OAuth callback URL (must match authorization request)
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number, athleteId: number}>}
   */
  async exchangeCodeForToken(code, redirectUri) {
    if (!code) {
      throw new Error('Authorization code is required');
    }
    if (!redirectUri) {
      throw new Error('Redirect URI is required');
    }

    try {
      const response = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.data.access_token) {
        throw new Error('No access token in response');
      }

      // Strava returns expires_at (unix timestamp), not expires_in
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_at, // Unix timestamp when token expires
        athleteId: response.data.athlete?.id || null
      };
    } catch (error) {
      console.error('[STRAVA OAUTH] Token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Refresh an expired access token
   * Proactively refreshes tokens before expiry
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number}>}
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      const response = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.data.access_token) {
        throw new Error('No access token in refresh response');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_at
      };
    } catch (error) {
      console.error('[STRAVA OAUTH] Token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get encrypted token bundle for storage
   * Includes expiresAt timestamp for proactive refresh
   * @param {string} accessToken - OAuth2 access token
   * @param {string} refreshToken - OAuth2 refresh token
   * @param {number} expiresAt - Unix timestamp when access token expires
   * @returns {string} Encrypted token bundle
   */
  encryptTokens(accessToken, refreshToken, expiresAt) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    if (!expiresAt) {
      throw new Error('Expires at timestamp is required');
    }

    const tokenBundle = JSON.stringify({
      accessToken,
      refreshToken,
      expiresAt
    });
    return encrypt(tokenBundle);
  }

  /**
   * Decrypt and parse token bundle
   * @param {string} encryptedTokens - Encrypted token bundle
   * @returns {{accessToken: string, refreshToken: string, expiresAt: number}}
   */
  decryptTokens(encryptedTokens) {
    if (!encryptedTokens) {
      throw new Error('Encrypted tokens are required');
    }

    const decrypted = decrypt(encryptedTokens);
    const parsed = JSON.parse(decrypted);

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt
    };
  }

  /**
   * Check if access token is expired or will expire soon (within 5 minutes)
   * @param {number} expiresAt - Unix timestamp when token expires
   * @returns {boolean} True if token is expired or will expire soon
   */
  isTokenExpired(expiresAt) {
    const now = Math.floor(Date.now() / 1000); // Current unix timestamp
    const buffer = 5 * 60; // 5 minute buffer
    return expiresAt <= (now + buffer);
  }


  /**
   * Make authenticated API request with Bearer token
   * Handles token refresh, fails fast on rate limits
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @param {string} endpoint - API endpoint (e.g., '/athlete/activities')
   * @param {object} params - Query parameters or request body
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @returns {Promise<any>} API response data
   */
  async makeAuthenticatedRequest(encryptedTokens, endpoint, params = {}, method = 'GET') {
    if (!encryptedTokens) {
      throw new Error('Encrypted tokens are required');
    }
    if (!endpoint) {
      throw new Error('Endpoint is required');
    }

    let { accessToken, refreshToken, expiresAt } = this.decryptTokens(encryptedTokens);

    // Proactive token refresh if expired or expiring soon
    if (this.isTokenExpired(expiresAt)) {
      console.log('[STRAVA API] Access token expired or expiring soon, refreshing...');
      try {
        const newTokens = await this.refreshAccessToken(refreshToken);
        accessToken = newTokens.accessToken;
        refreshToken = newTokens.refreshToken;
        expiresAt = newTokens.expiresAt;

        // Return new encrypted tokens to caller for storage
        const newEncryptedTokens = this.encryptTokens(
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresAt
        );

        // Continue with refreshed token
        encryptedTokens = newEncryptedTokens;
      } catch (refreshError) {
        console.error('[STRAVA API] Token refresh failed:', refreshError.message);
        throw new Error('OAuth token expired and refresh failed. Please re-authenticate.');
      }
    }

    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    try {
      let response;

      if (method.toUpperCase() === 'GET') {
        config.params = params;
        response = await axios.get(url, config);
      } else if (method.toUpperCase() === 'POST') {
        response = await axios.post(url, params, config);
      } else if (method.toUpperCase() === 'PUT') {
        response = await axios.put(url, params, config);
      } else if (method.toUpperCase() === 'DELETE') {
        response = await axios.delete(url, config);
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // If tokens were refreshed, return both data and new tokens
      if (encryptedTokens !== arguments[0]) {
        return {
          data: response.data,
          newEncryptedTokens: encryptedTokens
        };
      }

      return response.data;
    } catch (error) {
      // Handle rate limiting - throw immediately, no retry
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }

      // Handle token expiration (401)
      if (error.response?.status === 401) {
        console.log('[STRAVA API] 401 Unauthorized, attempting token refresh...');
        try {
          const newTokens = await this.refreshAccessToken(refreshToken);
          const newEncryptedTokens = this.encryptTokens(
            newTokens.accessToken,
            newTokens.refreshToken,
            newTokens.expiresAt
          );

          // Retry the request with new token
          const retryConfig = {
            headers: {
              'Authorization': `Bearer ${newTokens.accessToken}`,
              'Accept': 'application/json'
            }
          };

          let retryResponse;
          if (method.toUpperCase() === 'GET') {
            retryConfig.params = params;
            retryResponse = await axios.get(url, retryConfig);
          } else if (method.toUpperCase() === 'POST') {
            retryResponse = await axios.post(url, params, retryConfig);
          } else if (method.toUpperCase() === 'PUT') {
            retryResponse = await axios.put(url, params, retryConfig);
          } else if (method.toUpperCase() === 'DELETE') {
            retryResponse = await axios.delete(url, retryConfig);
          }

          // Return both the response data and new encrypted tokens
          return {
            data: retryResponse.data,
            newEncryptedTokens: newEncryptedTokens
          };
        } catch (refreshError) {
          console.error('[STRAVA API] Token refresh failed:', refreshError.message);
          throw new Error('OAuth token expired and refresh failed. Please re-authenticate.');
        }
      }

      // Log and rethrow other errors
      console.error(`[STRAVA API] Request failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get athlete profile information
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @returns {Promise<object>} Athlete profile data
   */
  async getAthleteProfile(encryptedTokens) {
    return this.makeAuthenticatedRequest(encryptedTokens, '/athlete');
  }
}

module.exports = new StravaOAuthService();
