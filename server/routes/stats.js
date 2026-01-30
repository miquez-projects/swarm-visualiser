const express = require('express');
const { query, validationResult } = require('express-validator');
const Checkin = require('../models/checkin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats
// Requires authentication - returns only authenticated user's stats
router.get(
  '/',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('category').optional(),
    query('country').optional().isString(),
    query('city').optional().isString()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Filter to authenticated user's data only
      const filters = {
        ...req.query,
        userId: req.user.id
      };

      const stats = await Checkin.getStats(filters);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/stats/compare
// Requires authentication - compares authenticated user's data only
router.get(
  '/compare',
  authenticateToken,
  [
    query('period1_start').isISO8601().toDate(),
    query('period1_end').isISO8601().toDate(),
    query('period2_start').isISO8601().toDate(),
    query('period2_end').isISO8601().toDate(),
    query('category').optional(),
    query('country').optional().isString(),
    query('city').optional().isString()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        period1_start,
        period1_end,
        period2_start,
        period2_end,
        category,
        country,
        city
      } = req.query;

      // Filter to authenticated user's data only
      const baseFilters = {
        category,
        country,
        city,
        userId: req.user.id
      };

      // Get stats for both periods
      const [period1Stats, period2Stats] = await Promise.all([
        Checkin.getStats({
          ...baseFilters,
          startDate: period1_start,
          endDate: period1_end
        }),
        Checkin.getStats({
          ...baseFilters,
          startDate: period2_start,
          endDate: period2_end
        })
      ]);

      // Calculate comparison metrics
      const checkins_change = period2Stats.total_checkins - period1Stats.total_checkins;
      const checkins_change_percent = period1Stats.total_checkins > 0
        ? ((checkins_change / period1Stats.total_checkins) * 100).toFixed(1)
        : 0;

      // Find new countries in period 2
      const period1Countries = new Set(period1Stats.top_countries.map(c => c.country));
      const new_countries = period2Stats.top_countries
        .filter(c => !period1Countries.has(c.country))
        .map(c => c.country);

      // Find new categories in period 2
      const period1Categories = new Set(period1Stats.top_categories.map(c => c.category));
      const new_categories = period2Stats.top_categories
        .filter(c => !period1Categories.has(c.category))
        .map(c => c.category);

      res.json({
        period1: {
          label: `${new Date(period1_start).toISOString().split('T')[0]} to ${new Date(period1_end).toISOString().split('T')[0]}`,
          ...period1Stats
        },
        period2: {
          label: `${new Date(period2_start).toISOString().split('T')[0]} to ${new Date(period2_end).toISOString().split('T')[0]}`,
          ...period2Stats
        },
        comparison: {
          checkins_change: parseInt(checkins_change),
          checkins_change_percent: parseFloat(checkins_change_percent),
          new_countries,
          new_categories
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
