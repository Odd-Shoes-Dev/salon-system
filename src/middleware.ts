import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  const hostnameWithoutPort = hostname.split(':')[0];
  
  // Normalize hostname: remove www. prefix
  const normalizedHostname = hostnameWithoutPort.replace(/^www\./, '');
  
  // Extract subdomain from hostname
  // Examples: elite.blueoxgroup.eu → elite, localhost:3001 → localhost
  const hostnameParts = normalizedHostname.split('.');
  let subdomain = hostnameParts[0];
  let customDomain = '';
  
  // List of owned domains (subdomains should be extracted from these)
  const ownedDomains = ['blueoxgroup.eu', 'blueox.com', 'localhost'];
  
  // Check if hostname is one of our owned domains
  const isOwnedDomain = ownedDomains.some(domain => 
    normalizedHostname === domain || normalizedHostname.endsWith('.' + domain)
  );
  
  // Check if this is a custom domain (not localhost, not vercel, not our owned domain)
  const isCustomDomain = !hostname.includes('localhost') && 
                         !hostname.includes('127.0.0.1') && 
                         !hostname.includes('.vercel.app') &&
                         !isOwnedDomain &&
                         hostnameParts.length >= 2;
  
  if (isCustomDomain) {
    // For custom domains like poshnailcare.com, use the normalized hostname
    // This already has www. stripped
    customDomain = normalizedHostname;
    subdomain = 'custom'; // Placeholder, will be resolved from database
  } else if (subdomain === 'localhost' || subdomain === '127' || hostname.includes('.vercel.app')) {
    // For localhost development and Vercel default domains, use 'posh' subdomain
    subdomain = 'posh';
  }
  // For owned domains with subdomains (demo.blueoxgroup.eu), subdomain is already extracted
  
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/register', '/_next', '/api/auth/login', '/api/auth/logout'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || pathname.includes('.');
  
  // Protected paths that require authentication
  const protectedPaths = ['/dashboard', '/pos', '/clients', '/staff', '/loyalty', '/sms'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  // Check for auth token
  const authToken = request.cookies.get('auth_token')?.value;
  
  // Redirect unauthenticated users trying to access protected pages
  if (isProtectedPath && !authToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // Redirect authenticated users away from login page
  if (pathname === '/login' && authToken) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }
  
  // Pass subdomain to the app via headers
  const response = NextResponse.next();
  response.headers.set('x-salon-subdomain', subdomain);
  response.headers.set('x-custom-domain', customDomain);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
