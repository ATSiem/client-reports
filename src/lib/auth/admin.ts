export function isAdminUser(email: string | undefined | null): boolean {
  console.log('isAdminUser called with email:', email);
  
  if (!email) {
    console.log('No email provided to isAdminUser');
    return false;
  }
  
  // Hardcoded admin emails from .env
  const adminEmails = [
    'asiemiginowski@defactoglobal.com',
    'bsheridan@defactoglobal.com'
  ].map(e => e.toLowerCase());
  
  console.log('Admin emails list:', adminEmails);
  console.log('Checking email:', email.toLowerCase());
  
  const isAdmin = adminEmails.includes(email.toLowerCase());
  console.log('Is admin?', isAdmin);
  
  return isAdmin;
} 