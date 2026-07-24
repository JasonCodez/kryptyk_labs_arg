import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { BETA_ONLY_MODE, hasBetaAccess } from "@/lib/betaAccess";

// ── Coming-soon gate ──────────────────────────────────────────────────────────
// Set COMING_SOON=true in env to redirect all visitors to /coming-soon.
// Bypass: append ?preview=<PREVIEW_SECRET> to any URL; stores a session cookie.
const COMING_SOON_ACTIVE = false;
const PREVIEW_SECRET     = process.env.PREVIEW_SECRET ?? '';
const BYPASS_COOKIE      = 'pw_preview_bypass';

const COMING_SOON_ALLOWED = [
  '/coming-soon',
  '/auth',
  '/dashboard',
  '/debrief',
  '/frequency',
  '/api/auth',
  '/api/user',
  '/api/admin/check',
  '/api/debrief',
  '/api/waitlist',
  '/api/gridlock',
  '/api/founder-count',
  '/_next',
  '/favicon',
  '/images',
  '/uploads',
];

const BETA_PUBLIC_PATHS = [
  '/coming-soon',
  '/auth',
  '/invite',
  '/api/auth',
  '/api/waitlist',
  '/api/founder-count',
  '/api/user/referral/lookup',
  '/_next',
  '/favicon',
  '/images',
  '/uploads',
  '/manifest',
  '/icon',
  '/apple-icon',
  '/sw.js',
];

// Page routes that require authentication — redirects to /auth/signin (an HTML page,
// correct for a browser navigation). API routes are deliberately excluded: they already
// enforce their own auth (getServerSession/requireAuthenticatedUser) and return a proper
// JSON 401, which client-side fetch() calls rely on. Redirecting an API route here instead
// hands back an HTML sign-in page with a 200 status once the redirect is followed, which
// breaks any `res.json()` call on the client with a "Unexpected token '<'" parse error.
const protectedPaths = [
  "/dashboard",
  "/puzzles",
  "/teams",
  "/leaderboards",
];

// Narrow exception: an exact Team Detail page (/teams/<id> or /teams/<id>/)
// may be viewed by an unauthenticated visitor when the team is public — the
// Team API and page already enforce that boundary. Nested paths like
// /teams/<id>/settings or /teams/<id>/manage stay behind normal auth.
function isPublicTeamDetailPath(pathname: string): boolean {
  return /^\/teams\/[^/]+\/?$/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Coming-soon gate (runs before everything else) ──────────────────────────
  if (COMING_SOON_ACTIVE && !COMING_SOON_ALLOWED.some(p => pathname.startsWith(p))) {
    // Allow bypass via ?preview=<secret> — set cookie and redirect to clean URL
    if (PREVIEW_SECRET && searchParams.get('preview') === PREVIEW_SECRET) {
      const url = request.nextUrl.clone();
      url.searchParams.delete('preview');
      const res = NextResponse.redirect(url);
      res.cookies.set(BYPASS_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' });
      return res;
    }
    // Allow bypass via cookie
    if (request.cookies.get(BYPASS_COOKIE)?.value !== '1') {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      return NextResponse.redirect(url);
    }
  }

  const token = await getToken({ req: request });

  if (BETA_ONLY_MODE && !BETA_PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/signin';
      url.searchParams.set('beta', '1');
      return NextResponse.redirect(url);
    }

    const betaToken = token as {
      email?: string | null;
      role?: string | null;
      betaApproved?: boolean;
    };

    if (!hasBetaAccess({
      email: betaToken.email,
      role: betaToken.role,
      betaApproved: betaToken.betaApproved === true,
    })) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      url.searchParams.set('beta', '1');
      return NextResponse.redirect(url);
    }
  }

  // Check if accessing protected paths
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
    && !isPublicTeamDetailPath(pathname);

  if (isProtectedPath && !token) {
    // Redirect to signin if not authenticated
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  // No forced redirect for auth pages; allow visiting sign-in/register even when logged in
  const response = NextResponse.next();

  // Apply security headers in proxy instead of middleware to follow new Next.js guidance
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "worker-src 'self' blob:",
    // Allow websocket/connect to backend Socket.IO server in development
    process.env.NODE_ENV === 'production' ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com" : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    process.env.NODE_ENV === 'production'
      ? "connect-src 'self' data: https: wss: https://sandpack.codesandbox.io wss://sandpack.codesandbox.io"
      : "connect-src 'self' data: https: ws: http://localhost:4000 ws://localhost:4000 https://sandpack.codesandbox.io wss://sandpack.codesandbox.io",
    "frame-src 'self' https://sandpack.codesandbox.io https://codesandbox.io",
    "frame-ancestors 'none'",
    "media-src 'self' https: blob:",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     * Required so the coming-soon gate can intercept every route.
     * Exclude /api/auth so NextAuth action routes are resolved directly.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};