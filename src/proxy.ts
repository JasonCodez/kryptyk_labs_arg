import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths that require authentication
const protectedPaths = [
  "/dashboard",
  "/puzzles",
  "/teams",
  "/leaderboards",
  "/api/user",
  "/api/teams",
  "/api/puzzles/submit",
];

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const pathname = request.nextUrl.pathname;

  // Check if accessing protected paths
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

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
    "img-src 'self' data:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "worker-src 'self' blob:",
    // Allow websocket/connect to backend Socket.IO server in development
    process.env.NODE_ENV === 'production' ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com" : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    process.env.NODE_ENV === 'production' ? "connect-src 'self' https:" : "connect-src 'self' https: ws: http://localhost:4000 ws://localhost:4000",
    "frame-ancestors 'none'",
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
    "/dashboard/:path*",
    "/puzzles/:path*",
    "/teams/:path*",
    "/leaderboards/:path*",
    "/auth/:path*",
    // Do not include /api/* here to avoid interfering with NextAuth and other API routes
  ],
};
