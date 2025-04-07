const { execSync } = require('child_process');
const { generateVersionToken } = require('../src/lib/utils');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('generateVersionToken', () => {
  const originalDate = global.Date;
  let mockDate;

  beforeEach(() => {
    // Mock Date to return a fixed date in tests
    mockDate = new Date('2025-04-07T15:30:00Z');
    global.Date = class extends Date {
      constructor() {
        return mockDate;
      }
    };
    
    // Reset the mock implementation of execSync
    execSync.mockReset();
  });

  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  test('returns formatted version with commit hash and EST date/time', () => {
    // Mock execSync to return a fixed commit hash
    execSync.mockReturnValue(Buffer.from('abcdef1'));
    
    // Call function
    const versionToken = generateVersionToken();
    
    // Assert format matches "commit XXXXXX - YYYY-MM-DD HH:MM"
    expect(versionToken).toMatch(/^commit [a-f0-9]+ - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    
    // Assert specific values
    expect(versionToken).toContain('abcdef1');
    // Note: The exact date/time will depend on the EST conversion of our fixed mock date
  });

  test('returns fallback when git command fails', () => {
    // Mock execSync to throw an error
    execSync.mockImplementation(() => {
      throw new Error('git command failed');
    });
    
    // Call function
    const versionToken = generateVersionToken();
    
    // Assert fallback format
    expect(versionToken).toMatch(/^build \d{4}-\d{2}-\d{2}$/);
  });
}); 