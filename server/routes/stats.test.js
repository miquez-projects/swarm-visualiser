const request = require('supertest');
jest.mock('../models/user');
jest.mock('../models/checkin');
jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));

const User = require('../models/user');
const Checkin = require('../models/checkin');
const app = require('../server');

const mockToken = 'test-token';
const mockUser = { id: 1, display_name: 'Test User' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findBySecretToken.mockResolvedValue(mockUser);
  User.update.mockResolvedValue({});
});

describe('Stats Routes', () => {
  describe('GET /api/stats', () => {
    test('returns stats for authenticated user', async () => {
      const mockStats = { total_checkins: 50, top_countries: [], top_categories: [] };
      Checkin.getStats.mockResolvedValue(mockStats);

      const res = await request(app)
        .get('/api/stats')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockStats);
      expect(Checkin.getStats).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/stats/compare', () => {
    test('calls getStats for both periods with correct filters', async () => {
      const period1 = { total_checkins: 10, top_countries: [{ country: 'US' }], top_categories: [{ category: 'Food' }] };
      const period2 = { total_checkins: 15, top_countries: [{ country: 'US' }, { country: 'UK' }], top_categories: [{ category: 'Food' }] };
      Checkin.getStats
        .mockResolvedValueOnce(period1)
        .mockResolvedValueOnce(period2);

      const res = await request(app)
        .get('/api/stats/compare?period1_start=2024-01-01T00:00:00.000Z&period1_end=2024-06-30T00:00:00.000Z&period2_start=2024-07-01T00:00:00.000Z&period2_end=2024-12-31T00:00:00.000Z')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      // Verify getStats was called twice with userId scoped filters
      expect(Checkin.getStats).toHaveBeenCalledTimes(2);
      expect(Checkin.getStats).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
    });

    test('returns 400 without required date params', async () => {
      const res = await request(app)
        .get('/api/stats/compare')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
    });

    test('returns 400 with invalid date format', async () => {
      const res = await request(app)
        .get('/api/stats/compare?period1_start=bad&period1_end=bad&period2_start=bad&period2_end=bad')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('returns 400 with partial date params', async () => {
      const res = await request(app)
        .get('/api/stats/compare?period1_start=2024-01-01T00:00:00.000Z')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/stats - error paths', () => {
    test('returns 500 when getStats rejects', async () => {
      Checkin.getStats.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/stats')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(500);
    });

    test('returns 400 for invalid startDate format', async () => {
      const res = await request(app)
        .get('/api/stats?startDate=not-a-date')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test('returns 500 when compare getStats rejects', async () => {
      Checkin.getStats.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/stats/compare?period1_start=2024-01-01T00:00:00.000Z&period1_end=2024-06-30T00:00:00.000Z&period2_start=2024-07-01T00:00:00.000Z&period2_end=2024-12-31T00:00:00.000Z')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(500);
    });
  });
});
