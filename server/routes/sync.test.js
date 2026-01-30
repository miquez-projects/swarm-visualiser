const request = require('supertest');
const User = require('../models/user');
const { syncAllDataSources } = require('../services/syncAll');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../services/syncAll');
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

describe('Sync Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sync/all', () => {
    test('returns sync results with valid token', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      };

      const mockSyncResults = {
        foursquare: { status: 'queued', jobId: 123 }
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      syncAllDataSources.mockResolvedValueOnce(mockSyncResults);

      const response = await request(app)
        .post('/api/sync/all')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.results.foursquare).toBeDefined();
      expect(response.body.message).toBe('Sync jobs queued. Check progress in import history.');
      expect(User.findBySecretToken).toHaveBeenCalledWith('test-token-123');
      expect(syncAllDataSources).toHaveBeenCalledWith(1);
    });

    test('returns 401 without authentication', async () => {
      const response = await request(app).post('/api/sync/all');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    test('returns 401 with invalid token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/sync/all')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('accepts token in query parameter', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      };

      const mockSyncResults = {
        foursquare: { status: 'queued', jobId: 123 }
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      syncAllDataSources.mockResolvedValueOnce(mockSyncResults);

      const response = await request(app)
        .post('/api/sync/all?token=test-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.findBySecretToken).toHaveBeenCalledWith('test-token-123');
    });

    test('handles sync service errors gracefully', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      syncAllDataSources.mockRejectedValueOnce(new Error('Sync service failed'));

      const response = await request(app)
        .post('/api/sync/all')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Sync failed');
      expect(response.body.message).toBe('Sync service failed');
    });
  });
});
