// Jest setup file

// Mock console.log for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock process.exit
process.exit = jest.fn();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SF_CLIENT_ID = 'test-client-id';
process.env.SF_USERNAME = 'test@example.com';
process.env.SF_PRIVATE_KEY_PATH = '/path/to/test/key.pem';