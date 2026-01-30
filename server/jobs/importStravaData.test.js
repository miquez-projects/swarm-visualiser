const importStravaDataHandler = require('./importStravaData');
const User = require('../models/user');
const ImportJob = require('../models/importJob');
const stravaSync = require('../services/stravaSync');
const { getQueue } = require('./queue');

jest.mock('../models/user');
jest.mock('../models/importJob');
jest.mock('../services/stravaSync');
jest.mock('../services/stravaRateLimitService');
jest.mock('./queue', () => ({
  getQueue: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue('retry-job-id')
  })
}));

describe('importStravaDataHandler', () => {
  const baseJobData = { jobId: 1, userId: 10, syncType: 'incremental' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    User.getStravaTokens.mockResolvedValue({ access_token: 'tok' });
    User.findById.mockResolvedValue({ last_strava_sync_at: '2025-01-01' });
    ImportJob.findById.mockResolvedValue({ sync_cursor: null });
    ImportJob.markStarted.mockResolvedValue();
    ImportJob.markCompleted.mockResolvedValue();
    ImportJob.markFailed.mockResolvedValue();
    ImportJob.markRateLimited.mockResolvedValue();
    ImportJob.update.mockResolvedValue();
    ImportJob.updateCursor.mockResolvedValue();
    User.updateLastStravaSync.mockResolvedValue();

    stravaSync.incrementalSync.mockResolvedValue({
      activities: { imported: 5 },
      photos: { photosInserted: 2 }
    });
    stravaSync.fullHistoricalSync.mockResolvedValue({
      activities: { imported: 10 },
      photos: { photosInserted: 3 }
    });
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  it('runs incremental sync by default and marks completed', async () => {
    await importStravaDataHandler([{ data: baseJobData }]);

    expect(ImportJob.markStarted).toHaveBeenCalledWith(1);
    expect(stravaSync.incrementalSync).toHaveBeenCalledWith(
      { access_token: 'tok' }, 10, '2025-01-01', null, expect.any(Function)
    );
    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
    expect(User.updateLastStravaSync).toHaveBeenCalledWith(10);
  });

  it('runs full sync when requested', async () => {
    await importStravaDataHandler([{ data: { ...baseJobData, syncType: 'full' } }]);

    expect(stravaSync.fullHistoricalSync).toHaveBeenCalledWith(
      { access_token: 'tok' }, 10, null, expect.any(Function)
    );
    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
  });

  it('handles rate limit errors by marking rate_limited and scheduling retry', async () => {
    const retryAfter = new Date(Date.now() + 60000).toISOString();
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.name = 'RateLimitError';
    rateLimitError.window = '15min';
    rateLimitError.retryAfter = retryAfter;

    stravaSync.incrementalSync.mockRejectedValue(rateLimitError);

    await importStravaDataHandler([{ data: baseJobData }]);

    expect(ImportJob.markRateLimited).toHaveBeenCalledWith(1, retryAfter);
    const boss = getQueue();
    expect(boss.send).toHaveBeenCalledWith(
      'import-strava-data',
      baseJobData,
      { startAfter: new Date(retryAfter) }
    );
    expect(ImportJob.markFailed).not.toHaveBeenCalled();
  });

  it('marks job as failed on general errors and re-throws', async () => {
    const error = new Error('Something broke');
    stravaSync.incrementalSync.mockRejectedValue(error);

    await expect(
      importStravaDataHandler([{ data: baseJobData }])
    ).rejects.toThrow('Something broke');

    expect(ImportJob.markFailed).toHaveBeenCalledWith(1, 'Something broke');
  });

  it('handles generic rate limit errors (message-based) without re-throwing', async () => {
    const genericError = new Error('Rate limit exceeded - too many requests');
    genericError.name = 'Error'; // NOT RateLimitError

    stravaSync.incrementalSync.mockRejectedValue(genericError);

    await importStravaDataHandler([{ data: baseJobData }]);

    expect(ImportJob.markFailed).toHaveBeenCalledWith(1, 'Rate limit exceeded - too many requests');
    expect(ImportJob.markRateLimited).not.toHaveBeenCalled();
    expect(getQueue().send).not.toHaveBeenCalled();
  });

  it('does not update last sync timestamp when no items imported', async () => {
    stravaSync.incrementalSync.mockResolvedValue({
      activities: { imported: 0 },
      photos: { photosInserted: 0 }
    });

    await importStravaDataHandler([{ data: baseJobData }]);

    expect(ImportJob.markCompleted).toHaveBeenCalledWith(1);
    expect(User.updateLastStravaSync).not.toHaveBeenCalled();
  });

  it('updates last sync timestamp when items were imported', async () => {
    await importStravaDataHandler([{ data: baseJobData }]);

    expect(User.updateLastStravaSync).toHaveBeenCalledWith(10);
  });
});
