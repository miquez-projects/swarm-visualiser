const request = require('supertest');
const User = require('../models/user');

// Mock dependencies before requiring server
jest.mock('../models/user');
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

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/me', () => {
    test('returns user info with valid token', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        last_sync_at: new Date('2024-01-01')
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('displayName');
      expect(response.body.displayName).toBe('Test User');
      expect(User.findBySecretToken).toHaveBeenCalledWith('test-token-123');
    });

    test('returns 401 with invalid token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('returns 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('accepts token in query parameter', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        last_sync_at: new Date('2024-01-01')
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .get('/api/auth/me?token=test-token-123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(User.findBySecretToken).toHaveBeenCalledWith('test-token-123');
    });
  });
});
