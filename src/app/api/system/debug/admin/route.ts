import { NextResponse } from "next/server";
import { env } from "~/lib/env";

// Only enable in development for security
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function GET(request: Request) {
  // Block this in production
  if (!isDevelopment) {
    return NextResponse.json({ error: "Debug endpoints are disabled in production" }, { status: 403 });
  }

  try {
    // Get the email from the headers
    const userEmail = request.headers.get('x-user-email') || 
                      request.headers.get('X-User-Email') || 
                      request.headers.get('userEmail');
    
    // Get all headers for debugging
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Show environment info
    // Get admin emails with redaction
    const adminEmailsRaw = env.ADMIN_EMAILS || '';
    
    const redactedEmails = adminEmailsRaw
      .split(',')
      .map(e => {
        e = e.trim();
        if (!e.includes('@')) return e;
        const [name, domain] = e.split('@');
        // Show first 3 chars of name and full domain for debugging
        return `${name.substring(0, 3)}***@${domain}`;
      });
      
    // For direct comparison, check if the user's email is in the admin list
    const adminEmails = adminEmailsRaw
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);
      
    const normalizedUserEmail = userEmail ? userEmail.toLowerCase().trim() : null;
    
    // Check if user is admin (multiple methods for debugging)
    const isAdminSimple = normalizedUserEmail ? adminEmails.includes(normalizedUserEmail) : false;
    
    // More forgiving comparison
    const isAdminForgiving = normalizedUserEmail ? adminEmails.some(adminEmail => {
      return adminEmail.replace(/\s+/g, '') === normalizedUserEmail.replace(/\s+/g, '');
    }) : false;
    
    // Return all diagnostic info
    return NextResponse.json({
      requestHeaders: headers,
      userEmail: {
        raw: userEmail,
        normalized: normalizedUserEmail,
        charCodes: normalizedUserEmail ? Array.from(normalizedUserEmail).map(c => c.charCodeAt(0)) : null
      },
      adminConfig: {
        redactedEmails,
        adminEmailsCount: adminEmails.length
      },
      adminCheck: {
        isAdminSimple,
        isAdminForgiving,
        // For each admin email, check if it matches
        individualComparisons: normalizedUserEmail ? adminEmails.map(adminEmail => ({
          adminEmail,
          exactMatch: adminEmail === normalizedUserEmail,
          noSpaceMatch: adminEmail.replace(/\s+/g, '') === normalizedUserEmail.replace(/\s+/g, ''),
          charCodes: Array.from(adminEmail).map(c => c.charCodeAt(0))
        })) : []
      }
    });
  } catch (error) {
    console.error("Error in admin debug endpoint:", error);
    return NextResponse.json({ error: "Debug endpoint error" }, { status: 500 });
  }
} 