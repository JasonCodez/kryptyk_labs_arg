"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

function SignInForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLoggedOut = searchParams.get("logout") === "true";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only redirect if session exists, not explicitly logging out, and mounted
  useEffect(() => {
    if (!mounted) return;
    
    if (session?.user && !isLoggedOut && status === "authenticated") {
      // Clear the logout flag if it was set
      if (isLoggedOut) {
        window.history.replaceState({}, "", "/auth/signin");
      }
      router.push("/dashboard");
    }
  }, [session, status, isLoggedOut, mounted, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // First, make sure to clear any existing session by calling signout
      await fetch("/api/auth/signout", { method: "POST" });
      
      // Now attempt sign in with new credentials
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("Sign in result:", result);

      if (result?.error) {
        setError(result.error || "Sign in failed");
      } else if (result?.ok) {
        // Force a full page reload to get new session
        window.location.href = "/dashboard";
      } else {
        setError("Sign in failed. Please try again.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 pt-16" style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }}>
      <div className="w-full max-w-md">
        <div className="border rounded-lg p-8" style={{ backgroundColor: 'rgba(76, 91, 92, 0.6)', borderColor: '#3891A6' }}>
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            🔐 Kryptyk Labs
          </h1>
          <p style={{ color: '#3891A6' }} className="text-center mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
              {error}
            </div>
          )}

          {session?.user && (
            <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.2)', borderColor: '#3891A6' }}>
              Currently signed in as <strong>{session.user.email}</strong>. Enter different credentials to switch accounts.
            </div>
          )}

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

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                Password
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-white font-semibold transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: '#3891A6' }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p style={{ color: '#3891A6' }}>
              Don't have an account?{" "}
              <Link href="/auth/register" className="font-semibold" style={{ color: '#FDE74C' }}>
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 text-center" style={{ borderTopColor: '#3891A6', borderTopWidth: '1px' }}>
            <Link href="/" style={{ color: '#3891A6' }} className="text-sm hover:opacity-80">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
