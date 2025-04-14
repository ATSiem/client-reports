import { NextResponse } from 'next/server';
import { env } from '~/lib/env';
import { isAdminEmail } from '~/lib/admin';

// Admin check API that validates if a user is an admin
export async function GET(request: Request) {
  try {
    const userEmail = request.headers.get('x-user-email') || 
                      request.headers.get('X-User-Email') || 
                      request.headers.get('userEmail');
                      
    // Get raw header values for debugging
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // If no email is provided, return an error
    if (!userEmail) {
      console.error('No user email in headers for admin check');
      return NextResponse.json({ 
        error: 'User email is missing',
        isAdmin: false,
        debug: { headers }
      }, { status: 400 });
    }
    
    // Check if the email is an admin
    const isAdmin = isAdminEmail(userEmail);
    
    // For diagnostic purposes, provide more details about the check
    const normalizedEmail = userEmail.toLowerCase().trim();
    const adminEmailsRaw = env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);
      
    const debugInfo = {
      normalizedEmail,
      adminEmails: adminEmails.map(email => {
        // Obfuscate emails slightly for security
        if (!email.includes('@')) return email;
        const [adminLocal, adminDomain] = email.split('@');
        return `${adminLocal.substring(0, 3)}***@${adminDomain}`;
      })
    };
    
    // Return the result
    return NextResponse.json({ 
      isAdmin,
      method: isAdmin ? 'shared_utility' : 'no_match',
      debug: debugInfo
    });
  } catch (error) {
    console.error('Error in admin check API:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', isAdmin: false },
      { status: 500 }
    );
  }
} 