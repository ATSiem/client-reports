import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/components/auth-provider';
import * as msalAdapter from '../src/lib/auth/msal-adapter';

// Mock MSAL adapter functions
jest.mock('../src/lib/auth/msal-adapter', () => ({
  handleRedirectResult: jest.fn(),
  getActiveAccount: jest.fn(),
  loginWithMicrosoft: jest.fn(),
  logoutFromMicrosoft: jest.fn(),
  getAccessToken: jest.fn(),
  clearMsalCache: jest.fn(),
  getAllAccounts: jest.fn(),
  setActiveAccount: jest.fn(),
}));

// Mock environment variables
process.env = {
  ...process.env,
  NEXT_PUBLIC_AZURE_CLIENT_ID: 'test-client-id',
  NEXT_PUBLIC_AZURE_TENANT_ID: 'test-tenant-id',
  NEXT_PUBLIC_AZURE_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
};

// Create a test component to access auth context
function TestAuthComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <button data-testid="login-button" onClick={auth.login}>Login</button>
      <button data-testid="logout-button" onClick={auth.logout}>Logout</button>
    </div>
  );
}

describe('Authentication Cookie Persistence', () => {
  // Mock cookies implementation
  let documentCookies = {};
  const originalDocumentCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  
  beforeAll(() => {
    // Setup cookie mock
    Object.defineProperty(document, 'cookie', {
      get: jest.fn(() => {
        return Object.entries(documentCookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
      }),
      set: jest.fn((cookieString) => {
        const match = cookieString.match(/^([^=]+)=([^;]+)/);
        if (match) {
          const [, key, value] = match;
          documentCookies[key] = value;
        }
        return cookieString;
      }),
      configurable: true
    });
  });

  afterAll(() => {
    // Restore original document.cookie
    if (originalDocumentCookie) {
      Object.defineProperty(Document.prototype, 'cookie', originalDocumentCookie);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    documentCookies = {};
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
  });

  test('should set authentication cookie with SameSite attribute after successful login', async () => {
    // Mock successful login
    msalAdapter.handleRedirectResult.mockResolvedValue({
      account: { username: 'test@example.com' },
      accessToken: 'test-access-token'
    });
    
    // Render component
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for auth to initialize
    await act(async () => {
      // Trigger handleRedirectResult
    });
    
    // Check if the cookie was set properly
    expect(document.cookie).toContain('msGraphToken=test-access-token');
    expect(document.cookie).toContain('SameSite=Lax');
    expect(document.cookie).toContain('secure');
    
    // Verify auth state is set to authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
  });

  test('should properly persist authentication across page refreshes', async () => {
    // First simulate existing token in sessionStorage
    window.sessionStorage.setItem('msGraphToken', 'existing-token');
    documentCookies['msGraphToken'] = 'existing-token';
    
    // Mock active account and token
    msalAdapter.getActiveAccount.mockResolvedValue({ username: 'test@example.com' });
    msalAdapter.getAccessToken.mockResolvedValue('existing-token');
    
    // Render component
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for auth to initialize
    await act(async () => {
      // Wait for async operations
    });
    
    // Verify auth state is set to authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
  });

  test('should clear cookie and sessionStorage on logout', async () => {
    // Setup initial authenticated state
    window.sessionStorage.setItem('msGraphToken', 'existing-token');
    documentCookies['msGraphToken'] = 'existing-token';
    
    // Mock active account and token
    msalAdapter.getActiveAccount.mockResolvedValue({ username: 'test@example.com' });
    msalAdapter.getAccessToken.mockResolvedValue('existing-token');
    
    // Render component
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    
    // Wait for auth to initialize
    await act(async () => {
      // Wait for async operations
    });
    
    // Perform logout
    fireEvent.click(screen.getByTestId('logout-button'));
    
    // Wait for logout to complete
    await act(async () => {
      // Wait for async operations
    });
    
    // Verify cookie and sessionStorage are cleared
    expect(window.sessionStorage.getItem('msGraphToken')).toBeNull();
    expect(document.cookie).not.toContain('msGraphToken=');
    
    // Verify auth state is set to not authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
  });

  test('should allow login after logout (regression test)', async () => {
    // Mock successful login
    msalAdapter.handleRedirectResult.mockResolvedValue({
      account: { username: 'test@example.com' },
      accessToken: 'test-access-token'
    });
    msalAdapter.getActiveAccount.mockResolvedValue({ username: 'test@example.com' });
    msalAdapter.getAccessToken.mockResolvedValue('test-access-token');

    // Render component and login
    render(
      <AuthProvider>
        <TestAuthComponent />
      </AuthProvider>
    );
    await act(async () => {});
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');

    // Perform logout
    fireEvent.click(screen.getByTestId('logout-button'));
    await act(async () => {});
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');

    // Mock login again (simulate new login)
    msalAdapter.handleRedirectResult.mockResolvedValue({
      account: { username: 'test@example.com' },
      accessToken: 'test-access-token-2'
    });
    msalAdapter.getActiveAccount.mockResolvedValue({ username: 'test@example.com' });
    msalAdapter.getAccessToken.mockResolvedValue('test-access-token-2');

    // Perform login
    fireEvent.click(screen.getByTestId('login-button'));
    await act(async () => {});
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(document.cookie).toContain('msGraphToken=test-access-token-2');
  });
}); 