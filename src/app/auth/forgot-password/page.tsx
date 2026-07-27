"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show the same success outcome regardless of the response —
      // this is required to prevent email-address enumeration. Never branch
      // on res.ok or render anything from the response body here.
      setStatus("sent");
    } catch {
      setStatus("sent");
    }
  }

  function handleTryAnotherEmail() {
    setEmail("");
    setStatus("idle");
  }

  return (
    <>
      <style>{`
        @keyframes fp-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
        @keyframes fp-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(0.94)} }
        @keyframes fp-fade { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .fp-card { animation: fp-fade 0.6s ease forwards; }
        .fp-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(56,145,166,0.3); border-radius: 10px; color: #fff; padding: 12px 16px; width: 100%; min-height: 44px; font-size: 14px; outline: none; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
        .fp-input::placeholder { color: rgba(255,255,255,0.25); }
        .fp-input:focus { border-color: #3891A6; box-shadow: 0 0 0 3px rgba(56,145,166,0.15); }
        .fp-btn { position:relative; overflow:hidden; }
        .fp-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
        .fp-btn:hover::after { left:130%; }
        .fp-link:focus-visible, .fp-btn:focus-visible, .fp-input:focus-visible { outline: 2px solid #FDE74C; outline-offset: 2px; }
      `}</style>

      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        {/* Background orbs */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "fp-orb1 16s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "fp-orb2 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="fp-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          {/* Card */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box" }}>
            {status === "sent" ? (
              <div data-testid="forgot-password-sent" style={{ textAlign: "center" }} aria-live="polite">
                <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(110,231,183,0.15)", border: "1px solid #6EE7B7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, lineHeight: 1, color: "#6EE7B7" }}>
                  ✓
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Check your inbox</h1>
                <div role="status" style={{ marginTop: 20, marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.4)", color: "#6EE7B7", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                  If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Link href="/auth/signin" className="fp-link" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none" }}>
                    Back to sign in
                  </Link>
                  <button type="button" onClick={handleTryAnotherEmail} className="fp-link" style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 6 }}>
                    Try another email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#3891A6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Account recovery
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Reset your password</h1>
                <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.5 }}>
                  Enter the email address connected to your account and we&apos;ll send you a secure reset link.
                </p>

                <form data-testid="forgot-password-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label htmlFor="forgot-password-email" style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      id="forgot-password-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="fp-input"
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="forgot-password-submit"
                    disabled={status === "loading"}
                    className="fp-btn"
                    style={{
                      marginTop: 4, minHeight: 44, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15,
                      color: "#fff", backgroundColor: "#3891A6", border: "none",
                      cursor: status === "loading" ? "not-allowed" : "pointer",
                      opacity: status === "loading" ? 0.6 : 1,
                      boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                  >
                    {status === "loading" ? "Sending…" : "Send reset link"}
                  </button>
                </form>
              </>
            )}
          </div>

          {status !== "sent" && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link href="/auth/signin" className="fp-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>
                ← Back to sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
