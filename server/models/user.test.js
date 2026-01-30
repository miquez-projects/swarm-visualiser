jest.mock('../db/connection', () => ({ query: jest.fn() }));

const db = require('../db/connection');
const User = require('./user');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('User model', () => {
  describe('findById', () => {
    it('returns user when found', async () => {
      const user = { id: 1, display_name: 'Alice' };
      db.query.mockResolvedValue({ rows: [user] });

      const result = await User.findById(1);
      expect(result).toEqual(user);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await User.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('findBySecretToken', () => {
    it('returns user when found', async () => {
      const user = { id: 1, secret_token: 'abc123' };
      db.query.mockResolvedValue({ rows: [user] });

      const result = await User.findBySecretToken('abc123');
      expect(result).toEqual(user);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM users WHERE secret_token = $1', ['abc123']);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await User.findBySecretToken('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts user with auto-generated secret token', async () => {
      const userData = {
        foursquareUserId: 'fs_123',
        displayName: 'Alice',
        avatarUrl: 'http://img.png',
        accessTokenEncrypted: 'enc_token',
      };
      const created = { id: 1, ...userData, secret_token: 'generated' };
      db.query.mockResolvedValue({ rows: [created] });

      const result = await User.create(userData);

      expect(result).toEqual(created);
      const call = db.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO users');
      expect(call[1][0]).toBe('fs_123');
      expect(call[1][1]).toBe('Alice');
      expect(call[1][2]).toBe('http://img.png');
      expect(call[1][3]).toBe('enc_token');
      // Secret token is a 64-char hex string (32 bytes)
      expect(call[1][4]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('findActive', () => {
    it('returns users with recent login', async () => {
      const users = [
        { id: 1, last_login_at: new Date() },
        { id: 2, last_login_at: null },
      ];
      db.query.mockResolvedValue({ rows: users });

      const result = await User.findActive();
      expect(result).toEqual(users);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('30 days');
    });
  });

  describe('updateLastSync', () => {
    it('updates timestamp and returns user', async () => {
      const updated = { id: 1, last_sync_at: new Date() };
      db.query.mockResolvedValue({ rows: [updated] });

      const result = await User.updateLastSync(1);
      expect(result).toEqual(updated);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('last_sync_at = NOW()'), [1]);
    });
  });

  describe('update', () => {
    it('builds dynamic SQL with camelCase to snake_case conversion', async () => {
      const updated = { id: 1, display_name: 'Bob', avatar_url: 'http://new.png' };
      db.query.mockResolvedValue({ rows: [updated] });

      const result = await User.update(1, { displayName: 'Bob', avatarUrl: 'http://new.png' });
      expect(result).toEqual(updated);
      const call = db.query.mock.calls[0];
      expect(call[0]).toContain('display_name = $1');
      expect(call[0]).toContain('avatar_url = $2');
      expect(call[1]).toEqual(['Bob', 'http://new.png', 1]);
    });

    it('throws on empty updates', async () => {
      await expect(User.update(1, {})).rejects.toThrow('No fields to update');
    });
  });

  describe('delete', () => {
    it('deletes user by id', async () => {
      db.query.mockResolvedValue({ rows: [] });
      await User.delete(1);
      expect(db.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [1]);
    });
  });

  describe('getStravaTokens', () => {
    it('returns tokens when found', async () => {
      db.query.mockResolvedValue({ rows: [{ strava_oauth_tokens_encrypted: 'enc_data' }] });
      const result = await User.getStravaTokens(1);
      expect(result).toBe('enc_data');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('strava_oauth_tokens_encrypted'), [1]);
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await User.getStravaTokens(1);
      expect(result).toBeNull();
    });
  });

  describe('updateStravaAuth', () => {
    it('stores encrypted tokens and athlete id', async () => {
      const returned = { id: 1, strava_athlete_id: 'ath_1', strava_connected_at: new Date() };
      db.query.mockResolvedValue({ rows: [returned] });

      const result = await User.updateStravaAuth(1, 'encrypted_data', 'ath_1');
      expect(result).toEqual(returned);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('strava_oauth_tokens_encrypted'),
        ['encrypted_data', 'ath_1', 1]
      );
    });
  });
});
