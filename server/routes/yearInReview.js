const express = require('express');
const { param, validationResult } = require('express-validator');
const Checkin = require('../models/checkin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/year-in-review/years
// Get all available years for the authenticated user
router.get('/years', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT DISTINCT EXTRACT(YEAR FROM checkin_date)::int as year
      FROM checkins
      WHERE user_id = $1
      ORDER BY year DESC
    `;
    const result = await require('../db/connection').query(query, [req.user.id]);
    res.json(result.rows.map(r => r.year));
  } catch (error) {
    next(error);
  }
});

// GET /api/year-in-review/:year
// Get annual summary for a specific year
router.get(
  '/:year',
  authenticateToken,
  [param('year').isInt({ min: 2000, max: 2100 }).toInt()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const year = req.params.year;
      const userId = req.user.id;
      const db = require('../db/connection');

      // Date range for the year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Total check-ins
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
      `;
      const totalResult = await db.query(totalQuery, [userId, startDate, endDate]);

      // Unique countries
      const countriesQuery = `
        SELECT DISTINCT country, COUNT(*) as count
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
        AND country IS NOT NULL
        GROUP BY country
        ORDER BY count DESC
      `;
      const countriesResult = await db.query(countriesQuery, [userId, startDate, endDate]);

      // Unique venues
      const venuesQuery = `
        SELECT COUNT(DISTINCT venue_id) as total
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
      `;
      const venuesResult = await db.query(venuesQuery, [userId, startDate, endDate]);

      // Unique categories
      const categoriesCountQuery = `
        SELECT COUNT(DISTINCT venue_category) as total
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
        AND venue_category IS NOT NULL
      `;
      const categoriesCountResult = await db.query(categoriesCountQuery, [userId, startDate, endDate]);

      // First and last check-in
      const dateRangeQuery = `
        SELECT
          MIN(checkin_date) as first_checkin,
          MAX(checkin_date) as last_checkin
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
      `;
      const dateRangeResult = await db.query(dateRangeQuery, [userId, startDate, endDate]);

      // Top categories
      const topCategoriesQuery = `
        SELECT venue_category as category, COUNT(*) as count
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
        AND venue_category IS NOT NULL
        GROUP BY venue_category
        ORDER BY count DESC
        LIMIT 5
      `;
      const topCategoriesResult = await db.query(topCategoriesQuery, [userId, startDate, endDate]);

      // Top venues
      const topVenuesQuery = `
        SELECT venue_name, COUNT(*) as count
        FROM checkins
        WHERE user_id = $1
        AND checkin_date >= $2
        AND checkin_date <= $3
        GROUP BY venue_name
        ORDER BY count DESC
        LIMIT 5
      `;
      const topVenuesResult = await db.query(topVenuesQuery, [userId, startDate, endDate]);

      res.json({
        year,
        total_checkins: parseInt(totalResult.rows[0].total),
        countries: countriesResult.rows,
        countries_count: countriesResult.rows.length,
        venues_count: parseInt(venuesResult.rows[0].total),
        categories_count: parseInt(categoriesCountResult.rows[0].total),
        first_checkin: dateRangeResult.rows[0].first_checkin,
        last_checkin: dateRangeResult.rows[0].last_checkin,
        top_categories: topCategoriesResult.rows,
        top_venues: topVenuesResult.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
