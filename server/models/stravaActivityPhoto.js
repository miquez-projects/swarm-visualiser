const db = require('../db/connection');

class StravaActivityPhoto {
  /**
   * Create a single photo
   * Uses ON CONFLICT DO NOTHING to skip duplicates
   */
  static async create(photoData) {
    const query = `
      INSERT INTO strava_activity_photos (
        strava_activity_id, strava_photo_id, photo_url_full,
        photo_url_600, photo_url_300, caption, location,
        created_at_strava
      )
      VALUES ($1, $2, $3, $4, $5, $6, ST_GeogFromText($7), $8)
      ON CONFLICT (strava_photo_id) DO NOTHING
      RETURNING *
    `;

    const values = [
      photoData.strava_activity_id,
      photoData.strava_photo_id,
      photoData.photo_url_full,
      photoData.photo_url_600,
      photoData.photo_url_300,
      photoData.caption,
      photoData.location,
      photoData.created_at_strava
    ];

    const result = await db.query(query, values);
    return result.rows[0]; // Returns undefined if duplicate
  }

  /**
   * Bulk insert photos with ON CONFLICT DO NOTHING
   * IMPORTANT: Returns the actual count of inserted rows (not total rows attempted)
   */
  static async bulkInsert(photos) {
    if (photos.length === 0) return 0;

    // Build VALUES clause: ($1, $2, ...), ($9, $10, ...), ...
    const valuesPerRow = 8;
    const valuesClauses = [];
    const allValues = [];

    photos.forEach((photo, idx) => {
      const offset = idx * valuesPerRow;
      const placeholders = [];

      for (let i = 1; i <= valuesPerRow; i++) {
        placeholders.push(`$${offset + i}`);
      }

      // Special handling for location (ST_GeogFromText)
      if (photo.location) {
        placeholders[6] = `ST_GeogFromText($${offset + 7})`;
      } else {
        placeholders[6] = 'NULL';
      }

      valuesClauses.push(`(${placeholders.join(', ')})`);

      allValues.push(
        photo.strava_activity_id,
        photo.strava_photo_id,
        photo.photo_url_full,
        photo.photo_url_600,
        photo.photo_url_300,
        photo.caption,
        photo.location,
        photo.created_at_strava
      );
    });

    const query = `
      INSERT INTO strava_activity_photos (
        strava_activity_id, strava_photo_id, photo_url_full,
        photo_url_600, photo_url_300, caption, location,
        created_at_strava
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (strava_photo_id) DO NOTHING
      RETURNING id
    `;

    const result = await db.query(query, allValues);

    // CRITICAL: Return the actual number of rows inserted (not photos.length)
    return result.rowCount;
  }

  /**
   * Find photos by activity ID (internal ID)
   */
  static async findByActivityId(activityId) {
    const query = `
      SELECT * FROM strava_activity_photos
      WHERE strava_activity_id = $1
      ORDER BY created_at_strava DESC
    `;

    const result = await db.query(query, [activityId]);
    return result.rows;
  }

  /**
   * Count photos for an activity
   */
  static async countByActivity(activityId) {
    const query = `
      SELECT COUNT(*) as count
      FROM strava_activity_photos
      WHERE strava_activity_id = $1
    `;

    const result = await db.query(query, [activityId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete all photos for an activity
   */
  static async deleteByActivityId(activityId) {
    const query = 'DELETE FROM strava_activity_photos WHERE strava_activity_id = $1';
    const result = await db.query(query, [activityId]);
    return result.rowCount;
  }
}

module.exports = StravaActivityPhoto;
