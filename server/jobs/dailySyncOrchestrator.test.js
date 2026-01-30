const User = require('../models/user');
const ImportJob = require('../models/importJob');
const dailySyncOrchestrator = require('./dailySyncOrchestrator');

jest.mock('../models/user');
jest.mock('../models/importJob');

const mockSend = jest.fn().mockResolvedValue('job-id');
jest.mock('./queue', () => ({
  getQueue: jest.fn().mockReturnValue({ send: mockSend })
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dailySyncOrchestrator', () => {
  it('queues sync jobs for each active user', async () => {
    const users = [
      { id: 1, display_name: 'Alice' },
      { id: 2, display_name: 'Bob' }
    ];
    User.findActive.mockResolvedValue(users);
    ImportJob.findByUserId.mockResolvedValue([]);
    ImportJob.create.mockResolvedValueOnce({ id: 100 }).mockResolvedValueOnce({ id: 101 });

    await dailySyncOrchestrator([{}]);

    expect(ImportJob.create).toHaveBeenCalledTimes(2);
    expect(ImportJob.create).toHaveBeenCalledWith({ user_id: 1, data_source: 'foursquare', status: 'pending' });
    expect(ImportJob.create).toHaveBeenCalledWith({ user_id: 2, data_source: 'foursquare', status: 'pending' });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith('import-checkins', { jobId: 100, userId: 1 }, { startAfter: '0 seconds' });
    expect(mockSend).toHaveBeenCalledWith('import-checkins', { jobId: 101, userId: 2 }, { startAfter: '2 minutes' });
  });

  it('skips users with running import jobs', async () => {
    const users = [
      { id: 1, display_name: 'Alice' },
      { id: 2, display_name: 'Bob' }
    ];
    User.findActive.mockResolvedValue(users);
    ImportJob.findByUserId
      .mockResolvedValueOnce([{ id: 50, status: 'running' }])
      .mockResolvedValueOnce([{ id: 51, status: 'completed' }]);
    ImportJob.create.mockResolvedValue({ id: 100 });

    await dailySyncOrchestrator([{}]);

    expect(ImportJob.create).toHaveBeenCalledTimes(1);
    expect(ImportJob.create).toHaveBeenCalledWith({ user_id: 2, data_source: 'foursquare', status: 'pending' });
  });

  it('skips users with pending import jobs', async () => {
    User.findActive.mockResolvedValue([{ id: 1 }]);
    ImportJob.findByUserId.mockResolvedValue([{ id: 50, status: 'pending' }]);

    await dailySyncOrchestrator([{}]);

    expect(ImportJob.create).not.toHaveBeenCalled();
  });

  it('handles empty active user list', async () => {
    User.findActive.mockResolvedValue([]);

    await dailySyncOrchestrator([{}]);

    expect(ImportJob.findByUserId).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('throws on error so pg-boss marks job as failed', async () => {
    User.findActive.mockRejectedValue(new Error('DB down'));

    await expect(dailySyncOrchestrator([{}])).rejects.toThrow('DB down');
  });
});
