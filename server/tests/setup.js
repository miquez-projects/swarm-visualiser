// Global test setup

// Set required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
