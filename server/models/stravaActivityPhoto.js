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

    // Build VALUES clause dynamically, adjusting for null locations
    const valuesClauses = [];
    const allValues = [];
    let paramIndex = 1;

    photos.forEach((photo) => {
      const placeholders = [];

      // strava_activity_id
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.strava_activity_id);

      // strava_photo_id
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.strava_photo_id);

      // photo_url_full
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.photo_url_full);

      // photo_url_600
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.photo_url_600);

      // photo_url_300
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.photo_url_300);

      // caption
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.caption);

      // location - special handling for PostGIS
      if (photo.location) {
        placeholders.push(`ST_GeogFromText($${paramIndex++})`);
        allValues.push(photo.location);
      } else {
        placeholders.push('NULL');
        // Don't add to allValues when NULL
      }

      // created_at_strava
      placeholders.push(`$${paramIndex++}`);
      allValues.push(photo.created_at_strava);

      valuesClauses.push(`(${placeholders.join(', ')})`);
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
