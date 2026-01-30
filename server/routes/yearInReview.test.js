const request = require('supertest');
jest.mock('../models/user');
jest.mock('../models/checkin');
jest.mock('../db/connection', () => ({ query: jest.fn() }));
jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));

const User = require('../models/user');
const db = require('../db/connection');
const app = require('../server');

const mockToken = 'test-token';
const mockUser = { id: 1, display_name: 'Test User' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findBySecretToken.mockResolvedValue(mockUser);
  User.update.mockResolvedValue({});
});

describe('Year In Review Routes', () => {
  describe('GET /api/year-in-review/years', () => {
    test('returns available years', async () => {
      db.query.mockResolvedValue({ rows: [{ year: 2024 }, { year: 2023 }] });

      const res = await request(app)
        .get('/api/year-in-review/years')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([2024, 2023]);
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/year-in-review/years');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/year-in-review/:year', () => {
    test('returns annual summary', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '50' }] }) // total
        .mockResolvedValueOnce({ rows: [{ country: 'US', count: '30' }] }) // countries
        .mockResolvedValueOnce({ rows: [{ total: '20' }] }) // venues
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // categories count
        .mockResolvedValueOnce({ rows: [{ first_checkin: '2024-01-01', last_checkin: '2024-12-31' }] }) // date range
        .mockResolvedValueOnce({ rows: [{ category: 'Food', count: '10' }] }) // top categories
        .mockResolvedValueOnce({ rows: [{ venue_name: 'Cafe', count: '5' }] }); // top venues

      const res = await request(app)
        .get('/api/year-in-review/2024')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.total_checkins).toBe(50);
    });

    test('validates year parameter (400)', async () => {
      const res = await request(app)
        .get('/api/year-in-review/abc')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(400);
    });
  });
});
