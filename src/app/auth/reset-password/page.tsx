"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to reset password. The link may have expired.");
        setStatus("error");
      }
    } catch {
      setError("An error occurred. Please try again.");
      setStatus("error");
    }
  }

  if (!token) {
    return (
      <>
        <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020202' }}>
          <div className="w-full max-w-md text-center space-y-4">
            <p style={{ color: '#fca5a5' }}>Invalid or missing reset link.</p>
            <Link href="/auth/forgot-password" className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: '#3891A6' }}>
              Request a new reset link
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }}>
        <div className="w-full max-w-md">
          <div className="border rounded-lg p-8" style={{ backgroundColor: 'rgba(76, 91, 92, 0.6)', borderColor: '#3891A6' }}>
            <div className="flex justify-center mb-2">
              <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-48 w-auto max-w-md" />
            </div>
            <p style={{ color: '#3891A6' }} className="text-center mb-8">Choose a new password</p>

            {status === "success" ? (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(56,211,153,0.1)', borderColor: '#38D399' }}>
                  <p className="text-sm" style={{ color: '#38D399' }}>
                    Your password has been reset successfully!
                  </p>
                </div>
                <Link href="/auth/signin" className="inline-block px-6 py-2 rounded-lg font-semibold transition hover:opacity-90" style={{ backgroundColor: '#3891A6', color: '#020202' }}>
                  Sign In
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-6 p-4 rounded-lg text-sm border" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none transition"
                      placeholder="••••••••"
                      style={{ backgroundColor: '#2a3a3b', borderWidth: '2px', borderColor: '#3891A6' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#FDE74C'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#3891A6'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none transition"
                      placeholder="••••••••"
                      style={{ backgroundColor: '#2a3a3b', borderWidth: '2px', borderColor: '#3891A6' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#FDE74C'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#3891A6'}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full py-2 rounded-lg font-semibold transition disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: '#3891A6', color: '#020202' }}
                  >
                    {status === "loading" ? "Resetting..." : "Reset Password"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/auth/signin" className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: '#3891A6' }}>
                    ← Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
