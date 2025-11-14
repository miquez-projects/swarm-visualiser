const db = require('../db/connection');

class CheckinPhoto {
  /**
   * Create a new checkin photo record
   * @param {Object} photoData - Photo data { checkin_id, photo_url, width, height }
   * @returns {Promise<Object>} Inserted photo record
   */
  static async create(photoData) {
    const query = `
      INSERT INTO checkin_photos (
        checkin_id, photo_url, width, height
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const params = [
      photoData.checkin_id,
      photoData.photo_url,
      photoData.width || null,
      photoData.height || null
    ];

    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Find all photos for a specific check-in
   * @param {number} checkinId - Check-in ID
   * @returns {Promise<Array>} Array of photo records
   */
  static async findByCheckinId(checkinId) {
    const query = `
      SELECT id, checkin_id, photo_url, photo_url_cached, width, height, created_at
      FROM checkin_photos
      WHERE checkin_id = $1
      ORDER BY created_at ASC
    `;

    const result = await db.query(query, [checkinId]);
    return result.rows;
  }

  /**
   * Find all photos for a specific venue (across all check-ins by a user)
   * @param {string} venueId - Venue ID from Foursquare
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of photos with check-in date
   */
  static async findByVenueId(venueId, userId) {
    const query = `
      SELECT
        cp.id,
        cp.photo_url,
        cp.photo_url_cached,
        cp.width,
        cp.height,
        c.checkin_date,
        c.venue_id
      FROM checkin_photos cp
      INNER JOIN checkins c ON cp.checkin_id = c.id
      WHERE c.venue_id = $1 AND c.user_id = $2
      ORDER BY c.checkin_date DESC, cp.created_at ASC
    `;

    const result = await db.query(query, [venueId, userId]);
    return result.rows;
  }

  /**
   * Update cached URL for a photo
   * @param {number} id - Photo ID
   * @param {string} cachedUrl - Cached URL
   * @returns {Promise<Object>} Updated photo record
   */
  static async updateCachedUrl(id, cachedUrl) {
    const query = `
      UPDATE checkin_photos
      SET photo_url_cached = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [cachedUrl, id]);
    return result.rows[0];
  }

  /**
   * Bulk insert photos (for data import)
   * @param {Array} photos - Array of photo objects
   * @returns {Promise<number>} Number of inserted records
   */
  static async bulkInsert(photos) {
    if (!photos || photos.length === 0) {
      return 0;
    }

    const values = photos.map((p, index) => {
      const offset = index * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(',');

    const params = photos.flatMap(p => [
      p.checkin_id,
      p.photo_url,
      p.width || null,
      p.height || null
    ]);

    const query = `
      INSERT INTO checkin_photos (
        checkin_id, photo_url, width, height
      ) VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    const result = await db.query(query, params);
    return result.rowCount;
  }
}

module.exports = CheckinPhoto;
