const request = require('supertest');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const garminAuth = require('../services/garminAuth');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/garminAuth');
jest.mock('../services/geminiSessionManager', () => ({
  startCleanupInterval: jest.fn()
}));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({
    work: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined)
  }),
  stopQueue: jest.fn()
}));

const app = require('../server');
const { getQueue } = require('../jobs/queue');

describe('Garmin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/garmin/connect', () => {
    test('should connect with valid credentials', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: null
      };

      const mockEncryptedToken = 'encrypted-garmin-token-123';

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      garminAuth.authenticate.mockResolvedValueOnce({
        encrypted: mockEncryptedToken
      });
      User.update.mockResolvedValueOnce({
        ...mockUser,
        garmin_session_token_encrypted: mockEncryptedToken,
        garmin_connected_at: new Date()
      });

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'test-token-123')
        .send({
          username: 'garmin-user',
          password: 'garmin-pass'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Garmin connected successfully');
      expect(garminAuth.authenticate).toHaveBeenCalledWith('garmin-user', 'garmin-pass');
      expect(User.update).toHaveBeenCalledWith(1, {
        garmin_session_token_encrypted: mockEncryptedToken,
        garmin_connected_at: expect.any(Date)
      });
    });

    test('should fail without credentials', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'test-token-123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password required');
      expect(garminAuth.authenticate).not.toHaveBeenCalled();
    });

    test('should fail without username', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'test-token-123')
        .send({
          password: 'garmin-pass'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password required');
    });

    test('should fail without password', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'test-token-123')
        .send({
          username: 'garmin-user'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password required');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/garmin/connect')
        .send({
          username: 'garmin-user',
          password: 'garmin-pass'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(garminAuth.authenticate).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'invalid-token')
        .send({
          username: 'garmin-user',
          password: 'garmin-pass'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle Garmin authentication failure', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      garminAuth.authenticate.mockRejectedValueOnce(new Error('Invalid Garmin credentials'));

      const response = await request(app)
        .post('/api/garmin/connect')
        .set('x-auth-token', 'test-token-123')
        .send({
          username: 'garmin-user',
          password: 'wrong-pass'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to connect Garmin');
      expect(response.body.message).toBe('Invalid Garmin credentials');
    });
  });

  describe('POST /api/garmin/sync', () => {
    test('should queue sync job when connected', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123'
      };

      const mockJob = {
        id: 456,
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      ImportJob.create.mockResolvedValueOnce(mockJob);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe(456);
      expect(response.body.message).toContain('Garmin sync queued');
      expect(ImportJob.create).toHaveBeenCalledWith({
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      });
      expect(getQueue().send).toHaveBeenCalledWith('import-garmin-data', {
        jobId: 456,
        userId: 1,
        syncType: 'incremental'
      });
    });

    test('should support custom sync type', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123'
      };

      const mockJob = {
        id: 456,
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      ImportJob.create.mockResolvedValueOnce(mockJob);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'test-token-123')
        .send({ syncType: 'full' });

      expect(response.status).toBe(200);
      expect(getQueue().send).toHaveBeenCalledWith('import-garmin-data', {
        jobId: 456,
        userId: 1,
        syncType: 'full'
      });
    });

    test('should fail when not connected', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: null
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Garmin not connected');
      expect(ImportJob.create).not.toHaveBeenCalled();
      expect(getQueue().send).not.toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/garmin/sync');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(ImportJob.create).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle job creation failure', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      ImportJob.create.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to start Garmin sync');
      expect(response.body.message).toBe('Database error');
    });

    test('should handle queue failure', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123'
      };

      const mockJob = {
        id: 456,
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      ImportJob.create.mockResolvedValueOnce(mockJob);
      getQueue().send.mockRejectedValueOnce(new Error('Queue unavailable'));

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to start Garmin sync');
      expect(response.body.message).toBe('Queue unavailable');
    });
  });

  describe('DELETE /api/garmin/disconnect', () => {
    test('should disconnect Garmin', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123',
        garmin_connected_at: new Date(),
        last_garmin_sync_at: new Date()
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      User.update.mockResolvedValueOnce({
        ...mockUser,
        garmin_session_token_encrypted: null,
        garmin_connected_at: null,
        last_garmin_sync_at: null
      });

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Garmin disconnected successfully');
      expect(User.update).toHaveBeenCalledWith(1, {
        garmin_session_token_encrypted: null,
        garmin_connected_at: null,
        last_garmin_sync_at: null
      });
    });

    test('should disconnect even if not connected', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: null
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      User.update.mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.update).toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/garmin/disconnect');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(User.update).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle database errors', async () => {
      const mockUser = {
        id: 1,
        display_name: 'Test User',
        garmin_session_token_encrypted: 'encrypted-token-123'
      };

      User.findBySecretToken.mockResolvedValueOnce(mockUser);
      User.update.mockRejectedValueOnce(new Error('Database connection lost'));

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', 'test-token-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to disconnect Garmin');
      expect(response.body.message).toBe('Database connection lost');
    });
  });
});
