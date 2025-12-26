/**
 * Authentication Middleware
 *
 * Protects all routes with simple password authentication.
 * Password: GIZ_CODE_PASSWORD or REPOTUTOR_PASSWORD env var
 * Note: ~/.giz-code/config.yaml password is checked at login API level
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/check',
  '/api/health',
  '/api/projects',
  '/_next',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if password is configured (env var only - giz-config checked at API level)
  const password = process.env.GIZ_CODE_PASSWORD || process.env.REPOTUTOR_PASSWORD;
  if (!password) {
    // No env password - allow all (giz-config password checked at API level)
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
