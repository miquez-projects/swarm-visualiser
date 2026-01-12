const stravaOAuth = require('./stravaOAuth');
const { encrypt, decrypt } = require('./encryption');

// Mock dependencies
jest.mock('axios');
jest.mock('./encryption');

const axios = require('axios');

describe('StravaOAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock encryption/decryption
    encrypt.mockImplementation(data => `encrypted:${data}`);
    decrypt.mockImplementation(data => data.replace('encrypted:', ''));
  });

  describe('getAuthorizationUrl', () => {
    test('should return correct OAuth URL with all parameters', () => {
      const redirectUri = 'http://localhost:3001/api/strava/auth/callback';
      const state = 'random-state-123';
      const scope = 'read,activity:read_all';

      const authUrl = stravaOAuth.getAuthorizationUrl(redirectUri, state, scope);

      expect(authUrl).toContain('https://www.strava.com/oauth/authorize');
      expect(authUrl).toContain(`client_id=${process.env.STRAVA_CLIENT_ID}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain(`scope=${encodeURIComponent(scope)}`);
      expect(authUrl).toContain(`state=${state}`);
    });

    test('should work with empty state parameter', () => {
      const redirectUri = 'http://localhost:3001/api/strava/auth/callback';

      const authUrl = stravaOAuth.getAuthorizationUrl(redirectUri, '');

      expect(authUrl).toContain('https://www.strava.com/oauth/authorize');
      expect(authUrl).toContain('state=');
    });

    test('should use default scope if not specified', () => {
      const redirectUri = 'http://localhost:3001/api/strava/auth/callback';

      const authUrl = stravaOAuth.getAuthorizationUrl(redirectUri);

      expect(authUrl).toContain('scope=read%2Cactivity%3Aread_all');
    });

    test('should throw error if redirectUri is missing', () => {
      expect(() => {
        stravaOAuth.getAuthorizationUrl(null);
      }).toThrow('Redirect URI is required');
    });
  });

  describe('exchangeCodeForToken', () => {
    const mockTokenResponse = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      expires_at: 1737059400,
      athlete: {
        id: 9876543
      }
    };

    test('should exchange authorization code for tokens successfully', async () => {
      axios.post.mockResolvedValue({ data: mockTokenResponse });

      const result = await stravaOAuth.exchangeCodeForToken(
        'auth-code-123',
        'http://localhost:3001/api/strava/auth/callback'
      );

      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: 1737059400,
        athleteId: 9876543
      });
    });

    test('should call token endpoint with correct parameters', async () => {
      axios.post.mockResolvedValue({ data: mockTokenResponse });

      await stravaOAuth.exchangeCodeForToken(
        'auth-code-123',
        'http://localhost:3001/api/strava/auth/callback'
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        {
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          code: 'auth-code-123',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:3001/api/strava/auth/callback'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
    });

    test('should handle response without athlete ID', async () => {
      const responseWithoutAthlete = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_at: 1737059400
      };

      axios.post.mockResolvedValue({ data: responseWithoutAthlete });

      const result = await stravaOAuth.exchangeCodeForToken('code', 'http://localhost/callback');

      expect(result.athleteId).toBeNull();
    });

    test('should throw error if access token is missing in response', async () => {
      axios.post.mockResolvedValue({ data: { refresh_token: 'token' } });

      await expect(
        stravaOAuth.exchangeCodeForToken('code', 'http://localhost/callback')
      ).rejects.toThrow('Failed to exchange authorization code for access token');
    });

    test('should throw error if code is missing', async () => {
      await expect(
        stravaOAuth.exchangeCodeForToken(null, 'http://localhost/callback')
      ).rejects.toThrow('Authorization code is required');
    });

    test('should throw error if redirectUri is missing', async () => {
      await expect(
        stravaOAuth.exchangeCodeForToken('code', null)
      ).rejects.toThrow('Redirect URI is required');
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        stravaOAuth.exchangeCodeForToken('code', 'http://localhost/callback')
      ).rejects.toThrow('Failed to exchange authorization code for access token');
    });

    test('should handle Strava API errors', async () => {
      const apiError = {
        response: {
          data: {
            message: 'Invalid authorization code',
            errors: [{ code: 'invalid', field: 'code' }]
          }
        }
      };

      axios.post.mockRejectedValue(apiError);

      await expect(
        stravaOAuth.exchangeCodeForToken('invalid-code', 'http://localhost/callback')
      ).rejects.toThrow('Failed to exchange authorization code for access token');
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: 1737063000
    };

    test('should refresh access token successfully', async () => {
      axios.post.mockResolvedValue({ data: mockRefreshResponse });

      const result = await stravaOAuth.refreshAccessToken('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: 1737063000
      });
    });

    test('should call token endpoint with correct parameters', async () => {
      axios.post.mockResolvedValue({ data: mockRefreshResponse });

      await stravaOAuth.refreshAccessToken('old-refresh-token');

      expect(axios.post).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        {
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: 'old-refresh-token'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
    });

    test('should throw error if refresh token is missing', async () => {
      await expect(
        stravaOAuth.refreshAccessToken(null)
      ).rejects.toThrow('Refresh token is required');
    });

    test('should throw error if access token is missing in response', async () => {
      axios.post.mockResolvedValue({ data: { refresh_token: 'token' } });

      await expect(
        stravaOAuth.refreshAccessToken('token')
      ).rejects.toThrow('Failed to refresh access token');
    });

    test('should handle refresh errors', async () => {
      axios.post.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(
        stravaOAuth.refreshAccessToken('invalid-token')
      ).rejects.toThrow('Failed to refresh access token');
    });

    test('should handle expired refresh token', async () => {
      const apiError = {
        response: {
          data: {
            message: 'Authorization Error',
            errors: [{ code: 'invalid', resource: 'RefreshToken' }]
          }
        }
      };

      axios.post.mockRejectedValue(apiError);

      await expect(
        stravaOAuth.refreshAccessToken('expired-token')
      ).rejects.toThrow('Failed to refresh access token');
    });
  });

  describe('encryptTokens', () => {
    test('should encrypt tokens successfully', () => {
      const result = stravaOAuth.encryptTokens(
        'access-token',
        'refresh-token',
        1737059400
      );

      expect(encrypt).toHaveBeenCalledWith(
        JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: 1737059400
        })
      );
      expect(result).toContain('encrypted:');
    });

    test('should throw error if access token is missing', () => {
      expect(() => {
        stravaOAuth.encryptTokens(null, 'refresh-token', 1737059400);
      }).toThrow('Access token is required');
    });

    test('should throw error if refresh token is missing', () => {
      expect(() => {
        stravaOAuth.encryptTokens('access-token', null, 1737059400);
      }).toThrow('Refresh token is required');
    });

    test('should throw error if expiresAt is missing', () => {
      expect(() => {
        stravaOAuth.encryptTokens('access-token', 'refresh-token', null);
      }).toThrow('Expires at timestamp is required');
    });
  });

  describe('decryptTokens', () => {
    test('should decrypt tokens successfully', () => {
      const encrypted = 'encrypted:' + JSON.stringify({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 1737059400
      });

      const result = stravaOAuth.decryptTokens(encrypted);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 1737059400
      });
    });

    test('should throw error if encrypted tokens are missing', () => {
      expect(() => {
        stravaOAuth.decryptTokens(null);
      }).toThrow('Encrypted tokens are required');
    });
  });

  describe('isTokenExpired', () => {
    test('should return true if token is expired', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(stravaOAuth.isTokenExpired(pastTime)).toBe(true);
    });

    test('should return true if token expires within 5 minutes', () => {
      const soonTime = Math.floor(Date.now() / 1000) + 240; // 4 minutes from now
      expect(stravaOAuth.isTokenExpired(soonTime)).toBe(true);
    });

    test('should return false if token expires in more than 5 minutes', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
      expect(stravaOAuth.isTokenExpired(futureTime)).toBe(false);
    });

    test('should use 5 minute buffer', () => {
      const exactlyFiveMinutes = Math.floor(Date.now() / 1000) + 300; // Exactly 5 minutes
      expect(stravaOAuth.isTokenExpired(exactlyFiveMinutes)).toBe(true);
    });
  });


  describe('makeAuthenticatedRequest', () => {
    const mockEncryptedTokens = 'encrypted:' + JSON.stringify({
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    });

    beforeEach(() => {
      // Default: tokens not expired
      jest.spyOn(stravaOAuth, 'isTokenExpired').mockReturnValue(false);
    });

    test('should make GET request successfully', async () => {
      const mockData = [{ id: 1, name: 'Activity 1' }];
      axios.get.mockResolvedValue({ data: mockData });

      const result = await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/athlete/activities',
        { page: 1, per_page: 30 },
        'GET'
      );

      expect(result).toEqual(mockData);
      expect(axios.get).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/athlete/activities',
        {
          headers: {
            'Authorization': 'Bearer valid-token',
            'Accept': 'application/json'
          },
          params: { page: 1, per_page: 30 }
        }
      );
    });

    test('should make POST request successfully', async () => {
      const mockData = { id: 123, success: true };
      axios.post.mockResolvedValue({ data: mockData });

      const result = await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/activities',
        { name: 'Morning Run', type: 'Run' },
        'POST'
      );

      expect(result).toEqual(mockData);
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/activities',
        { name: 'Morning Run', type: 'Run' },
        {
          headers: {
            'Authorization': 'Bearer valid-token',
            'Accept': 'application/json'
          }
        }
      );
    });

    test('should make PUT request successfully', async () => {
      axios.put.mockResolvedValue({ data: { updated: true } });

      await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/activities/123',
        { name: 'Updated Name' },
        'PUT'
      );

      expect(axios.put).toHaveBeenCalled();
    });

    test('should make DELETE request successfully', async () => {
      axios.delete.mockResolvedValue({ data: { deleted: true } });

      await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/activities/123',
        {},
        'DELETE'
      );

      expect(axios.delete).toHaveBeenCalled();
    });

    test('should throw error for unsupported HTTP method', async () => {
      await expect(
        stravaOAuth.makeAuthenticatedRequest(
          mockEncryptedTokens,
          '/athlete',
          {},
          'PATCH'
        )
      ).rejects.toThrow('Unsupported HTTP method: PATCH');
    });

    test('should proactively refresh expired token before request', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(true);

      const mockRefreshResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };

      jest.spyOn(stravaOAuth, 'refreshAccessToken').mockResolvedValue(mockRefreshResponse);
      axios.get.mockResolvedValue({ data: { athlete: 'data' } });

      const result = await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/athlete',
        {},
        'GET'
      );

      expect(stravaOAuth.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
      expect(result.data).toBeDefined();
      expect(result.newEncryptedTokens).toBeDefined();
    });

    test('should handle 401 error and retry with refreshed token', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(false);

      const unauthorizedError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };

      axios.get.mockRejectedValueOnce(unauthorizedError);

      const mockRefreshResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      };

      jest.spyOn(stravaOAuth, 'refreshAccessToken').mockResolvedValue(mockRefreshResponse);
      axios.get.mockResolvedValueOnce({ data: { success: true } });

      const result = await stravaOAuth.makeAuthenticatedRequest(
        mockEncryptedTokens,
        '/athlete',
        {},
        'GET'
      );

      expect(stravaOAuth.refreshAccessToken).toHaveBeenCalled();
      expect(result.data).toEqual({ success: true });
      expect(result.newEncryptedTokens).toBeDefined();
    });

    test('should throw immediately on rate limit (429)', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(false);

      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      };

      axios.get.mockRejectedValue(rateLimitError);

      await expect(
        stravaOAuth.makeAuthenticatedRequest(
          mockEncryptedTokens,
          '/athlete',
          {},
          'GET'
        )
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('should throw error if token refresh fails', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(true);
      jest.spyOn(stravaOAuth, 'refreshAccessToken').mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(
        stravaOAuth.makeAuthenticatedRequest(
          mockEncryptedTokens,
          '/athlete',
          {},
          'GET'
        )
      ).rejects.toThrow('OAuth token expired and refresh failed. Please re-authenticate.');
    });

    test('should throw error if 401 refresh fails', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(false);

      const unauthorizedError = {
        response: { status: 401 }
      };

      axios.get.mockRejectedValue(unauthorizedError);
      jest.spyOn(stravaOAuth, 'refreshAccessToken').mockRejectedValue(
        new Error('Refresh failed')
      );

      await expect(
        stravaOAuth.makeAuthenticatedRequest(
          mockEncryptedTokens,
          '/athlete',
          {},
          'GET'
        )
      ).rejects.toThrow('OAuth token expired and refresh failed. Please re-authenticate.');
    });

    test('should throw error if encrypted tokens are missing', async () => {
      await expect(
        stravaOAuth.makeAuthenticatedRequest(null, '/athlete', {}, 'GET')
      ).rejects.toThrow('Encrypted tokens are required');
    });

    test('should throw error if endpoint is missing', async () => {
      await expect(
        stravaOAuth.makeAuthenticatedRequest(mockEncryptedTokens, null, {}, 'GET')
      ).rejects.toThrow('Endpoint is required');
    });

    test('should handle other API errors', async () => {
      stravaOAuth.isTokenExpired.mockReturnValue(false);

      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };

      axios.get.mockRejectedValue(serverError);

      await expect(
        stravaOAuth.makeAuthenticatedRequest(
          mockEncryptedTokens,
          '/athlete',
          {},
          'GET'
        )
      ).rejects.toEqual(serverError);
    });
  });

  describe('getAthleteProfile', () => {
    test('should fetch athlete profile', async () => {
      const mockProfile = {
        id: 9876543,
        username: 'athlete123',
        firstname: 'John',
        lastname: 'Doe'
      };

      jest.spyOn(stravaOAuth, 'makeAuthenticatedRequest').mockResolvedValue(mockProfile);

      const result = await stravaOAuth.getAthleteProfile('encrypted-tokens');

      expect(stravaOAuth.makeAuthenticatedRequest).toHaveBeenCalledWith(
        'encrypted-tokens',
        '/athlete'
      );
      expect(result).toEqual(mockProfile);
    });
  });
});
