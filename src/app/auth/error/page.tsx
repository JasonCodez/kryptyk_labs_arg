"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// A fixed message per known NextAuth error code — the raw `error` query
// value is never rendered directly, so an attacker cannot inject arbitrary
// text (or a misleading link) into this page via the URL.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account already exists with this email. Sign in with your email and password first. Google account linking will be added from Account Settings in a later pass.",
  AccessDenied: "This Google account is not currently approved for PuzzleWarz access.",
  OAuthSignin: "Google sign-in could not be completed. Please try again.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  Configuration: "Google sign-in is temporarily unavailable. Please use email and password or try again later.",
  Default: "Google sign-in could not be completed. Please try again.",
};

export function getAuthErrorMessage(code: string | null | undefined): string {
  if (!code) return AUTH_ERROR_MESSAGES.Default!;
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.Default!;
}

function AuthErrorInner() {
  const searchParams = useSearchParams();
  const message = getAuthErrorMessage(searchParams.get("error"));

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: "#020202",
        backgroundImage: "linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div
          className="border rounded-lg p-8"
          style={{ backgroundColor: "rgba(76, 91, 92, 0.6)", borderColor: "#3891A6" }}
        >
          <h1 className="text-xl font-semibold text-white mb-2">Sign-in problem</h1>
          <p role="alert" data-testid="auth-error-message" className="text-sm" style={{ color: "#DDDBF1" }}>
            {message}
          </p>

          <div className="mt-6">
            <Link
              href="/auth/signin"
              className="inline-flex min-h-11 items-center font-semibold"
              style={{ color: "#FDE74C" }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthErrorInner />
    </Suspense>
  );
}
