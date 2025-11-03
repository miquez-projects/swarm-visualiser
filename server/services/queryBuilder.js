const db = require('../db/connection');

// Whitelisted fields (must match actual database schema)
const ALLOWED_FIELDS = {
  checkins: [
    'id', 'venue_id', 'venue_name', 'venue_category', 'city', 'country',
    'checkin_date', 'latitude', 'longitude', 'created_at'
  ]
};

const ALLOWED_AGGREGATIONS = ['count', 'avg', 'min', 'max', 'sum'];

// Date granularity SQL templates
const DATE_GRANULARITIES = {
  'day': 'DATE(checkin_date)',
  'week': 'DATE_TRUNC(\'week\', checkin_date)',
  'month': 'DATE_TRUNC(\'month\', checkin_date)',
  'year': 'DATE_TRUNC(\'year\', checkin_date)'
};

class QueryBuilder {
  /**
   * Build and execute a query based on AI parameters
   */
  async executeQuery(params, userId) {
    const { queryType } = params;

    let query;
    let responseLimit = null;

    if (queryType === 'checkins') {
      // Apply stricter limit for individual records to save tokens
      const originalLimit = params.limit;
      params.limit = params.limit ? Math.min(params.limit, 15) : 15;
      responseLimit = params.limit;

      query = this.buildCheckinsQuery(params, userId);

      // Get total count for metadata
      const countQuery = this.buildCountQuery(params, userId);
      const countResult = await db.query(countQuery.sql, countQuery.values);
      const totalCount = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(query.sql, query.values);

      return {
        data: result.rows,
        metadata: {
          returned: result.rows.length,
          total: totalCount,
          limited: totalCount > result.rows.length,
          message: totalCount > result.rows.length
            ? `Showing ${result.rows.length} of ${totalCount} results. Results are limited to save context.`
            : null
        }
      };
    } else if (queryType === 'aggregation') {
      query = this.buildAggregationQuery(params, userId);
      const result = await db.query(query.sql, query.values);

      return {
        data: result.rows,
        metadata: {
          returned: result.rows.length,
          total: result.rows.length,
          limited: false
        }
      };
    } else {
      throw new Error('Invalid query type');
    }
  }

  /**
   * Build a COUNT query to get total results
   */
  buildCountQuery(params, userId) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    // Apply same filters as main query
    if (params.filters) {
      if (params.filters.country) {
        conditions.push(`country = $${paramIndex++}`);
        values.push(params.filters.country);
      }

      if (params.filters.city) {
        conditions.push(`city = $${paramIndex++}`);
        values.push(params.filters.city);
      }

      if (params.filters.category) {
        conditions.push(`venue_category = $${paramIndex++}`);
        values.push(params.filters.category);
      }

      if (params.filters.venueName) {
        conditions.push(`venue_name ILIKE $${paramIndex++}`);
        values.push(`%${params.filters.venueName}%`);
      }

      if (params.filters.dateRange) {
        const { start, end } = params.filters.dateRange;
        if (start && end) {
          conditions.push(`checkin_date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
          values.push(start, end);
        } else if (start) {
          conditions.push(`checkin_date >= $${paramIndex++}`);
          values.push(start);
        } else if (end) {
          conditions.push(`checkin_date <= $${paramIndex++}`);
          values.push(end);
        }
      }
    }

    const sql = `SELECT COUNT(*) as count FROM checkins WHERE ${conditions.join(' AND ')}`;
    return { sql, values };
  }

  /**
   * Build a simple SELECT query
   */
  buildCheckinsQuery(params, userId) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    // Apply filters
    if (params.filters) {
      if (params.filters.country) {
        conditions.push(`country = $${paramIndex++}`);
        values.push(params.filters.country);
      }

      if (params.filters.city) {
        conditions.push(`city = $${paramIndex++}`);
        values.push(params.filters.city);
      }

      if (params.filters.category) {
        conditions.push(`venue_category = $${paramIndex++}`);
        values.push(params.filters.category);
      }

      if (params.filters.venueName) {
        conditions.push(`venue_name ILIKE $${paramIndex++}`);
        values.push(`%${params.filters.venueName}%`);
      }

      if (params.filters.dateRange) {
        const { start, end } = params.filters.dateRange;
        if (start && end) {
          conditions.push(`checkin_date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
          values.push(start, end);
        } else if (start) {
          conditions.push(`checkin_date >= $${paramIndex++}`);
          values.push(start);
        } else if (end) {
          conditions.push(`checkin_date <= $${paramIndex++}`);
          values.push(end);
        }
      }
    }

    // Build SELECT clause
    const fields = params.select || ['venue_name', 'city', 'country', 'checkin_date'];
    const validatedFields = fields.map(f => this.validateField(f)).join(', ');

    let sql = `SELECT ${validatedFields} FROM checkins WHERE ${conditions.join(' AND ')}`;

    // Add ORDER BY
    if (params.orderBy) {
      const field = this.validateField(params.orderBy.field);
      const direction = params.orderBy.direction === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${field} ${direction}`;
    }

    // Add LIMIT
    const limit = params.limit ? Math.min(parseInt(params.limit, 10), 1000) : 100;
    sql += ` LIMIT ${limit}`;

    return { sql, values };
  }

  /**
   * Build an aggregation query
   */
  buildAggregationQuery(params, userId) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    // Apply filters (same as above)
    if (params.filters) {
      if (params.filters.country) {
        conditions.push(`country = $${paramIndex++}`);
        values.push(params.filters.country);
      }

      if (params.filters.city) {
        conditions.push(`city = $${paramIndex++}`);
        values.push(params.filters.city);
      }

      if (params.filters.category) {
        conditions.push(`venue_category = $${paramIndex++}`);
        values.push(params.filters.category);
      }

      if (params.filters.venueName) {
        conditions.push(`venue_name ILIKE $${paramIndex++}`);
        values.push(`%${params.filters.venueName}%`);
      }

      if (params.filters.dateRange) {
        const { start, end } = params.filters.dateRange;
        if (start && end) {
          conditions.push(`checkin_date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
          values.push(start, end);
        } else if (start) {
          conditions.push(`checkin_date >= $${paramIndex++}`);
          values.push(start);
        } else if (end) {
          conditions.push(`checkin_date <= $${paramIndex++}`);
          values.push(end);
        }
      }
    }

    // Build aggregation
    const aggFunc = (params.aggregation?.function || 'count').toUpperCase();
    if (!ALLOWED_AGGREGATIONS.includes(aggFunc.toLowerCase())) {
      throw new Error('Invalid aggregation function');
    }

    const aggField = params.aggregation?.field
      ? this.validateField(params.aggregation.field)
      : '*';

    // Build GROUP BY fields
    let groupByClause = '';
    let selectFields = '';

    if (params.groupBy && params.groupBy.length > 0) {
      const groupByFields = params.groupBy.map(g => {
        if (typeof g === 'object' && g.field === 'checkin_date' && g.granularity) {
          const granularity = DATE_GRANULARITIES[g.granularity];
          if (!granularity) throw new Error('Invalid date granularity');
          return granularity;
        }
        return this.validateField(g);
      });

      selectFields = groupByFields.join(', ') + ', ';
      groupByClause = ` GROUP BY ${groupByFields.join(', ')}`;
    }

    let sql = `SELECT ${selectFields}${aggFunc}(${aggField}) as result FROM checkins WHERE ${conditions.join(' AND ')}${groupByClause}`;

    // Add ORDER BY if specified
    if (params.orderBy) {
      const field = params.orderBy.field === 'result' ? 'result' : this.validateField(params.orderBy.field);
      const direction = params.orderBy.direction === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${field} ${direction}`;
    }

    // Add LIMIT
    const limit = params.limit ? Math.min(parseInt(params.limit, 10), 1000) : 100;
    sql += ` LIMIT ${limit}`;

    return { sql, values };
  }

  /**
   * Get distinct categories for the user
   */
  async getCategories(userId) {
    const sql = `
      SELECT DISTINCT venue_category
      FROM checkins
      WHERE user_id = $1 AND venue_category IS NOT NULL
      ORDER BY venue_category
    `;

    try {
      const result = await db.query(sql, [userId]);
      return result.rows.map(row => row.venue_category);
    } catch (error) {
      console.error('Get categories error:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Validate field name is whitelisted
   */
  validateField(field) {
    if (typeof field !== 'string') {
      throw new Error('Invalid field type');
    }

    const cleanField = field.trim();

    if (!ALLOWED_FIELDS.checkins.includes(cleanField)) {
      throw new Error(`Field not allowed: ${cleanField}`);
    }

    return cleanField;
  }
}

module.exports = new QueryBuilder();
