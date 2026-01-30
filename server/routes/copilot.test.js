const request = require('supertest');
jest.mock('../models/user');
jest.mock('../services/geminiSessionManager', () => ({
  startCleanupInterval: jest.fn(),
  getOrCreateSession: jest.fn()
}));
jest.mock('../services/queryBuilder');
jest.mock('../jobs/queue', () => ({
  initQueue: jest.fn().mockResolvedValue(undefined),
  getQueue: jest.fn().mockReturnValue({ work: jest.fn(), send: jest.fn() }),
  stopQueue: jest.fn()
}));

const User = require('../models/user');
const sessionManager = require('../services/geminiSessionManager');
const app = require('../server');

const mockToken = 'test-token';
const mockUser = { id: 1, display_name: 'Test User' };

beforeEach(() => {
  jest.clearAllMocks();
  User.findBySecretToken.mockResolvedValue(mockUser);
  User.update.mockResolvedValue({});
});

describe('Copilot Routes', () => {
  describe('POST /api/copilot/chat', () => {
    test('returns AI response for valid message', async () => {
      const mockHistory = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] }
      ];
      const mockChat = {
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            functionCalls: [],
            text: () => 'Hi there!',
            candidates: []
          }
        }),
        getHistory: jest.fn().mockResolvedValue(mockHistory)
      };
      sessionManager.getOrCreateSession.mockReturnValue({
        chat: mockChat,
        historyPosition: 0
      });

      const res = await request(app)
        .post('/api/copilot/chat')
        .set('x-auth-token', mockToken)
        .send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Hi there!');
      expect(res.body.messages).toBeDefined();
    });

    test('requires message in body (400)', async () => {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('x-auth-token', mockToken)
        .send({});

      expect(res.status).toBe(400);
    });

    test('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/copilot/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(401);
    });
  });
});
