import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MAINTENANCE_CONFIG } from './lib/maintenance';

export function proxy(request: NextRequest) {
  if (MAINTENANCE_CONFIG.isMaintenanceActive) {
    const url = request.nextUrl.clone();
    
    // Do not intercept the maintenance page itself, or Next.js internal/static assets
    if (
      url.pathname === '/maintenance' ||
      url.pathname.startsWith('/_next') ||
      url.pathname.startsWith('/assets') ||
      url.pathname.startsWith('/api') ||
      url.pathname.includes('.')
    ) {
      return NextResponse.next();
    }
    
    // Rewrite all other requests to the maintenance page
    url.pathname = '/maintenance';
    return NextResponse.rewrite(url);
  }
  
  // If user tries to visit /maintenance directly when it's off, redirect to home
  if (request.nextUrl.pathname === '/maintenance' && !MAINTENANCE_CONFIG.isMaintenanceActive) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (vite assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};
