const db = require('../db/connection');

class GarminActivity {
  /**
   * Create a single Garmin activity
   * Uses ON CONFLICT DO NOTHING to skip duplicates
   */
  static async create(activityData) {
    const query = `
      INSERT INTO garmin_activities (
        user_id, garmin_activity_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, calories,
        avg_heart_rate, max_heart_rate, tracklog, garmin_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeogFromText($11), $12)
      ON CONFLICT (user_id, garmin_activity_id) DO NOTHING
      RETURNING *
    `;

    const values = [
      activityData.user_id,
      activityData.garmin_activity_id,
      activityData.activity_type,
      activityData.activity_name,
      activityData.start_time,
      activityData.duration_seconds,
      activityData.distance_meters,
      activityData.calories,
      activityData.avg_heart_rate,
      activityData.max_heart_rate,
      activityData.tracklog,
      activityData.garmin_url
    ];

    const result = await db.query(query, values);
    return result.rows[0]; // Returns undefined if duplicate
  }

  /**
   * Bulk insert activities with ON CONFLICT DO NOTHING
   * IMPORTANT: Returns the actual count of inserted rows (not total rows attempted)
   */
  static async bulkInsert(activities) {
    if (activities.length === 0) return 0;

    // Build VALUES clause: ($1, $2, ...), ($13, $14, ...), ...
    const valuesPerRow = 12;
    const valuesClauses = [];
    const allValues = [];

    activities.forEach((activity, idx) => {
      const offset = idx * valuesPerRow;
      const placeholders = [];

      for (let i = 1; i <= valuesPerRow; i++) {
        placeholders.push(`$${offset + i}`);
      }

      // Special handling for tracklog (ST_GeogFromText)
      placeholders[10] = `ST_GeogFromText($${offset + 11})`;

      valuesClauses.push(`(${placeholders.join(', ')})`);

      allValues.push(
        activity.user_id,
        activity.garmin_activity_id,
        activity.activity_type,
        activity.activity_name,
        activity.start_time,
        activity.duration_seconds,
        activity.distance_meters,
        activity.calories,
        activity.avg_heart_rate,
        activity.max_heart_rate,
        activity.tracklog,
        activity.garmin_url
      );
    });

    const query = `
      INSERT INTO garmin_activities (
        user_id, garmin_activity_id, activity_type, activity_name,
        start_time, duration_seconds, distance_meters, calories,
        avg_heart_rate, max_heart_rate, tracklog, garmin_url
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (user_id, garmin_activity_id) DO NOTHING
      RETURNING id
    `;

    const result = await db.query(query, allValues);

    // CRITICAL: Return the actual number of rows inserted (not activities.length)
    // This prevents the vicious cycle we had with Foursquare check-ins
    return result.rowCount;
  }

  /**
   * Find activities by user and date range
   * @param {string} userId - User ID
   * @param {string} startDateOrLocalDate - Either ISO timestamp (for UTC range) or YYYY-MM-DD (for local date)
   * @param {string} endDate - Optional: ISO timestamp (required if using UTC range, omit for local date)
   */
  static async findByUserAndDateRange(userId, startDateOrLocalDate, endDate = null) {
    // If endDate is null, treat startDateOrLocalDate as a local date (YYYY-MM-DD)
    const isLocalDate = !endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDateOrLocalDate);

    const query = isLocalDate ? `
      SELECT * FROM garmin_activities
      WHERE user_id = $1
        AND DATE(start_time AT TIME ZONE COALESCE(timezone, 'UTC')) = $2
      ORDER BY start_time ASC
    ` : `
      SELECT * FROM garmin_activities
      WHERE user_id = $1
        AND start_time >= $2
        AND start_time <= $3
      ORDER BY start_time DESC
    `;

    const params = isLocalDate ? [userId, startDateOrLocalDate] : [userId, startDateOrLocalDate, endDate];
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get the most recent activity date for a user
   * Used for incremental sync
   */
  static async findLastSyncDate(userId) {
    const query = `
      SELECT MAX(start_time) as last_sync_date
      FROM garmin_activities
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0]?.last_sync_date;
  }

  /**
   * Count total activities for a user
   */
  static async countByUser(userId) {
    const query = 'SELECT COUNT(*) as count FROM garmin_activities WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = GarminActivity;
