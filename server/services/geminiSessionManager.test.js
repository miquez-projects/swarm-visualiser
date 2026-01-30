const mockChat = { sendMessage: jest.fn() };
const mockModel = { startChat: jest.fn().mockReturnValue(mockChat) };

jest.mock('./geminiService', () => ({
  createModel: jest.fn().mockReturnValue(mockModel)
}));

const sessionManager = require('./geminiSessionManager');

// Access the module-level activeSessions Map via the manager's methods
// We need to clear sessions between tests
beforeEach(() => {
  // Clean all sessions by creating expired ones won't work; use cleanup trick
  // Instead, we rely on getActiveSessionCount and unique userIds per test
  jest.useFakeTimers();
  // Clear sessions by advancing time and running cleanup
  jest.setSystemTime(Date.now() + 60 * 60 * 1000);
  sessionManager.cleanup();
  jest.useRealTimers();
  mockModel.startChat.mockClear();
});

afterEach(() => {
  sessionManager.stopCleanupInterval();
});

describe('validateUserId', () => {
  test('accepts valid string IDs', () => {
    expect(() => sessionManager.validateUserId('123')).not.toThrow();
    expect(() => sessionManager.validateUserId('user-abc')).not.toThrow();
  });

  test('rejects null/undefined', () => {
    expect(() => sessionManager.validateUserId(null)).toThrow('Invalid userId');
    expect(() => sessionManager.validateUserId(undefined)).toThrow('Invalid userId');
  });

  test('rejects non-string values', () => {
    expect(() => sessionManager.validateUserId(123)).toThrow('Invalid userId');
    expect(() => sessionManager.validateUserId({})).toThrow('Invalid userId');
  });

  test('rejects empty string', () => {
    expect(() => sessionManager.validateUserId('')).toThrow('Invalid userId');
    expect(() => sessionManager.validateUserId('   ')).toThrow('Invalid userId');
  });

  test('rejects strings exceeding 255 characters', () => {
    expect(() => sessionManager.validateUserId('a'.repeat(256))).toThrow('exceeds maximum length');
  });
});

describe('formatHistory', () => {
  test('returns empty array for null/undefined/empty', () => {
    expect(sessionManager.formatHistory(null)).toEqual([]);
    expect(sessionManager.formatHistory(undefined)).toEqual([]);
    expect(sessionManager.formatHistory([])).toEqual([]);
  });

  test('throws for non-array input', () => {
    expect(() => sessionManager.formatHistory('not array')).toThrow('must be an array');
  });

  test('converts assistant role to model', () => {
    const result = sessionManager.formatHistory([
      { role: 'assistant', content: 'hello' }
    ]);
    expect(result).toEqual([{ role: 'model', parts: [{ text: 'hello' }] }]);
  });

  test('keeps user role as user', () => {
    const result = sessionManager.formatHistory([
      { role: 'user', content: 'hi' }
    ]);
    expect(result).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  test('preserves thought signatures from content.parts', () => {
    const parts = [
      { thought: true, text: 'thinking...' },
      { text: 'visible response' }
    ];
    const result = sessionManager.formatHistory([
      { role: 'assistant', content: { parts } }
    ]);
    expect(result).toEqual([{ role: 'model', parts }]);
  });

  test('skips invalid messages', () => {
    const result = sessionManager.formatHistory([
      null,
      { role: 'invalid', content: 'x' },
      { role: 'user', content: 'valid' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  test('skips messages with empty content', () => {
    const result = sessionManager.formatHistory([
      { role: 'user', content: '   ' }
    ]);
    expect(result).toEqual([]);
  });
});

describe('getOrCreateSession', () => {
  test('creates a new session', () => {
    const session = sessionManager.getOrCreateSession('test-create-1');
    expect(session).toHaveProperty('chat');
    expect(session).toHaveProperty('lastActivity');
    expect(mockModel.startChat).toHaveBeenCalled();
  });

  test('returns cached session for same user', () => {
    const s1 = sessionManager.getOrCreateSession('test-cache-1');
    mockModel.startChat.mockClear();
    const s2 = sessionManager.getOrCreateSession('test-cache-1');
    expect(s2).toBe(s1);
    expect(mockModel.startChat).not.toHaveBeenCalled();
  });

  test('creates different sessions for different users', () => {
    const s1 = sessionManager.getOrCreateSession('test-diff-1');
    const s2 = sessionManager.getOrCreateSession('test-diff-2');
    expect(s1).not.toBe(s2);
  });
});

describe('cleanup', () => {
  test('removes expired sessions', () => {
    sessionManager.getOrCreateSession('test-expire-1');
    const countBefore = sessionManager.getActiveSessionCount();

    // Advance time past timeout
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + 31 * 60 * 1000);
    sessionManager.cleanup();
    jest.useRealTimers();

    expect(sessionManager.getActiveSessionCount()).toBeLessThan(countBefore);
  });
});

describe('cleanup interval', () => {
  test('starts and stops cleanup interval', () => {
    sessionManager.startCleanupInterval();
    expect(sessionManager.cleanupIntervalId).not.toBeNull();
    sessionManager.stopCleanupInterval();
    expect(sessionManager.cleanupIntervalId).toBeNull();
  });
});
