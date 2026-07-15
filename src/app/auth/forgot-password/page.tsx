"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success to prevent email enumeration
      setStatus("sent");
    } catch {
      setStatus("sent");
    }
  }

  return (
    <>
      <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }}>
        <div className="w-full max-w-md">
          <div className="border rounded-lg p-8" style={{ backgroundColor: 'rgba(76, 91, 92, 0.6)', borderColor: '#3891A6' }}>
            <div className="flex justify-center mb-2">
              <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-48 w-auto max-w-md" />
            </div>
            <p style={{ color: '#3891A6' }} className="text-center mb-8">Reset your password</p>

            {status === "sent" ? (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(56,211,153,0.1)', borderColor: '#38D399' }}>
                  <p className="text-sm" style={{ color: '#38D399' }}>
                    If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.
                  </p>
                </div>
                <Link href="/auth/signin" className="inline-block text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: '#3891A6' }}>
                  ← Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: '#888' }}>
                  Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none transition"
                      placeholder="you@example.com"
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
                    {status === "loading" ? "Sending..." : "Send Reset Link"}
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
