/**
 * Authentication Middleware
 *
 * Protects all routes with simple password authentication.
 * Password is stored in REPOTUTOR_PASSWORD environment variable.
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/_next',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if password is configured
  const password = process.env.REPOTUTOR_PASSWORD;
  if (!password) {
    // No password configured, allow all access
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get('repotutor_auth');
  if (authCookie?.value === password) {
    return NextResponse.next();
  }

  // Check for Authorization header (for API requests)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${password}`) {
    return NextResponse.next();
  }

  // For API routes, return 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For page routes, redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
