const importCheckinsHandler = require('./importCheckins');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const Checkin = require('../models/checkin');
const CheckinPhoto = require('../models/checkinPhoto');
const db = require('../db/connection');
const { decrypt } = require('../services/encryption');
const { fetchCheckins, transformCheckin } = require('../services/foursquare');

jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../models/checkin');
jest.mock('../models/checkinPhoto');
jest.mock('../db/connection', () => ({ query: jest.fn() }));
jest.mock('../services/encryption', () => ({ decrypt: jest.fn().mockReturnValue('decrypted-token') }));
jest.mock('../services/foursquare');

const makeJob = (data = {}) => [{ data: { jobId: 1, userId: 10, ...data } }];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  User.findById.mockResolvedValue({ id: 10, access_token_encrypted: 'enc', last_sync_at: null });
  ImportJob.markStarted.mockResolvedValue();
  ImportJob.markCompleted.mockResolvedValue();
  ImportJob.markFailed.mockResolvedValue();
  ImportJob.update.mockResolvedValue();
  Checkin.bulkInsert.mockResolvedValue(2);
  CheckinPhoto.bulkInsert.mockResolvedValue(1);
  db.query.mockResolvedValue({ rows: [{ id: 100 }] });
  transformCheckin.mockImplementation((fc, userId) => ({
    venue_id: fc.venue.id,
    checkin_date: fc.createdAt,
    user_id: userId,
    photos: fc.photos || []
  }));
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe('importCheckinsHandler', () => {
  test('fetches and inserts checkins in batches', async () => {
    const rawCheckins = [
      { venue: { id: 'v1' }, createdAt: '2025-01-01', photos: [{ url: 'http://p1', width: 100, height: 100 }] },
      { venue: { id: 'v2' }, createdAt: '2025-01-02', photos: [] }
    ];
    fetchCheckins.mockResolvedValue(rawCheckins);

    await importCheckinsHandler(makeJob());

    expect(ImportJob.markStarted).toHaveBeenCalledWith(1);
    expect(User.findById).toHaveBeenCalledWith(10);
    expect(decrypt).toHaveBeenCalledWith('enc');
    expect(fetchCheckins).toHaveBeenCalledWith('decrypted-token', expect.objectContaining({ afterTimestamp: null }));
    expect(Checkin.bulkInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ venue_id: 'v1' }),
        expect.objectContaining({ venue_id: 'v2' })
      ])
    );
    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
    expect(User.updateLastSync).toHaveBeenCalledWith(10);
  });

  test('updates progress during import via onProgress callback', async () => {
    fetchCheckins.mockImplementation(async (token, opts) => {
      await opts.onProgress({ batch: 1, totalFetched: 50, totalExpected: 100 });
      return [{ venue: { id: 'v1' }, createdAt: '2025-01-01', photos: [] }];
    });

    await importCheckinsHandler(makeJob());

    expect(ImportJob.update).toHaveBeenCalledWith(1, {
      totalExpected: 100,
      totalImported: 50,
      currentBatch: 1
    });
  });

  test('marks job as failed on error', async () => {
    User.findById.mockResolvedValue(null);

    await expect(importCheckinsHandler(makeJob())).rejects.toThrow('User 10 not found');
    expect(ImportJob.markFailed).toHaveBeenCalledWith(1, 'User 10 not found');
  });

  test('handles empty fetch result without updating last_sync', async () => {
    fetchCheckins.mockResolvedValue([]);

    await importCheckinsHandler(makeJob());

    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
    expect(User.updateLastSync).not.toHaveBeenCalled();
    expect(Checkin.bulkInsert).not.toHaveBeenCalled();
  });

  test('falls back to individual inserts on batch error', async () => {
    const rawCheckins = [
      { venue: { id: 'v1' }, createdAt: '2025-01-01', photos: [{ url: 'http://p1', width: 100, height: 100 }] }
    ];
    fetchCheckins.mockResolvedValue(rawCheckins);
    Checkin.bulkInsert.mockRejectedValue(new Error('batch fail'));
    Checkin.insert.mockResolvedValue({ id: 50 });

    await importCheckinsHandler(makeJob());

    expect(Checkin.insert).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 'v1' }));
    expect(CheckinPhoto.bulkInsert).toHaveBeenCalledWith([
      expect.objectContaining({ checkin_id: 50, photo_url: 'http://p1' })
    ]);
    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
  });
});
