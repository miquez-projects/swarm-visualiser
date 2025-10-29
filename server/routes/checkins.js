const express = require('express');
const { query, validationResult } = require('express-validator');
const Checkin = require('../models/checkin');

const router = express.Router();

// GET /api/checkins
router.get(
  '/',
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

      const result = await Checkin.find(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
