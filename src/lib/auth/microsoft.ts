// This file now just provides helpers for OAuth-based authentication
// We'll use @azure/msal-browser for client-side auth in the browser

import { Client } from '@microsoft/microsoft-graph-client';

// This will be filled by the auth system with a token
// We'll use sessionStorage to persist the token across page refreshes
const getPersistedToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('msGraphToken');
  }
  return null;
};

const saveTokenToStorage = (token: string | null) => {
  if (typeof window !== 'undefined' && token) {
    sessionStorage.setItem('msGraphToken', token);
  } else if (typeof window !== 'undefined' && !token) {
    sessionStorage.removeItem('msGraphToken');
  }
};

// Initialize with any persisted token
let userAccessToken: string | null = getPersistedToken();

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
  userAccessToken = token;
  saveTokenToStorage(token);
  
  // Safe logging that doesn't expose token contents
  if (process.env.NODE_ENV !== 'production') {
    console.log('Token saved to storage:', token ? '[REDACTED]' : 'null');
  }
}

// Function to get the user's access token
export function getUserAccessToken() {
  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    // Always prioritize the token from sessionStorage for reliability
    const storedToken = getPersistedToken();
    
    if (storedToken) {
      // Update memory copy with storage value
      userAccessToken = storedToken;
      return storedToken;
    }
    
    // If we have a token in memory but not in storage, save it to storage
    if (userAccessToken) {
      saveTokenToStorage(userAccessToken);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // Running on server side - can only use in-memory token
    console.log('getUserAccessToken called on server side');
  }
  
  return userAccessToken;
}

// Create a Microsoft Graph client using delegated permissions
export function getGraphClient() {
  if (!userAccessToken) {
    throw new Error('User not authenticated');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Creating Graph client with token: [REDACTED]');
  }

  // Initialize the Graph client with the user's access token
  return Client.init({
    authProvider: (done) => {
      done(null, userAccessToken);
    },
    debugLogging: process.env.NODE_ENV !== 'production',
    // Enhanced middleware to log all requests and responses
    middlewares: [
      {
        // Log all requests
        execute: async (context, next) => {
          // Only log in non-production environments
          const shouldLog = process.env.NODE_ENV !== 'production';
          const { options } = context;
          
          if (shouldLog) {
            console.log(`Graph API Request - ${new Date().toISOString()}`);
            console.log(`  URL: ${options.method} ${options.url}`);
            
            if (options.headers) {
              // Log headers except Authorization which contains the token
              const filteredHeaders = { ...options.headers };
              if (filteredHeaders.Authorization) {
                filteredHeaders.Authorization = '[REDACTED]';
              }
              console.log(`  Headers: ${JSON.stringify(filteredHeaders)}`);
            }
            
            if (options.body) {
              console.log(`  Request Body: ${JSON.stringify(options.body)}`);
            }
          }
          
          try {
            // Execute the request
            await next();
            
            // Log the response
            if (shouldLog) {
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
                    
                    // Log a preview of the first few items - sanitize any email addresses
                    if (responseBody.value.length > 0) {
                      const sampleSize = Math.min(2, responseBody.value.length);
                      const sample = responseBody.value.slice(0, sampleSize).map(item => {
                        // Sanitize email addresses in sample data
                        const sanitized = { ...item };
                        if (sanitized.from && sanitized.from.emailAddress) {
                          sanitized.from.emailAddress.address = '[REDACTED EMAIL]';
                        }
                        if (sanitized.sender && sanitized.sender.emailAddress) {
                          sanitized.sender.emailAddress.address = '[REDACTED EMAIL]';
                        }
                        return sanitized;
                      });
                      console.log(`  Sample items: ${JSON.stringify(sample)}`);
                    }
                  } else {
                    // For smaller responses, log more details but sanitize sensitive data
                    const sanitizedResponse = JSON.stringify(responseBody)
                      .replace(/"email":\s*"[^"]+"/g, '"email": "[REDACTED]"')
                      .replace(/"address":\s*"[^"]+@[^"]+"/g, '"address": "[REDACTED EMAIL]"');
                    const responsePreview = sanitizedResponse.substring(0, 500);
                    console.log(`  Response preview: ${responsePreview}${responsePreview.length >= 500 ? '...' : ''}`);
                  }
                } catch (e) {
                  console.log(`  Error parsing response for logging: ${e.message || e}`);
                }
              }
            }
          } catch (error) {
            if (shouldLog) {
              console.log(`Graph API Error - ${new Date().toISOString()}`);
              console.log(`  Status: ${error.statusCode}`);
              console.log(`  Message: ${error.message}`);
            }
            throw error;
          }
        }
      }
    ]
  });
}