const request = require('supertest');
const User = require('../models/user');
const CheckinPhoto = require('../models/checkinPhoto');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../models/checkinPhoto');
jest.mock('../services/geminiSessionManager', () => ({
  startCleanupInterval: jest.fn()
}));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({
    work: jest.fn()
  }),
  stopQueue: jest.fn()
}));

const app = require('../server');

describe('Venue Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/venues/:venueId/photos', () => {
    const mockUser = {
      id: 1,
      display_name: 'Test User'
    };

    test('returns grouped photos for venue with valid token', async () => {
      const mockPhotos = [
        {
          id: 1,
          photo_url: 'https://example.com/photo1.jpg',
          photo_url_cached: null,
          width: 1920,
          height: 1080,
          checkin_date: new Date('2024-01-15')
        },
        {
          id: 2,
          photo_url: 'https://example.com/photo2.jpg',
          photo_url_cached: null,
          width: 1280,
          height: 720,
          checkin_date: new Date('2024-01-15')
        },
        {
          id: 3,
          photo_url: 'https://example.com/photo3.jpg',
          photo_url_cached: null,
          width: 1920,
          height: 1080,
          checkin_date: new Date('2024-01-10')
        }
      ];

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      CheckinPhoto.findByVenueId.mockResolvedValueOnce(mockPhotos);

      const response = await request(app)
        .get('/api/venues/venue123/photos')
        .query({ token: 'test-token-123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Two different dates
      expect(response.body[0].photos).toHaveLength(2); // 2024-01-15 has 2 photos
      expect(response.body[1].photos).toHaveLength(1); // 2024-01-10 has 1 photo

      // Check that dates are sorted newest first
      expect(new Date(response.body[0].date).getTime())
        .toBeGreaterThan(new Date(response.body[1].date).getTime());

      expect(CheckinPhoto.findByVenueId).toHaveBeenCalledWith('venue123', mockUser.id);
    });

    test('returns empty array when venue has no photos', async () => {
      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      CheckinPhoto.findByVenueId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/venues/venue456/photos')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(CheckinPhoto.findByVenueId).toHaveBeenCalledWith('venue456', mockUser.id);
    });

    test('returns 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/venues/venue123/photos');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
      expect(CheckinPhoto.findByVenueId).not.toHaveBeenCalled();
    });

    test('returns 401 with invalid token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/venues/venue123/photos')
        .query({ token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token');
      expect(CheckinPhoto.findByVenueId).not.toHaveBeenCalled();
    });

    test('accepts token in header', async () => {
      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      CheckinPhoto.findByVenueId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/venues/venue789/photos')
        .set('x-auth-token', 'header-token-456');

      expect(response.status).toBe(200);
      expect(User.findBySecretToken).toHaveBeenCalledWith('header-token-456');
    });

    test('prefers cached photo URLs', async () => {
      const mockPhotos = [
        {
          id: 1,
          photo_url: 'https://example.com/photo1.jpg',
          photo_url_cached: 'https://cdn.example.com/cached-photo1.jpg',
          width: 1920,
          height: 1080,
          checkin_date: new Date('2024-01-15')
        }
      ];

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      CheckinPhoto.findByVenueId.mockResolvedValueOnce(mockPhotos);

      const response = await request(app)
        .get('/api/venues/venue999/photos')
        .query({ token: 'test-token' });

      expect(response.status).toBe(200);
      expect(response.body[0].photos[0].url).toBe('https://cdn.example.com/cached-photo1.jpg');
    });

    test('handles database errors gracefully', async () => {
      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      CheckinPhoto.findByVenueId.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/venues/venue123/photos')
        .query({ token: 'test-token' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to get photos');
    });
  });
});
