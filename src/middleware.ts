import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import { env } from '~/lib/env';

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

// Function to check if email is an admin
// Exported for testing purposes only
export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  
  // Normalize the input email - remove all whitespace and go lowercase
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get admin emails from environment variable or use empty array
  const adminEmailsRaw = env.ADMIN_EMAILS || '';
  
  // Split and normalize carefully 
  const adminEmails = adminEmailsRaw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);
  
  // Try multiple approaches to check if email is in admin list
  let isAdmin = false;
  
  // 1. Compare by component parts (local part and domain separately)
  if (normalizedEmail.includes('@')) {
    const [inputLocalPart, inputDomain] = normalizedEmail.split('@');
    
    // Compare the local part and domain separately for each admin email
    adminEmails.forEach(adminEmail => {
      if (adminEmail.includes('@')) {
        const [adminLocalPart, adminDomain] = adminEmail.split('@');
        
        // Compare local part and domain separately
        const localPartMatch = adminLocalPart.toLowerCase() === inputLocalPart.toLowerCase();
        const domainMatch = adminDomain.toLowerCase() === inputDomain.toLowerCase();
        
        if (localPartMatch && domainMatch) {
          isAdmin = true;
        }
      }
    });
  }
  
  // 2. Direct comparison (simpler approach)
  if (!isAdmin) {
    adminEmails.forEach(adminEmail => {
      if (adminEmail === normalizedEmail) {
        isAdmin = true;
      }
    });
  }
  
  // In development mode, use the dev bypass if enabled
  // Explicitly check that we're not in production mode
  if (!isAdmin && isDevelopment && process.env.NODE_ENV !== 'production' && process.env.DEV_ADMIN_BYPASS === 'true') {
    console.log('Development bypass enabled, granting admin access');
    return true;
  }
  
  return isAdmin;
}

// Middleware function that runs before each request
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Only check authentication for API routes that need protection
  if (PROTECTED_API_PATHS.some(prefix => path.startsWith(prefix))) {
    // Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // If no token in the Authorization header, check X-MS-TOKEN header
    if (!accessToken) {
      const msTokenHeader = request.headers.get('X-MS-TOKEN');
      if (msTokenHeader) {
        accessToken = msTokenHeader;
      }
    }
    
    // If still no token, try to get from server-side session
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    // Check cookies as a last resort
    if (!accessToken) {
      const cookies = request.cookies;
      const msGraphToken = cookies.get('msGraphToken');
      if (msGraphToken) {
        accessToken = msGraphToken.value;
      }
    }
    
    // If no token found, user is not authenticated
    if (!accessToken) {
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
    
    // Normalize email to lowercase
    if (userEmail) {
      userEmail = userEmail.toLowerCase();
    }
    
    // Check if the user's email domain is allowed
    if (userEmail) {
      const emailDomain = userEmail.split('@')[1]?.toLowerCase();
      
      // Skip domain validation in development mode if configured
      if (isDevelopment && !env.ALLOWED_EMAIL_DOMAIN) {
        // Development mode: skip domain validation
      } else {
        // Check if the email domain is in the allowed list
        // ALLOWED_EMAIL_DOMAIN can be a comma-separated list of domains
        const allowedDomains = env.ALLOWED_EMAIL_DOMAIN?.split(',').map(d => d.trim().toLowerCase()) || [];
        
        if (!allowedDomains.includes(emailDomain)) {
          return NextResponse.json(
            {
              error: "Access denied",
              message: `This application is restricted to users with ${allowedDomains.join(' or ')} email addresses`
            },
            { status: 403 }
          );
        }
      }
      
      // Check admin access for admin paths
      if (ADMIN_API_PATHS.some(prefix => path.startsWith(prefix))) {
        // Special case for the admin check endpoint itself to avoid circular dependencies
        const isAdminCheckEndpoint = path === '/api/admin/check' || 
                                     path.startsWith('/api/system/debug/');
        
        if (isAdminCheckEndpoint) {
          // Allow access for diagnostics
        }
        // In development mode with DEV_ADMIN_BYPASS=true, allow access for testing
        else if (isDevelopment && process.env.DEV_ADMIN_BYPASS === 'true') {
          // Admin access granted via dev bypass
        } else if (!isAdminEmail(userEmail)) {
          return NextResponse.json(
            {
              error: "Access denied",
              message: "You do not have permission to access this resource"
            },
            { status: 403 }
          );
        }
      }
    } else {
      // In development, we might want to allow requests without email headers
      if (!isDevelopment) {
        return NextResponse.json(
          {
            error: "Access denied",
            message: "User email information is missing"
          },
          { status: 403 }
        );
      }
    }
  }
  
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