jest.mock('../db/connection', () => ({ query: jest.fn() }));

const db = require('../db/connection');
const { StravaRateLimitService, RateLimitError } = require('./stravaRateLimitService');

describe('StravaRateLimitService', () => {
  let service;

  beforeEach(() => {
    service = new StravaRateLimitService();
    jest.clearAllMocks();
  });

  describe('checkQuota', () => {
    it('allows when under both limits', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })   // short window
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }); // daily window

      const result = await service.checkQuota(1);
      expect(result).toEqual({ allowed: true });
    });

    it('returns not allowed when 15-min limit exceeded', async () => {
      const resetDate = new Date('2025-01-01T12:00:00Z');
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '95' }] })  // short window at limit
        .mockResolvedValueOnce({ rows: [{ requested_at: resetDate.toISOString() }] }); // getResetTime query

      const result = await service.checkQuota(1);
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe('15min');
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('returns not allowed when daily limit exceeded', async () => {
      const resetDate = new Date('2025-01-01T00:00:00Z');
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })   // short window OK
        .mockResolvedValueOnce({ rows: [{ count: '950' }] })  // daily at limit
        .mockResolvedValueOnce({ rows: [{ requested_at: resetDate.toISOString() }] }); // getResetTime

      const result = await service.checkQuota(1);
      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe('daily');
      expect(result.resetAt).toBeInstanceOf(Date);
    });
  });

  describe('recordRequest', () => {
    it('inserts a record into the database', async () => {
      db.query.mockResolvedValueOnce({});

      await service.recordRequest(1, '/athlete/activities');

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO strava_api_requests'),
        [1, '/athlete/activities']
      );
    });
  });

  describe('getResetTime', () => {
    it('returns future timestamp based on oldest request', async () => {
      const past = new Date('2025-01-01T12:00:00Z');
      db.query.mockResolvedValueOnce({ rows: [{ requested_at: past.toISOString() }] });

      const result = await service.getResetTime('short', 1);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(past.getTime() + 15 * 60 * 1000);
    });

    it('returns now if no requests in window', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const before = Date.now();
      const result = await service.getResetTime('short', 1);
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('uses daily window for daily limit type', async () => {
      const past = new Date('2025-01-01T00:00:00Z');
      db.query.mockResolvedValueOnce({ rows: [{ requested_at: past.toISOString() }] });

      const result = await service.getResetTime('daily', 1);
      expect(result.getTime()).toBe(past.getTime() + 24 * 60 * 60 * 1000);
    });
  });

  describe('RateLimitError', () => {
    it('has correct properties', () => {
      const err = new RateLimitError({ window: '15min', retryAfter: 900 });
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('RateLimitError');
      expect(err.window).toBe('15min');
      expect(err.retryAfter).toBe(900);
      expect(err.message).toContain('15min');
    });
  });
});
