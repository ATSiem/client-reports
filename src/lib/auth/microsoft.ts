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
  console.log('Token saved to storage:', token ? token.substring(0, 10) + '...' : 'null');
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
  } else {
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

  console.log('Creating Graph client with token:', userAccessToken.substring(0, 10) + '...');

  // Initialize the Graph client with the user's access token
  return Client.init({
    authProvider: (done) => {
      done(null, userAccessToken);
    },
    debugLogging: true
  });
}