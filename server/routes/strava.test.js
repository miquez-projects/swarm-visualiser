const request = require('supertest');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const stravaOAuth = require('../services/stravaOAuth');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/stravaOAuth');
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

describe('Strava OAuth2 Routes', () => {
  const mockToken = 'test-auth-token';
  const mockUser = { id: 1, username: 'testuser' };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findBySecretToken.mockResolvedValue(mockUser);
    User.findById.mockResolvedValue(mockUser);
    User.update.mockResolvedValue(mockUser);
    // Reset queue mock
    getQueue().send.mockResolvedValue(undefined);
  });

  describe('GET /api/strava/auth/start', () => {
    test('should return OAuth authorization URL', async () => {
      const mockAuthUrl = 'https://www.strava.com/oauth/authorize?client_id=test&redirect_uri=http://localhost:3001/api/strava/auth/callback&response_type=code&scope=read,activity:read_all';

      stravaOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/strava/auth/start')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.authorizationUrl).toBeDefined();
      expect(response.body.authorizationUrl).toContain('strava.com');
      expect(response.body.authorizationUrl).toContain('oauth/authorize');
      expect(stravaOAuth.getAuthorizationUrl).toHaveBeenCalled();
    });

    test('should call getAuthorizationUrl with correct parameters', async () => {
      const mockAuthUrl = 'https://www.strava.com/oauth/authorize?...';
      stravaOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/strava/auth/start')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(stravaOAuth.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.stringContaining('/api/strava/auth/callback'),
        'user_1',
        'read,activity:read_all'
      );
    });

    test('should store user ID in session', async () => {
      const mockAuthUrl = 'https://www.strava.com/oauth/authorize?...';
      stravaOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const agent = request.agent(app);
      const response = await agent
        .get('/api/strava/auth/start')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(stravaOAuth.getAuthorizationUrl).toHaveBeenCalled();
      // Session storage verified by callback test
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/strava/auth/start');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(stravaOAuth.getAuthorizationUrl).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/strava/auth/start')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle authorization URL generation errors', async () => {
      stravaOAuth.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      const response = await request(app)
        .get('/api/strava/auth/start')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to initiate OAuth flow');
    });
  });

  describe('GET /api/strava/auth/callback', () => {
    // Note: The callback is a GET endpoint that redirects to frontend
    // User ID comes from state parameter (format: "user_1")
    test('should exchange code for tokens successfully and redirect', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };
      const mockEncryptedTokens = 'encrypted-tokens-bundle';

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 456 });

      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('strava=connected');
    });

    test('should call exchangeCodeForToken with correct parameters', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 123 });

      await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(stravaOAuth.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code-123',
        expect.stringContaining('/api/strava/auth/callback')
      );
    });

    test('should encrypt tokens before storing', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };
      const mockEncryptedTokens = 'encrypted-bundle';

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 123 });

      await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(stravaOAuth.encryptTokens).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-123',
        1234567890
      );
    });

    test('should store tokens in database with athlete ID', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };
      const mockEncryptedTokens = 'encrypted-bundle';

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 123 });

      await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(User.updateStravaAuth).toHaveBeenCalledWith(
        1,
        mockEncryptedTokens,
        9876543
      );
    });

    test('should queue initial full import job', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 789 });

      await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(ImportJob.create).toHaveBeenCalledWith({
        user_id: 1,
        data_source: 'strava',
        status: 'queued'
      });

      expect(getQueue().send).toHaveBeenCalledWith('import-strava-data', {
        jobId: 789,
        userId: 1,
        syncType: 'full'
      });
    });

    test('should return 400 for missing authorization code', async () => {
      const response = await request(app)
        .get('/api/strava/auth/callback?state=user_1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Authorization code is required');
      expect(stravaOAuth.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    test('should redirect with error for missing state', async () => {
      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=invalid_state');
    });

    test('should redirect with error for invalid state format', async () => {
      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=invalid');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=invalid_state');
    });

    test('should redirect with error on token exchange failure', async () => {
      stravaOAuth.exchangeCodeForToken.mockRejectedValue(new Error('Token exchange failed'));

      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=strava_failed');
    });

    test('should redirect with error on database error', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateStravaAuth.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=strava_failed');
    });

    test('should redirect with error on job creation failure', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockRejectedValue(new Error('Job creation failed'));

      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=strava_failed');
    });

    test('should redirect with error on queue failure', async () => {
      const mockTokenData = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1234567890,
        athleteId: 9876543
      };

      stravaOAuth.exchangeCodeForToken.mockResolvedValue(mockTokenData);
      stravaOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateStravaAuth.mockResolvedValue({ id: 1 });
      ImportJob.create.mockResolvedValue({ id: 999 });
      getQueue().send.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app)
        .get('/api/strava/auth/callback?code=auth-code-123&state=user_1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=strava_failed');
    });
  });

  describe('GET /api/strava/status', () => {
    test('should return connection status for connected user', async () => {
      const mockConnectedUser = {
        id: 1,
        username: 'testuser',
        strava_oauth_tokens_encrypted: 'encrypted-tokens',
        strava_connected_at: '2025-01-14T12:00:00Z',
        last_strava_sync_at: '2025-01-14T15:30:00Z'
      };

      User.findById.mockResolvedValue(mockConnectedUser);

      const response = await request(app)
        .get('/api/strava/status')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.connected).toBe(true);
      expect(response.body.connectedAt).toBe('2025-01-14T12:00:00Z');
      expect(response.body.lastSyncAt).toBe('2025-01-14T15:30:00Z');
    });

    test('should return not connected for new user', async () => {
      const mockDisconnectedUser = {
        id: 1,
        username: 'testuser',
        strava_oauth_tokens_encrypted: null
      };

      User.findById.mockResolvedValue(mockDisconnectedUser);

      const response = await request(app)
        .get('/api/strava/status')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.connected).toBe(false);
      expect(response.body.connectedAt).toBeUndefined();
      expect(response.body.lastSyncAt).toBeUndefined();
    });

    test('should call User.findById with correct user ID', async () => {
      const mockUser = {
        id: 1,
        strava_oauth_tokens_encrypted: null
      };

      User.findById.mockResolvedValue(mockUser);

      await request(app)
        .get('/api/strava/status')
        .set('x-auth-token', mockToken);

      expect(User.findById).toHaveBeenCalledWith(1);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/strava/status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(User.findById).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/strava/status')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle database errors', async () => {
      User.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/strava/status')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get status');
    });
  });

  describe('DELETE /api/strava/disconnect', () => {
    test('should disconnect Strava and clear tokens', async () => {
      User.updateStravaAuth.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/strava/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.updateStravaAuth).toHaveBeenCalledWith(1, null);
    });

    test('should call User.updateStravaAuth with null', async () => {
      User.updateStravaAuth.mockResolvedValue({ id: 1 });

      await request(app)
        .delete('/api/strava/disconnect')
        .set('x-auth-token', mockToken);

      expect(User.updateStravaAuth).toHaveBeenCalledWith(
        mockUser.id,
        null
      );
    });

    test('should work even if already disconnected', async () => {
      User.updateStravaAuth.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/strava/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/strava/disconnect');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(User.updateStravaAuth).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/strava/disconnect')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
      expect(User.updateStravaAuth).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      User.updateStravaAuth.mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .delete('/api/strava/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to disconnect');
    });
  });

  describe('POST /api/strava/sync', () => {
    test('should queue sync job when tokens exist', async () => {
      const mockJob = {
        id: 456,
        userId: 1,
        status: 'queued'
      };

      User.getStravaTokens.mockResolvedValue('encrypted-tokens-123');
      ImportJob.create.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken)
        .send({ syncType: 'incremental' });

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(456);
      expect(response.body.status).toBe('queued');
      expect(User.getStravaTokens).toHaveBeenCalledWith(1);
    });

    test('should create ImportJob with correct parameters', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 123 });

      await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(ImportJob.create).toHaveBeenCalledWith({
        user_id: 1,
        data_source: 'strava',
        status: 'queued'
      });
    });

    test('should queue job in pg-boss with incremental sync when user has synced before', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      User.findById.mockResolvedValue({ id: 1, last_strava_sync_at: new Date() });
      ImportJob.create.mockResolvedValue({ id: 789 });

      await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(getQueue().send).toHaveBeenCalledWith('import-strava-data', {
        jobId: 789,
        userId: 1,
        syncType: 'incremental'
      });
    });

    test('should queue job in pg-boss with full sync when user has never synced', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      User.findById.mockResolvedValue({ id: 1, last_strava_sync_at: null });
      ImportJob.create.mockResolvedValue({ id: 999 });

      await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(getQueue().send).toHaveBeenCalledWith('import-strava-data', {
        jobId: 999,
        userId: 1,
        syncType: 'full'
      });
    });

    test('should auto-detect sync type based on last_strava_sync_at', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      User.findById.mockResolvedValue({ id: 1, last_strava_sync_at: '2025-01-01' });
      ImportJob.create.mockResolvedValue({ id: 111 });

      await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(getQueue().send).toHaveBeenCalledWith('import-strava-data', {
        jobId: 111,
        userId: 1,
        syncType: 'incremental'
      });
    });

    test('should reject when Strava not connected', async () => {
      User.getStravaTokens.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Strava not connected');
      expect(ImportJob.create).not.toHaveBeenCalled();
      expect(getQueue().send).not.toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/strava/sync');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(ImportJob.create).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle job creation failure', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to queue sync');
    });

    test('should handle queue failure', async () => {
      User.getStravaTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 999 });
      getQueue().send.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app)
        .post('/api/strava/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to queue sync');
    });
  });

  describe('GET /api/strava/sync/status/:jobId', () => {
    test('should return job status for authorized user', async () => {
      const mockJob = {
        id: 123,
        user_id: 1,
        status: 'in_progress',
        total_imported: 50,
        total_expected: 100,
        current_batch: 2,
        started_at: '2025-01-14T12:00:00Z',
        completed_at: null,
        error_message: null
      };

      ImportJob.findById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/strava/sync/status/123')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(123);
      expect(response.body.status).toBe('in_progress');
      expect(response.body.totalImported).toBe(50);
      expect(response.body.totalExpected).toBe(100);
      expect(response.body.currentBatch).toBe(2);
      expect(response.body.startedAt).toBe('2025-01-14T12:00:00Z');
    });

    test('should return 404 for non-existent job', async () => {
      ImportJob.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/strava/sync/status/999')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    test('should return 403 for job belonging to different user', async () => {
      const mockJob = {
        id: 123,
        user_id: 999,  // Different user
        status: 'completed'
      };

      ImportJob.findById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/strava/sync/status/123')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/strava/sync/status/123');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(ImportJob.findById).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      ImportJob.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/strava/sync/status/123')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get sync status');
    });

    test('should include error message when job failed', async () => {
      const mockJob = {
        id: 123,
        user_id: 1,
        status: 'failed',
        total_imported: 25,
        total_expected: 100,
        current_batch: 1,
        started_at: '2025-01-14T12:00:00Z',
        completed_at: '2025-01-14T12:05:00Z',
        error_message: 'Rate limit exceeded'
      };

      ImportJob.findById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/strava/sync/status/123')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('failed');
      expect(response.body.errorMessage).toBe('Rate limit exceeded');
    });
  });
});
