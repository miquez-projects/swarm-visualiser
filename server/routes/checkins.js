const express = require('express');
const { query, validationResult } = require('express-validator');
const Checkin = require('../models/checkin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkins
// Requires authentication - returns only authenticated user's check-ins
router.get(
  '/',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('category').optional(),
    query('country').optional().isString(),
    query('city').optional().isString(),
    query('search').optional().isString(),
    query('bounds').optional().isString()
      .matches(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/)
      .withMessage('bounds must be in format: minLng,minLat,maxLng,maxLat'),
    query('zoom').optional().isInt({ min: 0, max: 20 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Filter to authenticated user's check-ins only
      const filters = {
        ...req.query,
        userId: req.user.id
      };

      const result = await Checkin.find(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
