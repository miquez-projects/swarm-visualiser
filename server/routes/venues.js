const express = require('express');
const router = express.Router();
const CheckinPhoto = require('../models/checkinPhoto');
const User = require('../models/user');

/**
 * GET /api/venues/:venueId/photos
 * Get all photos for a specific venue
 * Requires authentication via token (query param or header)
 */
router.get('/:venueId/photos', async (req, res) => {
  try {
    const { venueId } = req.params;
    const token = req.query.token || req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided'
      });
    }

    const user = await User.findBySecretToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired'
      });
    }

    // Get photos for this venue
    const photos = await CheckinPhoto.findByVenueId(venueId, user.id);

    // Group photos by check-in date
    const groupedPhotos = {};
    photos.forEach(photo => {
      const dateKey = new Date(photo.checkin_date).toISOString().split('T')[0];

      if (!groupedPhotos[dateKey]) {
        groupedPhotos[dateKey] = {
          date: photo.checkin_date,
          photos: []
        };
      }

      groupedPhotos[dateKey].photos.push({
        id: photo.id,
        url: photo.photo_url_cached || photo.photo_url,
        width: photo.width,
        height: photo.height
      });
    });

    // Convert to array and sort by date (newest first)
    const result = Object.values(groupedPhotos).sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    res.json(result);
  } catch (error) {
    console.error('Get venue photos error:', error);
    res.status(500).json({
      error: 'Failed to get photos',
      message: error.message
    });
  }
});

module.exports = router;
