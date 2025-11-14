const db = require('../db/connection');
const crypto = require('crypto');

class User {
  /**
   * Find user by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by Foursquare user ID
   * @param {string} foursquareUserId
   * @returns {Promise<Object|null>}
   */
  static async findByFoursquareId(foursquareUserId) {
    const query = 'SELECT * FROM users WHERE foursquare_user_id = $1';
    const result = await db.query(query, [foursquareUserId]);
    return result.rows[0] || null;
  }

  /**
   * Find user by secret token (for magic link authentication)
   * @param {string} secretToken
   * @returns {Promise<Object|null>}
   */
  static async findBySecretToken(secretToken) {
    const query = 'SELECT * FROM users WHERE secret_token = $1';
    const result = await db.query(query, [secretToken]);
    return result.rows[0] || null;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.foursquareUserId
   * @param {string} userData.displayName
   * @param {string} userData.avatarUrl
   * @param {string} userData.accessTokenEncrypted
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const secretToken = crypto.randomBytes(32).toString('hex');

    const query = `
      INSERT INTO users (
        foursquare_user_id,
        display_name,
        avatar_url,
        access_token_encrypted,
        secret_token
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      userData.foursquareUserId,
      userData.displayName || null,
      userData.avatarUrl || null,
      userData.accessTokenEncrypted,
      secretToken
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update user
   * @param {number} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query based on provided fields
    Object.entries(updates).forEach(([key, value]) => {
      // Convert camelCase to snake_case for database columns
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      fields.push(`${dbKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update last sync timestamp
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async updateLastSync(id) {
    const query = `
      UPDATE users
      SET last_sync_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Update user's last Garmin sync timestamp
   * CRITICAL: Only call this when items are actually imported
   */
  static async updateLastGarminSync(userId) {
    const query = `
      UPDATE users
      SET last_garmin_sync_at = NOW()
      WHERE id = $1
      RETURNING last_garmin_sync_at
    `;
    const result = await db.query(query, [userId]);
    console.log(`[USER MODEL] Updated last_garmin_sync_at for user ${userId} to ${result.rows[0]?.last_garmin_sync_at}`);
    return result.rows[0];
  }

  /**
   * Get all users (for admin purposes)
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const query = 'SELECT * FROM users WHERE access_token_encrypted IS NOT NULL';
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Get all active users (for daily sync)
   * Active = has access token AND (logged in within last 30 days OR never logged in)
   * @returns {Promise<Array>}
   */
  static async findActive() {
    const query = `
      SELECT * FROM users
      WHERE access_token_encrypted IS NOT NULL
      AND (last_login_at > NOW() - INTERVAL '30 days' OR last_login_at IS NULL)
      ORDER BY id ASC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Delete user and all associated data
   * @param {number} id
   * @returns {Promise<void>}
   */
  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1';
    await db.query(query, [id]);
  }
}

module.exports = User;
