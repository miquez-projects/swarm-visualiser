const express = require('express');
const { query, validationResult } = require('express-validator');
const Checkin = require('../models/checkin');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkins
// Optional authentication - if token provided, filter to user's checkins only
router.get(
  '/',
  optionalAuth,
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('category').optional().isString(),
    query('country').optional().isString(),
    query('city').optional().isString(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 5000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // If user is authenticated, filter to their checkins only
      const filters = { ...req.query };
      if (req.user) {
        filters.userId = req.user.id;
      }

      const result = await Checkin.find(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
