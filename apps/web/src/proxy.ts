import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Protect all routes except auth, static assets, and public pages. The PWA
  // files must stay public too: browsers fetch the manifest without cookies,
  // and a service worker script that redirects to /login fails to install.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|sw.js|manifest.webmanifest|offline.html|icons/|apple-icon).*)',
  ],
};
