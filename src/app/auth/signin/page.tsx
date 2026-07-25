"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface GoogleInitiationOptions {
  mountedRef: { current: boolean };
  inFlightRef: { current: boolean };
  setConnecting: (value: boolean) => void;
  setError: (value: string) => void;
  start: () => Promise<unknown>;
}

export async function initiateGoogleSignIn({
  mountedRef,
  inFlightRef,
  setConnecting,
  setError,
  start,
}: GoogleInitiationOptions) {
  if (!mountedRef.current || inFlightRef.current) return;

  inFlightRef.current = true;
  setConnecting(true);
  setError("");

  try {
    await start();
    // A resolved initiation starts browser navigation. Keep the guard and
    // pending state active until this page unmounts.
  } catch {
    if (!mountedRef.current) return;

    inFlightRef.current = false;
    setConnecting(false);
    setError("Google sign-in could not be started. Please try again.");
  }
}

function SignInForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const betaOnly = searchParams.get("beta") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [loading, setLoading] = useState(false);
  const isLoggedOut = searchParams.get("logout") === "true";
  const [mounted, setMounted] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const googleInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    setMounted(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Only show the Google action when NextAuth actually has the provider
  // registered (i.e. GOOGLE_CLIENT_ID/SECRET are configured server-side) —
  // never assume availability from a public env var.
  useEffect(() => {
    let cancelled = false;
    getProviders()
      .then((discovered) => {
        if (cancelled) return;
        setGoogleAvailable(Boolean(discovered?.google));
      })
      .catch(() => {
        if (cancelled) return;
        setGoogleAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGoogleSignIn() {
    await initiateGoogleSignIn({
      mountedRef,
      inFlightRef: googleInFlightRef,
      setConnecting: setGoogleConnecting,
      setError,
      // Beta mode still lands on the normal dashboard once auth.ts approves
      // the account; there is no separate beta callback destination.
      start: () => signIn("google", { callbackUrl: "/dashboard" }),
    });
  }

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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

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

  async function handleResendVerification() {
    if (!email) {
      setError("Enter your email first, then resend.");
      return;
    }
    setResendStatus("sending");
    try {
      const resp = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        setResendStatus("failed");
        return;
      }
      setResendStatus("sent");
    } catch {
      setResendStatus("failed");
    }
  }

  return (
    <>
      <style>{`
        @keyframes si-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
        @keyframes si-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(0.94)} }
        @keyframes si-fade { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .si-card { animation: si-fade 0.6s ease forwards; }
        .si-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(56,145,166,0.3); border-radius: 10px; color: #fff; padding: 12px 16px; width: 100%; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .si-input::placeholder { color: rgba(255,255,255,0.25); }
        .si-input:focus { border-color: #3891A6; box-shadow: 0 0 0 3px rgba(56,145,166,0.15); }
        .si-btn { position:relative; overflow:hidden; }
        .si-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
        .si-btn:hover::after { left:130%; }
      `}</style>

      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden" }}>
        {/* Background orbs */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "si-orb1 16s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "si-orb2 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="si-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          {/* Card */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>Sign in to continue your puzzle journey</p>

            {betaOnly && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(56,145,166,0.12)", border: "1px solid rgba(56,145,166,0.3)", color: "#9BD1D6", fontSize: 14 }}>
                Private beta access only. Sign in with an approved tester account or register with an invited email address.
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 14 }}>
                {error}
                {error.toLowerCase().includes("email not verified") && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <button type="button" onClick={handleResendVerification} disabled={resendStatus === "sending"}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: "#3891A6", color: "#fff", border: "none", cursor: "pointer", opacity: resendStatus === "sending" ? 0.5 : 1 }}>
                      {resendStatus === "sending" ? "Sending…" : resendStatus === "sent" ? "Sent ✓" : "Resend verification"}
                    </button>
                    {resendStatus === "failed" && <span style={{ fontSize: 12, color: "#9CA3AF" }}>Could not send. Try again later.</span>}
                  </div>
                )}
              </div>
            )}

            {session?.user && (
              <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.3)", color: "#9BD1D6", fontSize: 13 }}>
                Signed in as <strong>{session.user.email}</strong>. Enter different credentials to switch.
              </div>
            )}

            {googleAvailable && (
              <>
                <button
                  type="button"
                  data-testid="google-signin-button"
                  onClick={handleGoogleSignIn}
                  disabled={googleConnecting}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", minHeight: 44, padding: "12px 16px", borderRadius: 10,
                    background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #747775",
                    fontWeight: 700, fontSize: 14, cursor: googleConnecting ? "not-allowed" : "pointer",
                    opacity: googleConnecting ? 0.7 : 1, marginBottom: 20,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ display: "inline-block", position: "relative", width: 20, height: 20, overflow: "hidden", flexShrink: 0 }}
                  >
                    <Image
                      src="/images/google-g-logo.svg"
                      alt=""
                      width={40}
                      height={40}
                      style={{ position: "absolute", left: -10, top: -10, width: 40, height: 40 }}
                    />
                  </span>
                  <span>{googleConnecting ? "Connecting to Google…" : "Continue with Google"}</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 12, color: "#6B7280" }}>or continue with email</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="si-input" autoComplete="email" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="si-input" autoComplete="current-password" />
              </div>

              <div style={{ textAlign: "right", marginTop: -8 }}>
                <Link href="/auth/forgot-password" style={{ fontSize: 13, color: "#3891A6", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9BD1D6")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#3891A6")}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="si-btn"
                style={{ marginTop: 4, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(56,145,166,0.6)"; }}}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(56,145,166,0.4)"; }}>
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6B7280" }}>
                Don&apos;t have an account?{" "}
                <Link href={betaOnly ? "/auth/register?beta=1" : "/auth/register"} style={{ color: "#FDE74C", fontWeight: 700, textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  Sign up free
                </Link>
              </p>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link href={betaOnly ? "/coming-soon?beta=1" : "/"} style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#9CA3AF")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}>
              ← Back to home
            </Link>
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
