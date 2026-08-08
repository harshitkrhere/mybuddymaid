// Next.js Middleware for auth protection + redirects.
// Protects /home, /bookings, /profile routes — redirects to /auth/login if no session.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/home', '/bookings', '/profile', '/dashboard'];

// Routes that should redirect TO the app if already authenticated
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Supabase auth token in cookies
  const supabaseAuthToken = request.cookies.get('sb-irqsjuwkbcmnooyivakq-auth-token');
  const isAuthenticated = !!supabaseAuthToken;

  // Protect app routes — redirect to login if not authenticated
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated and visiting login/register, redirect to /home
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on specific routes (not on static assets, API, etc.)
  matcher: [
    '/home/:path*',
    '/bookings/:path*',
    '/profile/:path*',
    '/dashboard/:path*',
    '/auth/:path*',
  ],
};
