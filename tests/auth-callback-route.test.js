/**
 * @jest-environment node
 */

// Tests for the auth callback route
// This tests that the route correctly redirects based on domain

const { NextResponse } = require('next/server');

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    redirect: jest.fn().mockImplementation(url => ({ url }))
  }
}));

// Import the route handler - using dynamic import since it's a Next.js route
let GET;

// Setup test
beforeAll(async () => {
  // Mock console.log to reduce noise in test output
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  
  // Dynamically import the module (jest needs to resolve it)
  const mod = await import('../src/app/api/auth/callback/route');
  GET = mod.GET;
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Auth Callback Route', () => {
  // Clear mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should redirect to production URL when host is comms.solutioncenter.ai', async () => {
    // Create mock request with comms.solutioncenter.ai host
    const mockRequest = new Request('https://comms.solutioncenter.ai/api/auth/callback?code=test&state=test');
    Object.defineProperty(mockRequest, 'headers', {
      value: new Headers({
        'host': 'comms.solutioncenter.ai'
      })
    });

    // Call the route handler
    await GET(mockRequest);

    // Check that NextResponse.redirect was called with the right URL
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/comms\.solutioncenter\.ai/)
    );
  });

  test('should redirect to localhost when not in production', async () => {
    // Create mock request with localhost host
    const mockRequest = new Request('http://localhost:3000/api/auth/callback?code=test&state=test');
    Object.defineProperty(mockRequest, 'headers', {
      value: new Headers({
        'host': 'localhost:3000'
      })
    });

    // Call the route handler
    await GET(mockRequest);

    // Check that NextResponse.redirect was called with the right URL
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:3000/)
    );
  });

  test('should include auth parameters in the hash of the redirect URL', async () => {
    // Create mock request with code and state parameters
    const mockRequest = new Request('https://comms.solutioncenter.ai/api/auth/callback?code=testcode&state=teststate');
    Object.defineProperty(mockRequest, 'headers', {
      value: new Headers({
        'host': 'comms.solutioncenter.ai'
      })
    });

    // Call the route handler
    await GET(mockRequest);

    // Check that the URL includes the code and state in the hash
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/code=testcode/)
    );
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/state=teststate/)
    );
  });

  test('should handle errors in the query parameters', async () => {
    // Create mock request with an error
    const mockRequest = new Request('https://comms.solutioncenter.ai/api/auth/callback?error=access_denied&error_description=User%20cancelled%20login');
    Object.defineProperty(mockRequest, 'headers', {
      value: new Headers({
        'host': 'comms.solutioncenter.ai'
      })
    });

    // Call the route handler
    await GET(mockRequest);

    // Check that NextResponse.redirect was called with the right URL including error params
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/authError=access_denied/)
    );
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/authErrorDescription=User%20cancelled%20login/)
    );
  });
}); 