const { OAuth } = require('oauth');
const { encrypt, decrypt } = require('./encryption');

class GarminOAuthService {
  constructor() {
    // Validate required environment variables
    if (!process.env.GARMIN_CONSUMER_KEY || !process.env.GARMIN_CONSUMER_SECRET) {
      throw new Error('GARMIN_CONSUMER_KEY and GARMIN_CONSUMER_SECRET must be set in environment variables');
    }

    // Initialize OAuth 1.0a client
    this.oauth = new OAuth(
      'https://connectapi.garmin.com/oauth-service/oauth/request_token',
      'https://connectapi.garmin.com/oauth-service/oauth/access_token',
      process.env.GARMIN_CONSUMER_KEY,
      process.env.GARMIN_CONSUMER_SECRET,
      '1.0',
      null,  // callback URL is set per-request in getRequestToken
      'HMAC-SHA1'
    );

    this.baseURL = 'https://apis.garmin.com/wellness-api/rest';
  }

  /**
   * Step 1: Get request token from Garmin
   * @param {string} callbackUrl - OAuth callback URL
   * @returns {Promise<{token: string, tokenSecret: string}>}
   */
  async getRequestToken(callbackUrl) {
    if (!callbackUrl) {
      throw new Error('Callback URL is required');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken(
        { oauth_callback: callbackUrl },
        (error, oauth_token, oauth_token_secret) => {
          if (error) {
            console.error('[GARMIN OAUTH] Request token error:', error);
            reject(new Error('Failed to obtain request token: ' + (error.data || error.message)));
          } else {
            resolve({
              token: oauth_token,
              tokenSecret: oauth_token_secret
            });
          }
        }
      );
    });
  }

  /**
   * Step 2: Get OAuth authorization URL
   * @param {string} requestToken - OAuth request token from getRequestToken()
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(requestToken) {
    if (!requestToken) {
      throw new Error('Request token is required');
    }

    const params = new URLSearchParams({
      oauth_token: requestToken
    });

    return `https://connect.garmin.com/oauthConfirm?${params.toString()}`;
  }

  /**
   * Step 3: Exchange OAuth verifier for access token
   * @param {string} oauthToken - OAuth token from callback
   * @param {string} oauthTokenSecret - OAuth token secret from getRequestToken()
   * @param {string} oauthVerifier - OAuth verifier from callback
   * @returns {Promise<{token: string, tokenSecret: string}>}
   */
  async getAccessToken(oauthToken, oauthTokenSecret, oauthVerifier) {
    if (!oauthToken || !oauthTokenSecret || !oauthVerifier) {
      throw new Error('OAuth token, token secret, and verifier are all required');
    }

    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(
        oauthToken,
        oauthTokenSecret,
        oauthVerifier,
        (error, oauth_access_token, oauth_access_token_secret) => {
          if (error) {
            console.error('[GARMIN OAUTH] Access token error:', error);
            reject(new Error('Failed to obtain access token: ' + (error.data || error.message)));
          } else {
            resolve({
              token: oauth_access_token,
              tokenSecret: oauth_access_token_secret
            });
          }
        }
      );
    });
  }

  /**
   * Get encrypted token bundle for storage
   * @param {string} token - OAuth access token
   * @param {string} tokenSecret - OAuth access token secret
   * @returns {string} Encrypted token bundle
   */
  encryptTokens(token, tokenSecret) {
    const tokenBundle = JSON.stringify({ token, tokenSecret });
    return encrypt(tokenBundle);
  }

  /**
   * Decrypt and parse token bundle
   * @param {string} encryptedTokens - Encrypted token bundle
   * @returns {{token: string, tokenSecret: string}}
   */
  decryptTokens(encryptedTokens) {
    const decrypted = decrypt(encryptedTokens);
    return JSON.parse(decrypted);
  }

  /**
   * Make authenticated API request using OAuth 1.0a
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @param {string} endpoint - API endpoint (e.g., '/activities')
   * @param {object} params - Query parameters
   * @returns {Promise<any>} API response data
   */
  async makeAuthenticatedRequest(encryptedTokens, endpoint, params = {}) {
    if (!encryptedTokens || !endpoint) {
      throw new Error('Encrypted tokens and endpoint are required');
    }

    const { token, tokenSecret } = this.decryptTokens(encryptedTokens);

    // Build full URL with query parameters
    let url = `${this.baseURL}${endpoint}`;
    if (Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    return new Promise((resolve, reject) => {
      this.oauth.get(
        url,
        token,
        tokenSecret,
        (error, data, response) => {
          if (error) {
            console.error(`[GARMIN API] Request failed:`, error);
            if (error.statusCode === 401) {
              reject(new Error('OAuth token expired or invalid'));
            } else {
              reject(new Error(`Garmin API request failed: ${error.data || error.message}`));
            }
          } else {
            try {
              // Parse JSON response
              const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
              resolve(parsedData);
            } catch (parseError) {
              console.error('[GARMIN API] Failed to parse response:', parseError);
              reject(new Error('Failed to parse Garmin API response'));
            }
          }
        }
      );
    });
  }
}

module.exports = new GarminOAuthService();
