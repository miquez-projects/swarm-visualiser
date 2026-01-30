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

describe('Checkins Routes', () => {
  describe('GET /api/checkins', () => {
    test('returns checkins for authenticated user', async () => {
      const mockCheckins = { checkins: [{ id: 1, venue_name: 'Cafe' }], total: 1 };
      Checkin.find.mockResolvedValue(mockCheckins);

      const res = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCheckins);
      expect(Checkin.find).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/checkins');
      expect(res.status).toBe(401);
    });

    test('passes filter params to model', async () => {
      Checkin.find.mockResolvedValue({ checkins: [], total: 0 });

      await request(app)
        .get('/api/checkins?country=US&city=NYC&category=Food')
        .set('x-auth-token', mockToken);

      expect(Checkin.find).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', city: 'NYC', category: 'Food', userId: 1 })
      );
    });
  });
});
