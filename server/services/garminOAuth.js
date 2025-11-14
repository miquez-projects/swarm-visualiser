const { OAuth2 } = require('oauth');
const axios = require('axios');
const { encrypt, decrypt } = require('./encryption');

class GarminOAuthService {
  constructor() {
    this.oauth2 = new OAuth2(
      process.env.GARMIN_CONSUMER_KEY,
      process.env.GARMIN_CONSUMER_SECRET,
      'https://connectapi.garmin.com/',
      'oauth-service/oauth/request_token',
      'oauth-service/oauth/access_token',
      null
    );

    this.baseURL = 'https://apis.garmin.com/wellness-api/rest';
  }

  /**
   * Get OAuth authorization URL
   * @param {string} callbackUrl - OAuth callback URL
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(callbackUrl) {
    const params = new URLSearchParams({
      oauth_consumer_key: process.env.GARMIN_CONSUMER_KEY,
      oauth_callback: callbackUrl
    });

    return `https://connect.garmin.com/oauthConfirm?${params.toString()}`;
  }

  /**
   * Exchange OAuth verifier for access token
   * @param {string} oauthToken - OAuth token from callback
   * @param {string} oauthVerifier - OAuth verifier from callback
   * @returns {Promise<{token: string, tokenSecret: string}>}
   */
  async getAccessToken(oauthToken, oauthVerifier) {
    return new Promise((resolve, reject) => {
      this.oauth2.getOAuthAccessToken(
        oauthToken,
        oauthVerifier,
        (error, oauth_access_token, oauth_access_token_secret) => {
          if (error) {
            console.error('[GARMIN OAUTH] Access token error:', error);
            reject(new Error('Failed to obtain access token'));
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
   * Make authenticated API request
   * @param {string} encryptedTokens - Encrypted OAuth tokens
   * @param {string} endpoint - API endpoint (e.g., '/activities')
   * @param {object} params - Query parameters
   * @returns {Promise<any>} API response data
   */
  async makeAuthenticatedRequest(encryptedTokens, endpoint, params = {}) {
    const { token, tokenSecret } = this.decryptTokens(encryptedTokens);

    // Build OAuth1.0a signature
    const url = `${this.baseURL}${endpoint}`;
    const authHeader = this.oauth2.authHeader(
      url,
      token,
      tokenSecret,
      'GET'
    );

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`[GARMIN API] Request failed:`, error.message);
      if (error.response?.status === 401) {
        throw new Error('OAuth token expired or invalid');
      }
      throw error;
    }
  }
}

module.exports = new GarminOAuthService();
