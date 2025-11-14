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
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_activities
      WHERE user_id = $1
        AND start_time >= $2
        AND start_time <= $3
      ORDER BY start_time DESC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
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
