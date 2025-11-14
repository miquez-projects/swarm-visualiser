const { GarminConnect } = require('garmin-connect');
const { encrypt, decrypt } = require('./encryption');

class GarminAuthService {
  /**
   * Authenticate with Garmin and get encrypted session token
   * @param {string} username - Garmin username
   * @param {string} password - Garmin password
   * @returns {Promise<{encrypted: string, client: GarminConnect}>}
   */
  async authenticate(username, password) {
    const client = new GarminConnect({
      username,
      password
    });

    await client.login();

    // Export session tokens
    const sessionData = await client.exportToken();

    return {
      encrypted: encrypt(JSON.stringify(sessionData)),
      client
    };
  }

  /**
   * Get Garmin client from encrypted session token
   * @param {string} encryptedToken - Encrypted session token
   * @returns {Promise<GarminConnect>}
   */
  async getClient(encryptedToken) {
    const sessionData = JSON.parse(decrypt(encryptedToken));

    const client = new GarminConnect();
    await client.restoreOrLogin(undefined, sessionData);

    return client;
  }
}

module.exports = new GarminAuthService();
