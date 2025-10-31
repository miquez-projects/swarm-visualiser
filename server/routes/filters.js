const express = require('express');
const Checkin = require('../models/checkin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/filters/options
// Requires authentication - returns filter options for authenticated user's data only
router.get('/options', authenticateToken, async (req, res, next) => {
  try {
    const options = await Checkin.getFilterOptions(req.user.id);
    res.json(options);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
