import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Extract subdomain from hostname
  // Examples: elite.blueox.com → elite, localhost:3001 → localhost
  let subdomain = hostname.split('.')[0].split(':')[0];
  
  // For localhost, use 'localhost' as the subdomain for demo purposes
  if (subdomain === 'localhost' || subdomain === '127') {
    subdomain = 'localhost';
  }
  
  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/register', '/_next', '/api/auth/login', '/api/auth/logout'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || pathname.includes('.');
  
  // Protected paths that require authentication
  const protectedPaths = ['/dashboard', '/pos', '/clients', '/staff', '/loyalty'];
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
