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

describe('Filters Routes', () => {
  describe('GET /api/filters/options', () => {
    test('returns filter options for authenticated user', async () => {
      const mockOptions = {
        countries: ['US', 'UK'],
        cities: ['NYC', 'London'],
        categories: ['Food', 'Travel']
      };
      Checkin.getFilterOptions.mockResolvedValue(mockOptions);

      const res = await request(app)
        .get('/api/filters/options')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOptions);
      expect(Checkin.getFilterOptions).toHaveBeenCalledWith(1);
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/filters/options');
      expect(res.status).toBe(401);
    });
  });
});
