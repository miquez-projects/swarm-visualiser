module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!tests/**',
    '!coverage/**',
    '!jest.config.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
