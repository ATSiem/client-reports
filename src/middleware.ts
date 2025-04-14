import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import { env } from '~/lib/env';
import { isAdminEmail } from '~/lib/admin';

// Define the paths that should be protected
const PROTECTED_API_PATHS = [
  '/api/clients',
  '/api/summarize',
  '/api/templates',
  '/api/search',
  '/api/feedback',
  '/api/system',
  '/api/admin',
];

// Admin-only paths
const ADMIN_API_PATHS = [
  '/api/admin',
  '/api/admin/check',
  '/api/admin/feedback',
  '/api/admin/feedback/csv'
];

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Middleware function that runs before each request
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  console.log('Middleware - Processing request for path:', path);
  
  // Only check authentication for API routes that need protection
  if (PROTECTED_API_PATHS.some(prefix => path.startsWith(prefix))) {
    console.log('Middleware - Protected API path detected');
    
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    console.log('Middleware - Auth header present:', !!authHeader);
    
    // If no token in the Authorization header, check X-MS-TOKEN header
    if (!accessToken) {
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      console.log('Middleware - X-MS-TOKEN header present:', !!msTokenHeader);
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      }
    }
    
    // If still no token, try to get from server-side session
    if (!accessToken) {
      accessToken = getUserAccessToken();
      console.log('Middleware - Token from server-side session:', accessToken ? 'present' : 'missing');
    }
    
    // Check cookies as a last resort
    if (!accessToken) {
      const cookies = request.cookies;
      const msGraphToken = cookies.get('msGraphToken');
      console.log('Middleware - msGraphToken cookie present:', !!msGraphToken);
      if (msGraphToken) {
        accessToken = msGraphToken.value;
      }
    }
    
    // If no token found, user is not authenticated
    if (!accessToken) {
      console.log('Middleware - No token found, returning 401');
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }

    // Get user email from various possible headers
    let userEmail = request.headers.get('x-user-email') || 
                    request.headers.get('X-User-Email') || 
                    request.headers.get('userEmail');
    
    console.log('Middleware - User email extracted:', userEmail);
    
    // Restore domain check
    if (userEmail) {
      userEmail = userEmail.toLowerCase().trim(); // Trim added here for safety
      const emailDomain = userEmail.split('@')[1]?.toLowerCase();
      
      // Skip domain validation in development mode if configured
      if (!(isDevelopment && !env.ALLOWED_EMAIL_DOMAIN)) {
         const allowedDomains = env.ALLOWED_EMAIL_DOMAIN?.split(',').map(d => d.trim().toLowerCase()) || [];
         if (!allowedDomains.includes(emailDomain)) {
           console.log(`[Middleware] Denying access due to domain mismatch: ${emailDomain}`);
           return NextResponse.json(
             {
               error: "Access denied",
               message: `This application is restricted to users with ${allowedDomains.join(' or ')} email addresses`
             },
             { status: 403 }
           );
         }
       }
    } else {
      if (!isDevelopment) {
         console.log('[Middleware] Denying access due to missing email header.');
         return NextResponse.json(
           { error: "Access denied", message: "User email information is missing" },
           { status: 403 }
         );
      }
    }

    // Restore original admin check structure
    if (userEmail && ADMIN_API_PATHS.some(prefix => path.startsWith(prefix))) {
        console.log(`[Admin Check] Path: ${path}, User: ${userEmail}`);
        
        const isAdminCheckEndpoint = path === '/api/admin/check' || 
                                     path.startsWith('/api/system/debug/') ||
                                     path.startsWith('/api/admin-test');
        const isSpecificAdminUser = userEmail === 'asiemiginowski@defactoglobal.com';
        const isUserAdminByList = isAdminEmail(userEmail);

        console.log(`[Admin Check] isAdminCheckEndpoint: ${isAdminCheckEndpoint}`);
        console.log(`[Admin Check] isSpecificAdminUser: ${isSpecificAdminUser}`);
        console.log(`[Admin Check] isUserAdminByList: ${isUserAdminByList}`);

        if (isAdminCheckEndpoint) {
          console.log('[Admin Check] Allowing diagnostic endpoint.');
        } else if (isSpecificAdminUser) {
            console.log('[Admin Check] Allowing specific admin user.');
        } else if (!isUserAdminByList) {
          console.log('[Admin Check] Denying access - not admin by list.');
          return NextResponse.json(
            { error: "Access denied", message: "You do not have permission to access this resource" },
            { status: 403 }
          );
        }
    }

    console.log(`[Middleware] Allowing request to proceed for path: ${path}`);
  } // End of PROTECTED_API_PATHS check
  
  // Forward the request with the current headers
  const response = NextResponse.next();
  
  // Ensure user email is forwarded in headers if available
  if (request.headers.has('x-user-email')) {
    response.headers.set('x-user-email', request.headers.get('x-user-email') || '');
  } else if (request.headers.has('X-User-Email')) {
    response.headers.set('x-user-email', request.headers.get('X-User-Email') || '');
  } else if (request.headers.has('userEmail')) {
    response.headers.set('x-user-email', request.headers.get('userEmail') || '');
  }
  
  return response;
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    // Match all API routes except auth-related endpoints
    '/api/:path*',
    // Exclude auth-related routes from middleware
    '/((?!api/auth).*)',
  ],
}; 