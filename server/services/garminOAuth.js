const crypto = require('crypto');
const axios = require('axios');
const { encrypt, decrypt } = require('./encryption');

class GarminOAuthService {
  constructor() {
    this.consumerKey = process.env.GARMIN_CONSUMER_KEY;
    this.consumerSecret = process.env.GARMIN_CONSUMER_SECRET;
    this.authorizationUrl = 'https://connect.garmin.com/oauthConfirm';
    this.tokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
    this.baseURL = 'https://apis.garmin.com/wellness-api/rest';

    if (!this.consumerKey || !this.consumerSecret) {
      console.warn('[GARMIN OAUTH] Missing GARMIN_CONSUMER_KEY or GARMIN_CONSUMER_SECRET');
    }
  }

  /**
   * Generate PKCE code_verifier and code_challenge
   * @returns {{codeVerifier: string, codeChallenge: string}}
   */
  generatePKCE() {
    // Generate cryptographically secure random code_verifier (43-128 chars)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');

    // Create SHA256 hash of code_verifier and base64url encode it
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Get OAuth2 authorization URL with PKCE
   * @param {string} callbackUrl - OAuth callback URL
   * @param {string} codeChallenge - PKCE code challenge
   * @param {string} state - Optional state parameter for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(callbackUrl, codeChallenge, state = '') {
    if (!callbackUrl) {
      throw new Error('Callback URL is required');
    }
    if (!codeChallenge) {
      throw new Error('Code challenge is required');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.consumerKey,
      redirect_uri: callbackUrl,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from callback
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} callbackUrl - OAuth callback URL (must match authorization request)
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async exchangeCodeForToken(code, codeVerifier, callbackUrl) {
    if (!code) {
      throw new Error('Authorization code is required');
    }
    if (!codeVerifier) {
      throw new Error('Code verifier is required');
    }
    if (!callbackUrl) {
      throw new Error('Callback URL is required');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.consumerKey,
        code_verifier: codeVerifier,
        redirect_uri: callbackUrl
      });

      const response = await axios.post(this.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        auth: {
          username: this.consumerKey,
          password: this.consumerSecret
        }
      });

      if (!response.data.access_token) {
        throw new Error('No access token in response');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null
      };
    } catch (error) {
      console.error('[GARMIN OAUTH] Token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Refresh an expired access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.consumerKey
      });

      const response = await axios.post(this.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        auth: {
          username: this.consumerKey,
          password: this.consumerSecret
        }
      });

      if (!response.data.access_token) {
        throw new Error('No access token in refresh response');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken
      };
    } catch (error) {
      console.error('[GARMIN OAUTH] Token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get encrypted token bundle for storage
   * @param {string} accessToken - OAuth2 access token
   * @param {string} refreshToken - OAuth2 refresh token (optional)
   * @returns {string} Encrypted token bundle
   */
  encryptTokens(accessToken, refreshToken = null) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    const tokenBundle = JSON.stringify({
      accessToken,
      refreshToken
    });
    return encrypt(tokenBundle);
  }

  /**
   * Decrypt and parse token bundle
   * @param {string} encryptedTokens - Encrypted token bundle
   * @returns {{accessToken: string, refreshToken: string|null}}
   */
  decryptTokens(encryptedTokens) {
    if (!encryptedTokens) {
      throw new Error('Encrypted tokens are required');
    }

    const decrypted = decrypt(encryptedTokens);
    const parsed = JSON.parse(decrypted);

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || null
    };
  }

  /**
   * Make authenticated API request with Bearer token
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @param {string} endpoint - API endpoint (e.g., '/activities')
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

    const { accessToken, refreshToken } = this.decryptTokens(encryptedTokens);

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

      return response.data;
    } catch (error) {
      console.error(`[GARMIN API] Request failed:`, error.response?.data || error.message);

      // Handle token expiration
      if (error.response?.status === 401) {
        if (refreshToken) {
          console.log('[GARMIN API] Access token expired, attempting refresh...');
          try {
            const newTokens = await this.refreshAccessToken(refreshToken);
            const newEncryptedTokens = this.encryptTokens(
              newTokens.accessToken,
              newTokens.refreshToken
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
            console.error('[GARMIN API] Token refresh failed:', refreshError.message);
            throw new Error('OAuth token expired and refresh failed. Please re-authenticate.');
          }
        } else {
          throw new Error('OAuth token expired. Please re-authenticate.');
        }
      }

      throw error;
    }
  }
}

module.exports = new GarminOAuthService();
