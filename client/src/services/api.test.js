import axios from 'axios';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    }))
  }
}));

const {
  getCheckins,
  getStats,
  validateToken,
  sendCopilotMessage,
  getFilterOptions
} = require('./api');

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe('api service', () => {
  it('getCheckins calls GET /api/checkins with params', async () => {
    mockGet.mockResolvedValue({ data: { checkins: [] } });
    const result = await getCheckins({ city: 'NYC' });
    expect(mockGet).toHaveBeenCalledWith('/api/checkins', { params: { city: 'NYC' } });
    expect(result).toEqual({ checkins: [] });
  });

  it('getStats calls GET /api/stats', async () => {
    mockGet.mockResolvedValue({ data: { total: 5 } });
    const result = await getStats({ year: 2024 });
    expect(mockGet).toHaveBeenCalledWith('/api/stats', { params: { year: 2024 } });
    expect(result).toEqual({ total: 5 });
  });

  it('validateToken calls GET /api/auth/me', async () => {
    mockGet.mockResolvedValue({ data: { user: 'test' } });
    const result = await validateToken('abc123');
    expect(mockGet).toHaveBeenCalledWith('/api/auth/me', { params: { token: 'abc123' } });
    expect(result).toEqual({ user: 'test' });
  });

  it('sendCopilotMessage calls POST /api/copilot/chat', async () => {
    mockPost.mockResolvedValue({ data: { reply: 'hello' } });
    const result = await sendCopilotMessage('hi', [], 'tok');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/copilot/chat',
      { message: 'hi', conversationHistory: [] },
      { params: { token: 'tok' } }
    );
    expect(result).toEqual({ reply: 'hello' });
  });

  it('getFilterOptions calls GET /api/filters/options', async () => {
    mockGet.mockResolvedValue({ data: { cities: ['NYC'] } });
    const result = await getFilterOptions({ token: 'tok' });
    expect(mockGet).toHaveBeenCalledWith('/api/filters/options', { params: { token: 'tok' } });
    expect(result).toEqual({ cities: ['NYC'] });
  });
});
