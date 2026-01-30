const request = require('supertest');
jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/geminiSessionManager', () => ({ startCleanupInterval: jest.fn() }));
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));

const User = require('../models/user');
const ImportJob = require('../models/importJob');
const { getQueue } = require('../jobs/queue');
const app = require('../server');

const mockToken = 'test-token';
const mockUser = { id: 1, display_name: 'Test User' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findBySecretToken.mockResolvedValue(mockUser);
  User.update.mockResolvedValue({});
});

describe('Import Routes', () => {
  describe('POST /api/import/start', () => {
    test('creates import job and queues it', async () => {
      ImportJob.findByUserId.mockResolvedValue([]);
      ImportJob.create.mockResolvedValue({ id: 42, status: 'pending' });

      const res = await request(app)
        .post('/api/import/start')
        .set('x-auth-token', mockToken);

      expect(res.body).toEqual({ jobId: 42, status: 'pending', message: 'Import job queued' });
      expect(res.status).toBe(200);
      expect(ImportJob.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 1, data_source: 'foursquare', status: 'pending'
      }));
      expect(getQueue().send).toHaveBeenCalledWith('import-checkins', { jobId: 42, userId: 1 });
    });

    test('prevents duplicate running imports (409)', async () => {
      ImportJob.findByUserId.mockResolvedValue([{ id: 10, status: 'running' }]);

      const res = await request(app)
        .post('/api/import/start')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Import already in progress');
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app).post('/api/import/start');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/import/status/:jobId', () => {
    test('returns job status', async () => {
      ImportJob.findById.mockResolvedValue({
        id: 42, user_id: 1, status: 'completed', data_source: 'foursquare',
        total_expected: 100, total_imported: 100, current_batch: 5,
        error_message: null, started_at: null, completed_at: null, created_at: '2024-01-01'
      });

      const res = await request(app)
        .get('/api/import/status/42')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(42);
      expect(res.body.status).toBe('completed');
    });

    test('returns 403 for other user\'s job', async () => {
      ImportJob.findById.mockResolvedValue({ id: 42, user_id: 999, status: 'completed' });

      const res = await request(app)
        .get('/api/import/status/42')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent job', async () => {
      ImportJob.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/import/status/999')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/import/latest', () => {
    test('returns latest import job', async () => {
      ImportJob.findLatestByUserId.mockResolvedValue({
        id: 42, status: 'completed', data_source: 'foursquare',
        total_expected: 100, total_imported: 100, current_batch: 5,
        error_message: null, started_at: null, completed_at: null, created_at: '2024-01-01'
      });

      const res = await request(app)
        .get('/api/import/latest')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body.job.id).toBe(42);
    });

    test('returns null job when none exist', async () => {
      ImportJob.findLatestByUserId.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/import/latest')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(200);
      expect(res.body.job).toBeNull();
    });

    test('returns 500 when findLatestByUserId rejects', async () => {
      ImportJob.findLatestByUserId.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/import/latest')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get latest import');
    });
  });

  describe('POST /api/import/start - error paths', () => {
    test('returns 500 when ImportJob.create rejects', async () => {
      ImportJob.findByUserId.mockResolvedValue([]);
      ImportJob.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/import/start')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to start import');
    });

    test('returns 500 when findById rejects', async () => {
      ImportJob.findById.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/import/status/42')
        .set('x-auth-token', mockToken);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get import status');
    });
  });
});
