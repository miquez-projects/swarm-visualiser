const express = require('express');
const Checkin = require('../models/checkin');

const router = express.Router();

// GET /api/filters/options
router.get('/options', async (req, res, next) => {
  try {
    const options = await Checkin.getFilterOptions();
    res.json(options);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
