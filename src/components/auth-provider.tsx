'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import { 
  handleRedirectResult, 
  getActiveAccount, 
  loginWithMicrosoft, 
  logoutFromMicrosoft, 
  getAccessToken,
  clearMsalCache,
  getAllAccounts,
  setActiveAccount
} from '~/lib/auth/msal-adapter';
import { env } from '~/lib/env';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AccountInfo | null;
  login: () => void;
  logout: () => void;
  error: string | null;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: () => {},
  logout: () => {},
  error: null,
  accessToken: null
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [configError, setConfigError] = useState<boolean>(false);

  // Initial check for environment configuration
  useEffect(() => {
    const missingConfig = !process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || 
                         !process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 
                         !process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI;
    
    if (missingConfig) {
      console.error('Missing authentication configuration');
      setConfigError(true);
      setError('Application configuration error. Please check environment variables.');
      setIsLoading(false);
    }
  }, []);

  // Function to validate user's email domain
  const validateUserDomain = (email: string | undefined): boolean => {
    console.log('Validating email domain for:', email);
    
    if (!email) {
      console.log('No email provided for validation');
      return false;
    }
    
    const emailDomain = email.split('@')[1]?.toLowerCase();
    console.log('Email domain:', emailDomain, 'Allowed domain:', env.ALLOWED_EMAIL_DOMAIN);
    
    // If ALLOWED_EMAIL_DOMAIN is not set or empty, allow all domains
    if (!env.ALLOWED_EMAIL_DOMAIN) {
      console.log('No domain restriction configured, allowing all domains');
      return true;
    }
    
    // Check if the email domain is in the allowed list
    // ALLOWED_EMAIL_DOMAIN can be a comma-separated list of domains
    const allowedDomains = env.ALLOWED_EMAIL_DOMAIN.split(',').map(d => d.trim().toLowerCase());
    console.log('Allowed domains:', allowedDomains);
    
    const isAllowed = allowedDomains.includes(emailDomain);
    console.log('Domain validation result:', isAllowed ? 'Allowed' : 'Denied');
    return isAllowed;
  };

  // Function to add user email to request headers
  const addUserEmailToHeaders = (email: string | undefined) => {
    if (typeof window !== 'undefined' && email) {
      const lowercaseEmail = email.toLowerCase();
      console.log('Storing user email in session storage:', lowercaseEmail);
      // Store the email in sessionStorage for use in API requests
      sessionStorage.setItem('userEmail', lowercaseEmail);
    }
  };

  // Initialize authentication
  useEffect(() => {
    // Skip initialization if configuration is missing
    if (configError) {
      return;
    }
    
    // Handle redirects from Microsoft login
    const handleAuth = async () => {
      try {
        // Check for error parameters in the URL (from auth callback redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const authError = urlParams.get('authError');
        const authErrorDescription = urlParams.get('authErrorDescription');
        
        if (authError) {
          console.error('Auth error from callback:', authError, authErrorDescription);
          setError(`Authentication error: ${authError}${authErrorDescription ? ` - ${authErrorDescription}` : ''}`);
          setIsLoading(false);
          return;
        }
        
        // Check for auth hash
        console.log('Current URL:', window.location.href);
        console.log('URL hash presence:', !!window.location.hash);
        
        // Process the authentication result
        const result = await handleRedirectResult();
        console.log('Auth redirect result:', result ? 'Present' : 'None');
        
        if (result) {
          // Successfully logged in via redirect
          console.log('Successfully authenticated from redirect');
          
          // Validate user domain
          const userEmail = result.account?.username;
          console.log('User email from auth result:', userEmail);
          
          if (!validateUserDomain(userEmail)) {
            console.error('User domain not allowed:', userEmail);
            const allowedDomains = env.ALLOWED_EMAIL_DOMAIN ? env.ALLOWED_EMAIL_DOMAIN.split(',').map(d => d.trim()) : ['authorized domains'];
            setError(`Access restricted to ${allowedDomains.join(' or ')} email addresses`);
            setIsAuthenticated(false);
            sessionStorage.removeItem('msGraphToken');
            await logoutFromMicrosoft();
            setIsLoading(false);
            return;
          }
          
          setUser(result.account);
          setAccessToken(result.accessToken);
          setIsAuthenticated(true);
          
          // Store the token in sessionStorage for Graph API use
          sessionStorage.setItem('msGraphToken', result.accessToken);
          
          // Also set a cookie for API routes
          document.cookie = `msGraphToken=${result.accessToken}; path=/; secure; max-age=3600`;
          
          // Add user email to headers
          addUserEmailToHeaders(userEmail);
          
          // Clean URL
          if (result && window.history) {
            console.log('Cleaning URL after successful authentication');
            window.history.replaceState({}, document.title, window.location.pathname);
            
            const hostname = window.location.hostname;
            
            // If we're on the callback URL for production, redirect to home
            if (hostname === 'client-reports.onrender.com' && 
                window.location.pathname === '/api/auth/callback') {
              console.log('Detected callback URL in production, redirecting to home');
              window.location.href = 'https://client-reports.onrender.com/';
              return;
            }
            
            // If we're on an unexpected URL (like localhost:10000), redirect to the app's home
            if (hostname === 'localhost' && 
                window.location.port !== '3000' && 
                window.location.port !== '') {
              console.log('Detected incorrect port, redirecting to correct development URL');
              window.location.href = 'http://localhost:3000';
              return;
            }
          }
        } else {
          // Check if we have an active account
          const account = await getActiveAccount();
          console.log('Active account:', account);
          
          // If no active account, but we have accounts, set the first one active
          if (!account) {
            const accounts = await getAllAccounts();
            console.log('All accounts:', accounts);
            
            if (accounts.length > 0) {
              await setActiveAccount(accounts[0]);
              
              // Validate user domain
              const userEmail = accounts[0]?.username;
              console.log('User email from accounts[0]:', userEmail);
              
              if (!validateUserDomain(userEmail)) {
                console.error('User domain not allowed:', userEmail);
                const allowedDomains = env.ALLOWED_EMAIL_DOMAIN ? env.ALLOWED_EMAIL_DOMAIN.split(',').map(d => d.trim()) : ['authorized domains'];
                setError(`Access restricted to ${allowedDomains.join(' or ')} email addresses`);
                setIsAuthenticated(false);
                sessionStorage.removeItem('msGraphToken');
                await logoutFromMicrosoft();
                setIsLoading(false);
                return;
              }
              
              setUser(accounts[0]);
              
              // Try to get a token silently
              const token = await getAccessToken();
              if (token) {
                setAccessToken(token);
                setIsAuthenticated(true);
                sessionStorage.setItem('msGraphToken', token);
                document.cookie = `msGraphToken=${token}; path=/; secure; max-age=3600`;
                
                // Add user email to headers
                addUserEmailToHeaders(userEmail);
              } else {
                setIsAuthenticated(false);
                sessionStorage.removeItem('msGraphToken');
              }
            } else {
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
            }
          } else {
            // Validate user domain
            const userEmail = account?.username;
            console.log('User email from active account:', userEmail);
            
            if (!validateUserDomain(userEmail)) {
              console.error('User domain not allowed:', userEmail);
              const allowedDomains = env.ALLOWED_EMAIL_DOMAIN ? env.ALLOWED_EMAIL_DOMAIN.split(',').map(d => d.trim()) : ['authorized domains'];
              setError(`Access restricted to ${allowedDomains.join(' or ')} email addresses`);
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
              await logoutFromMicrosoft();
              setIsLoading(false);
              return;
            }
            
            setUser(account);
            
            // Try to get a token silently
            const token = await getAccessToken();
            if (token) {
              setAccessToken(token);
              setIsAuthenticated(true);
              sessionStorage.setItem('msGraphToken', token);
              document.cookie = `msGraphToken=${token}; path=/; secure; max-age=3600`;
              
              // Add user email to headers
              addUserEmailToHeaders(userEmail);
            } else {
              setIsAuthenticated(false);
              sessionStorage.removeItem('msGraphToken');
            }
          }
          
          // Clean URL if it has authorization code
          if (result && window.history) {
            console.log('Cleaning URL after authentication');
            window.history.replaceState({}, document.title, window.location.pathname);
            
            const hostname = window.location.hostname;
            
            // If we're on the callback URL for production, redirect to home
            if (hostname === 'client-reports.onrender.com' && 
                window.location.pathname === '/api/auth/callback') {
              console.log('Detected callback URL in production, redirecting to home');
              window.location.href = 'https://client-reports.onrender.com/';
              return;
            }
            
            // If we're on an unexpected URL (like localhost:10000), redirect to the app's home
            if (hostname === 'localhost' && 
                window.location.port !== '3000' && 
                window.location.port !== '') {
              console.log('Detected incorrect port, redirecting to correct development URL');
              window.location.href = 'http://localhost:3000';
              return;
            }
          }
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
        setError('Authentication failed. Please try again.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('msGraphToken');
        
        // Clean URL even on error
        if (window.location.hash && window.history) {
          console.log('Cleaning URL after authentication error');
          window.history.replaceState({}, document.title, window.location.pathname);
          
          const hostname = window.location.hostname;
          
          // If we're on the callback URL for production, redirect to home
          if (hostname === 'client-reports.onrender.com' && 
              window.location.pathname === '/api/auth/callback') {
            console.log('Detected callback URL in production, redirecting to home');
            window.location.href = 'https://client-reports.onrender.com/';
            return;
          }
          
          // If we're on an unexpected URL (like localhost:10000), redirect to the app's home
          if (hostname === 'localhost' && 
              window.location.port !== '3000' && 
              window.location.port !== '') {
            console.log('Detected incorrect port, redirecting to correct development URL');
            window.location.href = 'http://localhost:3000';
            return;
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    handleAuth();
  }, [configError]);

  // Login function
  const login = async () => {
    // Don't attempt login if configuration is missing
    if (configError) {
      setError('Authentication is not available due to missing configuration');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Clear any previous state
      clearMsalCache();
      sessionStorage.removeItem('msGraphToken');
      sessionStorage.removeItem('userEmail');
      sessionStorage.removeItem('msalAuthHash'); // Clear any saved auth hash
      
      // Redirect to Microsoft login
      await loginWithMicrosoft();
      // The page will redirect, so no need to update state here
    } catch (e) {
      console.error('Login error:', e);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Logout function - performs local logout only, not global Microsoft logout
  const logout = async () => {
    setIsLoading(true);
    
    try {
      // Call MSAL logout first (with onRedirectNavigate preventing global logout)
      await logoutFromMicrosoft();
      
      // Then clear all local state
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('msGraphToken');
      sessionStorage.removeItem('userEmail');
      sessionStorage.removeItem('msalAuthHash'); // Clear any saved auth hash
      
      // Clear cookies
      document.cookie = 'msGraphToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Clear MSAL cache
      clearMsalCache();
      
      // Finally reset loading state
      setIsLoading(false);
    } catch (e) {
      console.error('Logout error:', e);
      setError('Logout failed. Please try again.');
      
      // Force cleanup on error
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('msGraphToken');
      sessionStorage.removeItem('userEmail');
      sessionStorage.removeItem('msalAuthHash'); // Clear any saved auth hash
      clearMsalCache();
      setIsLoading(false);
    }
  };

  // Add user email and token to request headers for all API requests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      
      window.fetch = async (input, init) => {
        // Only modify API requests to our own backend
        if (typeof input === 'string' && input.startsWith('/api/')) {
          const userEmail = sessionStorage.getItem('userEmail');
          const token = sessionStorage.getItem('msGraphToken');
          console.log('Adding user email to API request:', userEmail);
          console.log('Adding token to API request:', token ? 'yes' : 'no');
          
          // Create new headers object with the user email and token
          const newInit = { ...init };
          newInit.headers = { ...newInit.headers };
          
          if (userEmail) {
            newInit.headers = {
              ...newInit.headers,
              'X-User-Email': userEmail.toLowerCase()
            };
          }
          
          if (token) {
            newInit.headers = {
              ...newInit.headers,
              'X-MS-TOKEN': token
            };
          }
          
          return originalFetch(input, newInit);
        }
        
        // Pass through all other requests unchanged
        return originalFetch(input, init);
      };
      
      // Cleanup function to restore original fetch
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      user, 
      login, 
      logout, 
      error,
      accessToken
    }}>
      {configError && !isLoading ? (
        <div className="p-4 m-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>Authentication configuration error. Please ensure environment variables are set correctly.</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}