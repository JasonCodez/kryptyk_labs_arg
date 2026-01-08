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

// Deprecated middleware - migrated to `src/proxy.ts` per Next.js guidance.
// Keep this file around temporarily for reference but it will trigger a deprecation warning.
// Please delete `src/middleware.ts` once you have confirmed `src/proxy.ts` is working as expected.

export async function middleware(_request: NextRequest) {
  // No-op - proxy file handles routing now
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
