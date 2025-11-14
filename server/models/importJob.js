const db = require('../db/connection');

class ImportJob {
  /**
   * Find import job by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const query = 'SELECT * FROM import_jobs WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all import jobs for a user
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  static async findByUserId(userId) {
    const query = `
      SELECT * FROM import_jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find latest import job for a user
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  static async findLatestByUserId(userId) {
    const query = `
      SELECT * FROM import_jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new import job
   * @param {Object} jobData
   * @param {number} jobData.userId - User ID (camelCase)
   * @param {number} jobData.user_id - User ID (snake_case, alternative)
   * @param {string} jobData.data_source - Data source (e.g., 'foursquare', 'strava')
   * @param {number} jobData.totalExpected - Optional, can be set later
   * @returns {Promise<Object>}
   */
  static async create(jobData) {
    const query = `
      INSERT INTO import_jobs (
        user_id,
        data_source,
        status,
        total_expected
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      jobData.user_id || jobData.userId,  // Support both naming conventions
      jobData.data_source || null,
      jobData.status || 'pending',
      jobData.total_expected || jobData.totalExpected || null
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update import job
   * @param {number} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
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
      UPDATE import_jobs
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update job progress
   * @param {number} id
   * @param {Object} progress
   * @param {number} progress.totalImported
   * @param {number} progress.currentBatch
   * @returns {Promise<Object>}
   */
  static async updateProgress(id, progress) {
    const query = `
      UPDATE import_jobs
      SET
        total_imported = $1,
        current_batch = $2
      WHERE id = $3
      RETURNING *
    `;

    const values = [
      progress.totalImported,
      progress.currentBatch,
      id
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Mark job as started
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async markStarted(id) {
    const query = `
      UPDATE import_jobs
      SET
        status = 'running',
        started_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Mark job as completed
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async markCompleted(id) {
    const query = `
      UPDATE import_jobs
      SET
        status = 'completed',
        completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Mark job as failed
   * @param {number} id
   * @param {string} errorMessage
   * @returns {Promise<Object>}
   */
  static async markFailed(id, errorMessage) {
    const query = `
      UPDATE import_jobs
      SET
        status = 'failed',
        error_message = $1,
        completed_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [errorMessage, id]);
    return result.rows[0];
  }

  /**
   * Delete old completed/failed jobs (for cleanup)
   * @param {number} daysOld - Delete jobs older than this many days
   * @returns {Promise<number>} Number of deleted jobs
   */
  static async deleteOld(daysOld = 30) {
    const query = `
      DELETE FROM import_jobs
      WHERE
        status IN ('completed', 'failed')
        AND completed_at < NOW() - INTERVAL '${daysOld} days'
    `;

    const result = await db.query(query);
    return result.rowCount;
  }
}

module.exports = ImportJob;
