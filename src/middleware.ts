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

// Paths that should redirect to dashboard if already logged in
const authPaths = [
  "/auth/signin",
  "/auth/register",
];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const pathname = request.nextUrl.pathname;

  // Check if accessing protected paths
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath && !token) {
    // Redirect to signin if not authenticated
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  // Redirect to dashboard if already logged in and trying to access auth pages
  // UNLESS they have ?force=true to allow testing different accounts
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));
  const forceSignIn = request.nextUrl.searchParams.get("force") === "true";
  
  if (isAuthPath && token && !forceSignIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/puzzles/:path*",
    "/teams/:path*",
    "/leaderboards/:path*",
    "/auth/:path*",
    "/api/:path*",
  ],
};
