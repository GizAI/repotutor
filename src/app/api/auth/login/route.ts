/**
 * Login API
 *
 * Sets authentication cookie on successful password verification.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const password = process.env.REPOTUTOR_PASSWORD;

  if (!password) {
    return NextResponse.json({ error: 'No password configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const inputPassword = body.password;

    if (inputPassword !== password) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Set authentication cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('repotutor_auth', password, {
      httpOnly: true,
      secure: false,  // Allow HTTP for local development
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
