const db = require('../db/connection');

class Checkin {
  /**
   * Find check-ins with optional filters and pagination
   * @param {Object} filters - { userId, startDate, endDate, category, country, city, search, limit, offset }
   * @returns {Promise<{data: Array, total: number}>}
   */
  static async find(filters = {}) {
    const {
      userId,
      startDate,
      endDate,
      category,
      country,
      city,
      search,
      limit = 1000,
      offset = 0
    } = filters;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by user_id if provided (for multi-user support)
    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`checkin_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`checkin_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (category) {
      if (Array.isArray(category)) {
        // Handle array of categories (ANY of them)
        conditions.push(`venue_category = ANY($${paramIndex})`);
        params.push(category);
        paramIndex++;
      } else {
        // Handle single category
        conditions.push(`venue_category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }
    }

    if (country) {
      conditions.push(`country = $${paramIndex++}`);
      params.push(country);
    }

    if (city) {
      conditions.push(`city = $${paramIndex++}`);
      params.push(city);
    }

    if (search) {
      conditions.push(`venue_name ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM checkins ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT
        id, venue_id, venue_name, venue_category,
        latitude, longitude, checkin_date,
        city, country
      FROM checkins
      ${whereClause}
      ORDER BY checkin_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await db.query(dataQuery, dataParams);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset
    };
  }

  /**
   * Get statistics with optional filters
   * @param {Object} filters - Same as find()
   * @returns {Promise<Object>} Statistics object
   */
  static async getStats(filters = {}) {
    const {
      userId,
      startDate,
      endDate,
      category,
      country,
      city
    } = filters;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by user_id if provided (for multi-user support)
    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`checkin_date >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`checkin_date <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (category) {
      if (Array.isArray(category)) {
        // Handle array of categories (ANY of them)
        conditions.push(`venue_category = ANY($${paramIndex})`);
        params.push(category);
        paramIndex++;
      } else {
        // Handle single category
        conditions.push(`venue_category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }
    }

    if (country) {
      conditions.push(`country = $${paramIndex++}`);
      params.push(country);
    }

    if (city) {
      conditions.push(`city = $${paramIndex++}`);
      params.push(city);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Total count
    const totalQuery = `SELECT COUNT(*) as total FROM checkins ${whereClause}`;
    const totalResult = await db.query(totalQuery, params);

    // Date range
    const dateRangeQuery = `
      SELECT
        MIN(checkin_date) as first_checkin,
        MAX(checkin_date) as last_checkin
      FROM checkins
      ${whereClause}
    `;
    const dateRangeResult = await db.query(dateRangeQuery, params);

    // Top countries
    const topCountriesQuery = `
      SELECT country, COUNT(*) as count
      FROM checkins
      ${whereClause}
      GROUP BY country
      ORDER BY count DESC
      LIMIT 5
    `;
    const topCountriesResult = await db.query(topCountriesQuery, params);

    // Top categories
    const topCategoriesQuery = `
      SELECT venue_category as category, COUNT(*) as count
      FROM checkins
      ${whereClause}
      GROUP BY venue_category
      ORDER BY count DESC
      LIMIT 5
    `;
    const topCategoriesResult = await db.query(topCategoriesQuery, params);

    // Most visited venue
    const topVenueQuery = `
      SELECT venue_name, COUNT(*) as count
      FROM checkins
      ${whereClause}
      GROUP BY venue_name
      ORDER BY count DESC
      LIMIT 1
    `;
    const topVenueResult = await db.query(topVenueQuery, params);

    // Determine timeline granularity based on date range
    // Maximum granularity is monthly - we have enough screen space
    let timelineQuery;
    const dateRange = dateRangeResult.rows[0];

    if (dateRange.first_checkin && dateRange.last_checkin) {
      const daysDiff = Math.floor(
        (new Date(dateRange.last_checkin) - new Date(dateRange.first_checkin)) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= 7) {
        // Daily granularity for 1 week or less
        timelineQuery = `
          SELECT
            EXTRACT(YEAR FROM checkin_date)::int as year,
            EXTRACT(MONTH FROM checkin_date)::int as month,
            EXTRACT(DAY FROM checkin_date)::int as day,
            COUNT(*) as count
          FROM checkins
          ${whereClause}
          GROUP BY year, month, day
          ORDER BY year, month, day
        `;
      } else if (daysDiff <= 60) {
        // Weekly granularity for 2 months or less
        timelineQuery = `
          SELECT
            EXTRACT(YEAR FROM checkin_date)::int as year,
            EXTRACT(WEEK FROM checkin_date)::int as week,
            COUNT(*) as count
          FROM checkins
          ${whereClause}
          GROUP BY year, week
          ORDER BY year, week
        `;
      } else {
        // Monthly granularity for everything else (2 months to 15+ years)
        timelineQuery = `
          SELECT
            EXTRACT(YEAR FROM checkin_date)::int as year,
            EXTRACT(MONTH FROM checkin_date)::int as month,
            COUNT(*) as count
          FROM checkins
          ${whereClause}
          GROUP BY year, month
          ORDER BY year, month
        `;
      }
    } else {
      // Default to monthly if no date range
      timelineQuery = `
        SELECT
          EXTRACT(YEAR FROM checkin_date)::int as year,
          EXTRACT(MONTH FROM checkin_date)::int as month,
          COUNT(*) as count
        FROM checkins
        ${whereClause}
        GROUP BY year, month
        ORDER BY year, month
      `;
    }

    const timelineResult = await db.query(timelineQuery, params);

    // Unmappable count
    const unmappableQuery = `
      SELECT COUNT(*) as count
      FROM checkins
      ${whereClause}
      ${conditions.length > 0 ? 'AND' : 'WHERE'} (latitude IS NULL OR longitude IS NULL)
    `;
    const unmappableResult = await db.query(unmappableQuery, params);

    return {
      total_checkins: parseInt(totalResult.rows[0].total),
      date_range: dateRangeResult.rows[0],
      top_countries: topCountriesResult.rows,
      top_categories: topCategoriesResult.rows,
      top_venue: topVenueResult.rows[0] || null,
      timeline: timelineResult.rows,
      unmappable_count: parseInt(unmappableResult.rows[0].count)
    };
  }

  /**
   * Get available filter options for a specific user
   * @param {string} userId - User ID to filter options
   * @returns {Promise<Object>} Available countries, cities, categories
   */
  static async getFilterOptions(userId) {
    const countriesQuery = `
      SELECT DISTINCT country
      FROM checkins
      WHERE country IS NOT NULL AND user_id = $1
      ORDER BY country
    `;
    const countriesResult = await db.query(countriesQuery, [userId]);

    const citiesQuery = `
      SELECT DISTINCT city
      FROM checkins
      WHERE city IS NOT NULL AND user_id = $1
      ORDER BY city
    `;
    const citiesResult = await db.query(citiesQuery, [userId]);

    const categoriesQuery = `
      SELECT DISTINCT venue_category
      FROM checkins
      WHERE venue_category IS NOT NULL AND user_id = $1
      ORDER BY venue_category
    `;
    const categoriesResult = await db.query(categoriesQuery, [userId]);

    return {
      countries: countriesResult.rows.map(r => r.country),
      cities: citiesResult.rows.map(r => r.city),
      categories: categoriesResult.rows.map(r => r.venue_category)
    };
  }

  /**
   * Insert a single check-in
   * @param {Object} checkin - Checkin object
   * @returns {Promise<Object>} Inserted checkin
   */
  static async insert(checkin) {
    const query = `
      INSERT INTO checkins (
        user_id, venue_id, venue_name, venue_category,
        latitude, longitude, checkin_date,
        city, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      checkin.user_id || null,
      checkin.venue_id || null,
      checkin.venue_name,
      checkin.venue_category || 'Unknown',
      checkin.latitude || null,
      checkin.longitude || null,
      checkin.checkin_date,
      checkin.city || 'Unknown',
      checkin.country || 'Unknown'
    ];

    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Bulk insert check-ins (for data import)
   * @param {Array} checkins - Array of checkin objects
   * @returns {Promise<number>} Number of inserted records
   */
  static async bulkInsert(checkins) {
    if (!checkins || checkins.length === 0) {
      return 0;
    }

    // Validate required fields
    const invalidCheckins = checkins.filter(c => !c.venue_name || !c.checkin_date);
    if (invalidCheckins.length > 0) {
      throw new Error(`Invalid checkins: ${invalidCheckins.length} records missing venue_name or checkin_date`);
    }

    const values = checkins.map((c, index) => {
      const offset = index * 9;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
    }).join(',');

    const params = checkins.flatMap(c => [
      c.user_id || null,
      c.venue_id || null,
      c.venue_name,
      c.venue_category || 'Unknown',
      c.latitude || null,
      c.longitude || null,
      c.checkin_date,
      c.city || 'Unknown',
      c.country || 'Unknown'
    ]);

    const query = `
      INSERT INTO checkins (
        user_id, venue_id, venue_name, venue_category,
        latitude, longitude, checkin_date,
        city, country
      ) VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    const result = await db.query(query, params);
    return result.rowCount;
  }
}

module.exports = Checkin;
