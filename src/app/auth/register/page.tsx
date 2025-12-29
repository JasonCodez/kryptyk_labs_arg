"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    // Get referral code from URL params
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, referralCode: referralCode || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Registration failed");
        return;
      }

      // Sign in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
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
          <p style={{ color: '#3891A6' }} className="text-center mb-8">Create your account</p>

          {error && (
            <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none transition"
                placeholder="Your name"
                style={{ backgroundColor: '#2a3a3b', borderWidth: '2px', borderColor: '#3891A6' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#FDE74C'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#3891A6'}
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#3891A6' }}>
                Confirm Password
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
              disabled={loading}
              className="w-full py-2 rounded-lg text-white font-semibold transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: '#3891A6' }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p style={{ color: '#3891A6' }}>
              Already have an account?{" "}
              <Link href="/auth/signin" className="font-semibold" style={{ color: '#FDE74C' }}>
                Sign in here
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
