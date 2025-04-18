// This file now just provides helpers for OAuth-based authentication
// We'll use @azure/msal-browser for client-side auth in the browser

import { Client } from '@microsoft/microsoft-graph-client';

// This will be filled by the auth system with a token
// We'll use localStorage to persist the token across browser sessions
const getPersistedToken = (): string | null => {
  if (typeof window !== 'undefined') {
    try {
      // Try to get token from localStorage
      const token = localStorage.getItem('msGraphToken');
      console.log('Token retrieved from localStorage:', token ? 'present' : 'missing');
      
      // Fallback to sessionStorage if not found in localStorage (backward compatibility)
      if (!token) {
        const sessionToken = sessionStorage.getItem('msGraphToken');
        if (sessionToken) {
          console.log('Token retrieved from sessionStorage (fallback):', 'present');
          // Move from sessionStorage to localStorage
          localStorage.setItem('msGraphToken', sessionToken);
          return sessionToken;
        }
      }
      
      return token;
    } catch (error) {
      console.error('Error accessing storage:', error);
      return null;
    }
  }
  return null;
};

const saveTokenToStorage = (token: string | null) => {
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        console.log('Saving token to localStorage');
        localStorage.setItem('msGraphToken', token);
        
        // Also save to sessionStorage for backward compatibility
        sessionStorage.setItem('msGraphToken', token);
      } else {
        console.log('Removing token from storage');
        localStorage.removeItem('msGraphToken');
        sessionStorage.removeItem('msGraphToken');
      }
    } catch (error) {
      console.error('Error accessing storage:', error);
    }
  }
};

// Initialize with any persisted token
let userAccessToken: string | null = null;

// Try to initialize from storage on module load (client-side only)
if (typeof window !== 'undefined') {
  try {
    userAccessToken = getPersistedToken();
    console.log('Initialized userAccessToken from storage:', userAccessToken ? 'present' : 'missing');
  } catch (error) {
    console.error('Error initializing token from storage:', error);
  }
}

// Configuration for MSAL - read from environment variables client-side safe
export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
    redirectUri: process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true, // Enable cookies for better persistence
  },
  system: {
    allowRedirectInIframe: true,
    windowHashTimeout: 9000, // Increase timeout for slower connections
    iframeHashTimeout: 9000,
    navigateFrameWait: 500, // Handle navigation more gracefully
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) {
          console.log(`MSAL (${level}): ${message}`);
        }
      },
      logLevel: 'Info',
    }
  }
};

// The scopes we need for delegated authentication
export const loginScopes = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadBasic',
  'offline_access'
];

// Function to set the access token after user login
export function setUserAccessToken(token: string | null) {
  console.log('setUserAccessToken called with token:', token ? 'present' : 'null');
  userAccessToken = token;
  saveTokenToStorage(token);
}

// Function to get the user's access token
export function getUserAccessToken() {
  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    console.log('getUserAccessToken called in browser');
    
    // Always prioritize the token from sessionStorage for reliability
    const storedToken = getPersistedToken();
    
    if (storedToken) {
      console.log('Using token from sessionStorage');
      // Update memory copy with storage value
      userAccessToken = storedToken;
      return storedToken;
    }
    
    // If we have a token in memory but not in storage, save it to storage
    if (userAccessToken) {
      console.log('Using token from memory and saving to storage');
      saveTokenToStorage(userAccessToken);
      return userAccessToken;
    }
    
    console.log('No token found in storage or memory');
    return null;
  } else {
    // Running on server side - can use in-memory token if available
    console.log('getUserAccessToken called on server side');
    if (userAccessToken) {
      console.log('Using in-memory token on server side');
      return userAccessToken;
    }
    console.log('No in-memory token available on server side');
    return null;
  }
}

// Create a Microsoft Graph client using delegated permissions
export function getGraphClient() {
  const token = getUserAccessToken();
  
  if (!token) {
    throw new Error('User not authenticated');
  }

  console.log('Creating Graph client with token:', token.substring(0, 10) + '...');

  // Initialize the Graph client with the user's access token
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
    debugLogging: true,
    // Enhanced middleware to log all requests and responses
    middlewares: [
      {
        // Log all requests
        execute: async (context, next) => {
          const { options } = context;
          
          console.log(`Graph API Request - ${new Date().toISOString()}`);
          console.log(`  URL: ${options.method} ${options.url}`);
          
          if (options.headers) {
            // Log headers except Authorization which contains the token
            const filteredHeaders = { ...options.headers };
            if (filteredHeaders.Authorization) {
              filteredHeaders.Authorization = filteredHeaders.Authorization.substring(0, 15) + '...';
            }
            console.log(`  Headers: ${JSON.stringify(filteredHeaders)}`);
          }
          
          if (options.body) {
            console.log(`  Request Body: ${JSON.stringify(options.body)}`);
          }
          
          try {
            // Execute the request
            await next();
            
            // Log the response
            console.log(`Graph API Response - ${new Date().toISOString()}`);
            console.log(`  Status: ${context.response.status}`);
            
            // For debugging, log a sample of the response data
            if (context.response.ok) {
              try {
                const responseClone = context.response.clone();
                const responseBody = await responseClone.json();
                
                // Don't log the entire response for large datasets
                if (responseBody && responseBody.value && Array.isArray(responseBody.value)) {
                  console.log(`  Response: Array with ${responseBody.value.length} items`);
                  
                  // Log a preview of the first few items
                  if (responseBody.value.length > 0) {
                    const sampleSize = Math.min(2, responseBody.value.length);
                    const sample = responseBody.value.slice(0, sampleSize);
                    console.log(`  Sample items: ${JSON.stringify(sample)}`);
                  }
                } else {
                  // For smaller responses, log more details
                  const responsePreview = JSON.stringify(responseBody).substring(0, 500);
                  console.log(`  Response preview: ${responsePreview}${responsePreview.length >= 500 ? '...' : ''}`);
                }
              } catch (e) {
                console.log(`  Error parsing response for logging: ${e.message || e}`);
              }
            }
          } catch (error) {
            console.log(`Graph API Error - ${new Date().toISOString()}`);
            console.log(`  Status: ${error.statusCode}`);
            console.log(`  Message: ${error.message}`);
            throw error;
          }
        }
      }
    ]
  });
}

// Add a synchronous version of getUserEmail that returns a string directly
let cachedUserEmail: string | null = null;

/**
 * Get the current user's email synchronously (from cache)
 * This is used in contexts where we can't use the Promise-based version
 * @returns The user's email or empty string
 */
export function getUserEmailSync(): string {
  return cachedUserEmail || '';
}

// Modify the existing getUserEmail function to update the cache

/**
 * Get the currently logged in user's email address
 * @returns The user's email address
 */
export async function getUserEmail(): Promise<string> {
  // Check if there's a cached token
  if (!getUserAccessToken()) {
    return '';
  }
  
  // Get the user's email from the Microsoft Graph API
  try {
    const client = getGraphClient();
    if (!client) {
      return '';
    }
    
    // Get user profile
    const userInfo = await client.api('/me').select('mail,userPrincipalName').get();
    const userEmail = userInfo.mail || userInfo.userPrincipalName || '';
    
    // Update the cache for synchronous access
    cachedUserEmail = userEmail;
    
    return userEmail;
  } catch (error) {
    console.error('Error getting user email:', error);
    return '';
  }
}