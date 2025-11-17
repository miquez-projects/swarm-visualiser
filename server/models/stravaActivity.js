const db = require('../db/connection');

class StravaActivity {
  /**
   * Create a single Strava activity
   * Uses ON CONFLICT DO NOTHING to skip duplicates
   */
  static async create(activityData) {
    const query = `
      INSERT INTO strava_activities (
        user_id, strava_activity_id, activity_type, activity_name, description,
        start_time, start_latlng, end_latlng, duration_seconds, moving_time_seconds,
        distance_meters, total_elevation_gain, calories, avg_speed, max_speed,
        avg_heart_rate, max_heart_rate, avg_cadence, avg_watts, tracklog,
        is_private, kudos_count, comment_count, photo_count, achievement_count,
        strava_url
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, ST_GeogFromText($20), $21, $22, $23, $24, $25, $26
      )
      ON CONFLICT (user_id, strava_activity_id) DO NOTHING
      RETURNING *
    `;

    const values = [
      activityData.user_id,
      activityData.strava_activity_id,
      activityData.activity_type,
      activityData.activity_name,
      activityData.description,
      activityData.start_time,
      activityData.start_latlng,
      activityData.end_latlng,
      activityData.duration_seconds,
      activityData.moving_time_seconds,
      activityData.distance_meters,
      activityData.total_elevation_gain,
      activityData.calories,
      activityData.avg_speed,
      activityData.max_speed,
      activityData.avg_heart_rate,
      activityData.max_heart_rate,
      activityData.avg_cadence,
      activityData.avg_watts,
      activityData.tracklog,
      activityData.is_private,
      activityData.kudos_count,
      activityData.comment_count,
      activityData.photo_count,
      activityData.achievement_count,
      activityData.strava_url
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

    // Build VALUES clause with dynamic parameter tracking
    const valuesClauses = [];
    const allValues = [];
    let paramCounter = 1;

    activities.forEach((activity) => {
      const placeholders = [];

      // Fixed fields (positions 1-6: user_id through start_time)
      for (let i = 0; i < 6; i++) {
        placeholders.push(`$${paramCounter++}`);
      }

      // Position 7: start_latlng (may be null)
      if (activity.start_latlng) {
        placeholders.push(`ST_GeogFromText($${paramCounter++})`);
      } else {
        placeholders.push('NULL');
      }

      // Position 8: end_latlng (may be null)
      if (activity.end_latlng) {
        placeholders.push(`ST_GeogFromText($${paramCounter++})`);
      } else {
        placeholders.push('NULL');
      }

      // Fixed fields (positions 9-19: duration_seconds through avg_watts)
      for (let i = 0; i < 11; i++) {
        placeholders.push(`$${paramCounter++}`);
      }

      // Position 20: tracklog (always present)
      placeholders.push(`ST_GeogFromText($${paramCounter++})`);

      // Fixed fields (positions 21-26: is_private through strava_url)
      for (let i = 0; i < 6; i++) {
        placeholders.push(`$${paramCounter++}`);
      }

      valuesClauses.push(`(${placeholders.join(', ')})`);

      // Build values array - push in same order as placeholders
      allValues.push(
        activity.user_id,
        activity.strava_activity_id,
        activity.activity_type,
        activity.activity_name,
        activity.description,
        activity.start_time
      );

      // Only push coordinate values if they exist
      if (activity.start_latlng) {
        allValues.push(activity.start_latlng);
      }
      if (activity.end_latlng) {
        allValues.push(activity.end_latlng);
      }

      allValues.push(
        activity.duration_seconds,
        activity.moving_time_seconds,
        activity.distance_meters,
        activity.total_elevation_gain,
        activity.calories,
        activity.avg_speed,
        activity.max_speed,
        activity.avg_heart_rate,
        activity.max_heart_rate,
        activity.avg_cadence,
        activity.avg_watts,
        activity.tracklog,
        activity.is_private,
        activity.kudos_count,
        activity.comment_count,
        activity.photo_count,
        activity.achievement_count,
        activity.strava_url
      );
    });

    const query = `
      INSERT INTO strava_activities (
        user_id, strava_activity_id, activity_type, activity_name, description,
        start_time, start_latlng, end_latlng, duration_seconds, moving_time_seconds,
        distance_meters, total_elevation_gain, calories, avg_speed, max_speed,
        avg_heart_rate, max_heart_rate, avg_cadence, avg_watts, tracklog,
        is_private, kudos_count, comment_count, photo_count, achievement_count,
        strava_url
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (user_id, strava_activity_id) DO UPDATE SET
        activity_type = EXCLUDED.activity_type,
        activity_name = EXCLUDED.activity_name,
        description = EXCLUDED.description,
        start_time = EXCLUDED.start_time,
        start_latlng = EXCLUDED.start_latlng,
        end_latlng = EXCLUDED.end_latlng,
        duration_seconds = EXCLUDED.duration_seconds,
        moving_time_seconds = EXCLUDED.moving_time_seconds,
        distance_meters = EXCLUDED.distance_meters,
        total_elevation_gain = EXCLUDED.total_elevation_gain,
        calories = EXCLUDED.calories,
        avg_speed = EXCLUDED.avg_speed,
        max_speed = EXCLUDED.max_speed,
        avg_heart_rate = EXCLUDED.avg_heart_rate,
        max_heart_rate = EXCLUDED.max_heart_rate,
        avg_cadence = EXCLUDED.avg_cadence,
        avg_watts = EXCLUDED.avg_watts,
        tracklog = EXCLUDED.tracklog,
        is_private = EXCLUDED.is_private,
        kudos_count = EXCLUDED.kudos_count,
        comment_count = EXCLUDED.comment_count,
        photo_count = EXCLUDED.photo_count,
        achievement_count = EXCLUDED.achievement_count,
        strava_url = EXCLUDED.strava_url
      RETURNING id
    `;

    console.log(`[STRAVA BULKINSERT] Attempting to insert ${activities.length} activities`);
    console.log(`[STRAVA BULKINSERT] First activity sample:`, {
      user_id: activities[0].user_id,
      strava_activity_id: activities[0].strava_activity_id,
      activity_type: activities[0].activity_type,
      activity_name: activities[0].activity_name,
      start_time: activities[0].start_time,
      has_tracklog: !!activities[0].tracklog
    });

    try {
      const result = await db.query(query, allValues);

      console.log(`[STRAVA BULKINSERT] SQL executed successfully`);
      console.log(`[STRAVA BULKINSERT] result.rowCount = ${result.rowCount}`);
      console.log(`[STRAVA BULKINSERT] result.rows.length = ${result.rows?.length || 0}`);

      // CRITICAL: Return the actual number of rows inserted (not activities.length)
      // This prevents the vicious cycle we had with Foursquare check-ins
      return result.rowCount;
    } catch (error) {
      console.error(`[STRAVA BULKINSERT] Database error:`, error.message);
      console.error(`[STRAVA BULKINSERT] Error code:`, error.code);
      console.error(`[STRAVA BULKINSERT] Error detail:`, error.detail);
      throw error;
    }
  }

  /**
   * Find activities by user and date range
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT
        id, user_id, strava_activity_id, activity_type, activity_name, description,
        start_time, ST_AsText(start_latlng::geometry) as start_latlng,
        ST_AsText(end_latlng::geometry) as end_latlng,
        duration_seconds, moving_time_seconds, distance_meters, total_elevation_gain,
        calories, avg_speed, max_speed, avg_heart_rate, max_heart_rate,
        avg_cadence, avg_watts,
        ST_AsText(tracklog::geometry) as tracklog,
        is_private, kudos_count, comment_count, photo_count, achievement_count,
        strava_url, created_at, updated_at
      FROM strava_activities
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
      FROM strava_activities
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0]?.last_sync_date;
  }

  /**
   * Count total activities for a user
   */
  static async countByUser(userId) {
    const query = 'SELECT COUNT(*) as count FROM strava_activities WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find activities with photos
   */
  static async findActivitiesWithPhotos(userId) {
    const query = `
      SELECT * FROM strava_activities
      WHERE user_id = $1 AND photo_count > 0
      ORDER BY start_time DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get activity by internal ID
   */
  static async findById(activityId) {
    const query = 'SELECT * FROM strava_activities WHERE id = $1';
    const result = await db.query(query, [activityId]);
    return result.rows[0];
  }

  /**
   * Get activity by Strava activity ID and user ID
   */
  static async findByStravaId(userId, stravaActivityId) {
    const query = `
      SELECT * FROM strava_activities
      WHERE user_id = $1 AND strava_activity_id = $2
    `;

    const result = await db.query(query, [userId, stravaActivityId]);
    return result.rows[0];
  }
}

module.exports = StravaActivity;
