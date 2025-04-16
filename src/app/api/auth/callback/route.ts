import { NextResponse } from "next/server";

// This route will be used as the redirect URI for MSAL authentication
// The authentication itself happens on the client side using MSAL
// This route just redirects back to the main page after authentication

export async function GET(request: Request) {
  // Extract the auth code from URL parameters
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  
  console.log('Auth callback received:', { 
    hasCode: !!code, 
    hasState: !!state,
    hasError: !!error,
    errorDescription: errorDescription || 'none'
  });
  
  // Get host information
  const host = request.headers.get('host') || '';
  const forwardedHost = request.headers.get('x-forwarded-host') || '';
  const referer = request.headers.get('referer') || '';
  
  console.log('Host header:', host);
  console.log('X-Forwarded-Host:', forwardedHost);
  console.log('Referer:', referer);
  
  // Simple redirect URL determination
  const isProduction = host.includes('comms.solutioncenter.ai') || 
                       forwardedHost.includes('comms.solutioncenter.ai');
  
  // Get the appropriate base URL
  const baseUrl = isProduction
    ? 'https://comms.solutioncenter.ai'
    : 'http://localhost:3000';
  
  // Create the redirect URL
  const redirectUrl = new URL(baseUrl);
  
  console.log(`Environment detected: ${isProduction ? 'Production' : 'Development'}`);
  console.log('Redirect URL base:', redirectUrl.toString());
  
  // If there was an error, redirect to login page with error message
  if (error) {
    console.error('Auth error:', error, errorDescription);
    redirectUrl.searchParams.set('authError', error);
    if (errorDescription) {
      redirectUrl.searchParams.set('authErrorDescription', errorDescription);
    }
    console.log('Redirecting to error URL:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl.toString());
  }
  
  // Add the auth parameters to the hash (MSAL expects them in the hash)
  if (code || state) {
    const hashParams = [];
    if (code) hashParams.push(`code=${encodeURIComponent(code)}`);
    if (state) hashParams.push(`state=${encodeURIComponent(state)}`);
    redirectUrl.hash = hashParams.join('&');
  }
  
  console.log('Redirecting to:', redirectUrl.toString());
  
  // Redirect to the main page with auth parameters in the URL hash
  return NextResponse.redirect(redirectUrl.toString());
}