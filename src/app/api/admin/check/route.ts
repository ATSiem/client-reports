import { NextResponse } from 'next/server';
import { env } from '~/lib/env';

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
    
    // Normalize the email
    const normalizedEmail = userEmail.toLowerCase().trim();
    
    // Get the list of admin emails from environment variables
    const adminEmailsRaw = env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);
    
    // Compare the email to the list of admin emails
    const isAdmin = adminEmails.includes(normalizedEmail);
    
    // For development purposes, check component parts separately
    let componentMatch = false;
    let debugInfo = null;
    
    if (normalizedEmail.includes('@')) {
      const [inputLocalPart, inputDomain] = normalizedEmail.split('@');
      
      debugInfo = {
        normalizedEmail, 
        adminEmails: adminEmails.map(email => {
          // Obfuscate emails slightly for security
          if (!email.includes('@')) return email;
          const [adminLocal, adminDomain] = email.split('@');
          return `${adminLocal.substring(0, 3)}***@${adminDomain}`;
        }),
        inputParts: {
          localPart: inputLocalPart,
          domain: inputDomain
        }
      };
      
      // Check each admin email
      adminEmails.forEach(adminEmail => {
        if (adminEmail.includes('@')) {
          const [adminLocalPart, adminDomain] = adminEmail.split('@');
          
          const localPartMatch = adminLocalPart.toLowerCase() === inputLocalPart.toLowerCase();
          const domainMatch = adminDomain.toLowerCase() === inputDomain.toLowerCase();
          
          if (localPartMatch && domainMatch) {
            componentMatch = true;
          }
        }
      });
    }
    
    // Check if we have a component match even if the exact match failed
    if (!isAdmin && componentMatch) {
      console.log('Admin component match found for:', normalizedEmail);
      return NextResponse.json({ 
        isAdmin: true,
        method: 'component_match',
        debug: debugInfo
      });
    }
    
    // Return the result
    return NextResponse.json({ 
      isAdmin,
      method: isAdmin ? 'exact_match' : 'no_match',
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