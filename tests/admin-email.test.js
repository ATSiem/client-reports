// Tests for the isAdminEmail function

// Mock the environment variables for testing
const origEnv = process.env;

// Define test admin emails
const TEST_ADMIN_EMAILS = 'admin@example.com,test.admin@example.com';

// Mock the required modules
jest.mock('../src/lib/auth/microsoft', () => ({
  getUserAccessToken: jest.fn(),
  getGraphClient: jest.fn(),
  setUserAccessToken: jest.fn()
}));

// Mock the env module
jest.mock('../src/lib/env', () => ({
  env: {
    ADMIN_EMAILS: TEST_ADMIN_EMAILS
  },
  isProduction: false
}));

// Import the mocked env module
const { env } = require('../src/lib/env');

// Import the isAdminEmail function directly
// Note: We need to import after mocking dependencies
const { isAdminEmail } = require('../src/middleware');

describe('Admin Email Validation', () => {
  beforeEach(() => {
    // Reset the environment after each test
    process.env = { ...origEnv };
    process.env.NODE_ENV = 'test';
    process.env.DEV_ADMIN_BYPASS = 'false';
  });

  afterAll(() => {
    // Restore the environment
    process.env = origEnv;
  });

  test('should return false for null or empty emails', () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(' ')).toBe(false);
  });

  test('should return true for exact matching admin emails', () => {
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('test.admin@example.com')).toBe(true);
  });

  test('should return false for non-admin emails', () => {
    expect(isAdminEmail('user@example.com')).toBe(false);
    expect(isAdminEmail('notadmin@example.com')).toBe(false);
  });

  test('should be case insensitive', () => {
    expect(isAdminEmail('ADMIN@example.com')).toBe(true);
    expect(isAdminEmail('Admin@Example.Com')).toBe(true);
    expect(isAdminEmail('TEST.admin@EXAMPLE.com')).toBe(true);
  });

  test('should trim whitespace from emails', () => {
    expect(isAdminEmail(' admin@example.com ')).toBe(true);
    expect(isAdminEmail('\tadmin@example.com\n')).toBe(true);
  });

  test('should handle dev bypass when enabled', () => {
    // Set up the development bypass
    process.env.NODE_ENV = 'development';
    process.env.DEV_ADMIN_BYPASS = 'true';
    
    // Non-admin email should be granted access with bypass
    expect(isAdminEmail('regular@example.com')).toBe(true);
  });

  test('should not bypass in production even if DEV_ADMIN_BYPASS is true', () => {
    // Set up production environment
    process.env.NODE_ENV = 'production';
    process.env.DEV_ADMIN_BYPASS = 'true';
    
    // Non-admin email should not be granted access in production
    expect(isAdminEmail('regular@example.com')).toBe(false);
  });
}); 