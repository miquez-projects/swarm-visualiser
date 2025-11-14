// Helper functions for tests

// Mock database query helper
const mockDb = () => {
  return {
    query: jest.fn()
  };
};

// Mock user with token
const mockUser = {
  id: 1,
  secret_token: 'test-token-123',
  display_name: 'Test User',
  foursquare_user_id: '12345'
};

module.exports = {
  mockDb,
  mockUser
};
