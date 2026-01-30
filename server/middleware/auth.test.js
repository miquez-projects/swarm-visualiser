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

const mockUser = { id: 1, name: 'Test User', secret_token: 'valid-token' };

beforeEach(() => {
  jest.clearAllMocks();
  User.update = jest.fn().mockResolvedValue(mockUser);
  Checkin.find = jest.fn().mockResolvedValue([]);
});

describe('Auth Middleware', () => {
  describe('authenticateToken', () => {
    test('passes with valid token in header', async () => {
      User.findBySecretToken.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', 'valid-token');

      expect(res.status).not.toBe(401);
      expect(User.findBySecretToken).toHaveBeenCalledWith('valid-token');
    });

    test('passes with valid token in query param', async () => {
      User.findBySecretToken.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/checkins?token=valid-token');

      expect(res.status).not.toBe(401);
      expect(User.findBySecretToken).toHaveBeenCalledWith('valid-token');
    });

    test('rejects missing token with 401', async () => {
      const res = await request(app)
        .get('/api/checkins');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    test('rejects invalid token with 401', async () => {
      User.findBySecretToken.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/checkins')
        .set('x-auth-token', 'bad-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid token');
    });
  });
});
