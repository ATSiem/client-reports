import { NextResponse } from "next/server";

// This route will be used as the redirect URI for MSAL authentication
// The authentication itself happens on the client side using MSAL
// This route just redirects back to the main page after authentication

export async function GET(request: Request) {
  // Extract the auth code from URL parameters or hash fragment if present
  const url = new URL(request.url);
  const redirectTo = url.origin;
  
  // Get authorization code and state from URL parameters
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('Auth callback received:', { hasCode: !!code, hasState: !!state });
  
  // Create a URL with the auth code and state to be processed by MSAL in the frontend
  // This approach passes the authentication parameters to the client-side MSAL
  const clientUrl = new URL(redirectTo);
  
  // Add the auth parameters to the hash (MSAL expects them in the hash)
  let hashParams = [];
  if (code) hashParams.push(`code=${encodeURIComponent(code)}`);
  if (state) hashParams.push(`state=${encodeURIComponent(state)}`);
  
  if (hashParams.length > 0) {
    clientUrl.hash = hashParams.join('&');
  }
  
  console.log('Redirecting to:', clientUrl.toString());
  
  // Redirect to the main page with auth parameters in the URL hash
  return NextResponse.redirect(clientUrl.toString());
}