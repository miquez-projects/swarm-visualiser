const request = require('supertest');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const garminOAuth = require('../services/garminOAuth');

// Mock dependencies before requiring server
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/garminOAuth');
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

describe('Garmin OAuth2 Routes', () => {
  const mockToken = 'test-auth-token';
  const mockUser = { id: 1, username: 'testuser' };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findBySecretToken.mockResolvedValue(mockUser);
    User.update.mockResolvedValue(mockUser);
  });

  describe('GET /api/garmin/connect', () => {
    test('should return OAuth authorization URL with PKCE', async () => {
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };
      const mockAuthUrl = 'https://connect.garmin.com/oauthConfirm?response_type=code&client_id=test&code_challenge=test-challenge-123';

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.authUrl).toBeDefined();
      expect(response.body.authUrl).toContain('connect.garmin.com');
      expect(response.body.authUrl).toContain('code_challenge');
      expect(garminOAuth.generatePKCE).toHaveBeenCalled();
      expect(garminOAuth.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.stringContaining('/api/garmin/callback'),
        mockPKCE.codeChallenge
      );
    });

    test('should store codeVerifier in session', async () => {
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };
      const mockAuthUrl = 'https://connect.garmin.com/oauthConfirm?...';

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const agent = request.agent(app);
      const response = await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(garminOAuth.generatePKCE).toHaveBeenCalled();
      // Session storage is verified by callback test
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/garmin/connect');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(garminOAuth.generatePKCE).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/garmin/connect')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle PKCE generation errors', async () => {
      garminOAuth.generatePKCE.mockImplementation(() => {
        throw new Error('PKCE generation failed');
      });

      const response = await request(app)
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to initiate OAuth flow');
    });
  });

  describe('GET /api/garmin/callback', () => {
    test('should exchange OAuth code for tokens', async () => {
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      };
      const mockEncryptedTokens = 'encrypted-tokens-bundle';
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockResolvedValue(mockTokens);
      garminOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      // Create agent to maintain session across requests
      const agent = request.agent(app);

      // Step 1: Call /connect to set up session
      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      // Step 2: Simulate OAuth callback with session intact
      const response = await agent
        .get('/api/garmin/callback')
        .query({
          code: 'auth-code-123',
          state: 'state-value'
        });

      expect(response.status).toBe(302); // Redirect
      expect(response.headers.location).toContain('/data-sources');
      expect(response.headers.location).toContain('garmin=connected');
    });

    test('should call garminOAuth.exchangeCodeForToken with correct parameters', async () => {
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      };
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockResolvedValue(mockTokens);
      garminOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const agent = request.agent(app);

      // Set up session
      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      // Call callback
      await agent
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(garminOAuth.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code-123',
        mockPKCE.codeVerifier,
        expect.stringContaining('/api/garmin/callback')
      );
    });

    test('should encrypt tokens before storing', async () => {
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      };
      const mockEncryptedTokens = 'encrypted-bundle';
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockResolvedValue(mockTokens);
      garminOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const agent = request.agent(app);

      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      await agent
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(garminOAuth.encryptTokens).toHaveBeenCalledWith(
        mockTokens.accessToken,
        mockTokens.refreshToken
      );
    });

    test('should store tokens in database', async () => {
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123'
      };
      const mockEncryptedTokens = 'encrypted-bundle';
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockResolvedValue(mockTokens);
      garminOAuth.encryptTokens.mockReturnValue(mockEncryptedTokens);
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const agent = request.agent(app);

      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      await agent
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(User.updateGarminAuth).toHaveBeenCalledWith(
        mockUser.id,
        mockEncryptedTokens
      );
    });

    test('should redirect to frontend on success', async () => {
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh'
      });
      garminOAuth.encryptTokens.mockReturnValue('encrypted');
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const agent = request.agent(app);

      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      const response = await agent
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/\/data-sources\?garmin=connected/);
    });

    test('should reject missing OAuth code parameter', async () => {
      const response = await request(app)
        .get('/api/garmin/callback')
        .query({ state: 'some-state' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('garmin=error');
      expect(response.headers.location).toContain('missing_code');
      expect(garminOAuth.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    test('should handle session expiration', async () => {
      const response = await request(app)
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('session_expired');
    });

    test('should handle token exchange failure', async () => {
      const mockPKCE = {
        codeVerifier: 'test-verifier-123',
        codeChallenge: 'test-challenge-123'
      };

      garminOAuth.generatePKCE.mockReturnValue(mockPKCE);
      garminOAuth.getAuthorizationUrl.mockReturnValue('https://connect.garmin.com/...');
      garminOAuth.exchangeCodeForToken.mockRejectedValue(new Error('Token exchange failed'));

      const agent = request.agent(app);

      await agent
        .get('/api/garmin/connect')
        .set('x-auth-token', mockToken);

      const response = await agent
        .get('/api/garmin/callback')
        .query({ code: 'auth-code-123' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('garmin=error');
      expect(response.headers.location).toContain('token_exchange_failed');
    });
  });

  describe('POST /api/garmin/sync', () => {
    test('should queue sync job when tokens exist', async () => {
      const mockJob = {
        id: 456,
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      };

      User.getGarminTokens.mockResolvedValue('encrypted-tokens-123');
      ImportJob.create.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken)
        .send({ syncType: 'incremental' });

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(456);
      expect(response.body.status).toBe('queued');
      expect(User.getGarminTokens).toHaveBeenCalledWith(1);
    });

    test('should create ImportJob with correct parameters', async () => {
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 123 });

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(ImportJob.create).toHaveBeenCalledWith({
        user_id: 1,
        data_source: 'garmin',
        status: 'queued'
      });
    });

    test('should queue job in pg-boss', async () => {
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 789 });

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken)
        .send({ syncType: 'full' });

      expect(getQueue().send).toHaveBeenCalledWith('import-garmin-data', {
        jobId: 789,
        userId: 1,
        syncType: 'full'
      });
    });

    test('should default to incremental sync', async () => {
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 111 });

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(getQueue().send).toHaveBeenCalledWith('import-garmin-data', {
        jobId: 111,
        userId: 1,
        syncType: 'incremental'
      });
    });

    test('should reject when Garmin not connected', async () => {
      User.getGarminTokens.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not connected');
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
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to queue sync');
    });

    test('should handle queue failure', async () => {
      User.getGarminTokens.mockResolvedValue('encrypted-tokens');
      ImportJob.create.mockResolvedValue({ id: 999 });
      getQueue().send.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app)
        .post('/api/garmin/sync')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to queue sync');
    });
  });

  describe('DELETE /api/garmin/disconnect', () => {
    test('should disconnect Garmin and clear tokens', async () => {
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.updateGarminAuth).toHaveBeenCalledWith(1, null);
    });

    test('should call User.updateGarminAuth with null', async () => {
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', mockToken);

      expect(User.updateGarminAuth).toHaveBeenCalledWith(
        mockUser.id,
        null
      );
    });

    test('should work even if already disconnected', async () => {
      User.updateGarminAuth.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/garmin/disconnect');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      expect(User.updateGarminAuth).not.toHaveBeenCalled();
    });

    test('should handle invalid authentication token', async () => {
      User.findBySecretToken.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
      expect(User.updateGarminAuth).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      User.updateGarminAuth.mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .delete('/api/garmin/disconnect')
        .set('x-auth-token', mockToken);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to disconnect');
    });
  });
});
