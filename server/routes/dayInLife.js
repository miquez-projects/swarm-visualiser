const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const dayInLifeService = require('../services/dayInLifeService');

const router = express.Router();

/**
 * GET /api/day-in-life/:date
 * Get aggregated day in life data for a specific date
 * Requires authentication - returns only authenticated user's data
 */
router.get(
  '/:date',
  authenticateToken,
  [
    param('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('date must be in YYYY-MM-DD format'),
    query('lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('lat must be a valid latitude (-90 to 90)'),
    query('lng')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('lng must be a valid longitude (-180 to 180)')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date } = req.params;
      const userId = req.user.id;

      // Parse optional lat/lng parameters
      const lat = req.query.lat ? parseFloat(req.query.lat) : null;
      const lng = req.query.lng ? parseFloat(req.query.lng) : null;

      // Call service to get aggregated data
      const dayData = await dayInLifeService.getDayInLife(userId, date, lat, lng);

      res.json(dayData);
    } catch (error) {
      console.error('[DAY IN LIFE ROUTE] Error:', error);

      // Handle specific error types
      if (error.message.includes('Invalid date format')) {
        return res.status(400).json({
          error: 'Invalid date format',
          message: error.message
        });
      }

      if (error.message.includes('required')) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
      }

      next(error);
    }
  }
);

module.exports = router;
