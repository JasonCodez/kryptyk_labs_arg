"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const RP_STYLE = `
  @keyframes rp-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
  @keyframes rp-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(0.94)} }
  @keyframes rp-fade { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .rp-card { animation: rp-fade 0.6s ease forwards; }
  .rp-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(56,145,166,0.3); border-radius: 10px; color: #fff; padding: 12px 16px; width: 100%; min-height: 44px; font-size: 14px; outline: none; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
  .rp-input::placeholder { color: rgba(255,255,255,0.25); }
  .rp-input:focus { border-color: #3891A6; box-shadow: 0 0 0 3px rgba(56,145,166,0.15); }
  .rp-btn { position:relative; overflow:hidden; }
  .rp-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
  .rp-btn:hover::after { left:130%; }
  .rp-link:focus-visible, .rp-btn:focus-visible, .rp-input:focus-visible { outline: 2px solid #FDE74C; outline-offset: 2px; }
`;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  // Only a genuine API-rejected token (expired/invalid) should surface the
  // "Request a new reset link" CTA — a network failure doesn't tell us
  // anything about the token itself, so it stays a plain retry-friendly
  // message with no misleading suggestion that the link is bad.
  const [tokenRejectedByApi, setTokenRejectedByApi] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setError("");
    setTokenRejectedByApi(false);

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
        setTokenRejectedByApi(true);
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
        <style>{RP_STYLE}</style>
        <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
          {/* Background orbs */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "rp-orb1 16s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "rp-orb2 20s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
          </div>
          <div className="rp-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
            </div>
            <div data-testid="reset-password-missing-token" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box", textAlign: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Reset link unavailable</h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.5 }}>
                This password reset link is missing or invalid. Request a new link to continue.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href="/auth/forgot-password" className="rp-link" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none" }}>
                  Request a new reset link
                </Link>
                <Link href="/auth/signin" className="rp-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none", padding: 6 }}>
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{RP_STYLE}</style>
      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        {/* Background orbs */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "rp-orb1 16s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "rp-orb2 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="rp-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box" }}>
            {status === "success" ? (
              <div data-testid="reset-password-success" style={{ textAlign: "center" }} aria-live="polite">
                <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(110,231,183,0.15)", border: "1px solid #6EE7B7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, lineHeight: 1, color: "#6EE7B7" }}>
                  ✓
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Password updated</h1>
                <div role="status" style={{ marginTop: 20, marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.4)", color: "#6EE7B7", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                  Your password has been reset successfully.
                </div>
                <Link href="/auth/signin" className="rp-link" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, width: "100%", borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none", boxSizing: "border-box" }}>
                  Sign in
                </Link>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#3891A6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Account recovery
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Choose a new password</h1>
                <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.5 }}>
                  Your new password must be at least eight characters.
                </p>

                {error && (
                  <div role="alert" data-testid="reset-password-error" style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 14, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>{error}</p>
                    {tokenRejectedByApi && (
                      <Link href="/auth/forgot-password" className="rp-link" style={{ display: "inline-block", marginTop: 8, color: "#FCA5A5", fontWeight: 700, textDecoration: "underline" }}>
                        Request a new reset link
                      </Link>
                    )}
                  </div>
                )}

                <form data-testid="reset-password-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label htmlFor="reset-password-new" style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      New password
                    </label>
                    <input
                      id="reset-password-new"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="rp-input"
                    />
                  </div>

                  <div>
                    <label htmlFor="reset-password-confirm" style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Confirm new password
                    </label>
                    <input
                      id="reset-password-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="rp-input"
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="reset-password-submit"
                    disabled={status === "loading"}
                    className="rp-btn"
                    style={{
                      marginTop: 4, minHeight: 44, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15,
                      color: "#fff", backgroundColor: "#3891A6", border: "none",
                      cursor: status === "loading" ? "not-allowed" : "pointer",
                      opacity: status === "loading" ? 0.6 : 1,
                      boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                  >
                    {status === "loading" ? "Resetting…" : "Reset password"}
                  </button>
                </form>
              </>
            )}
          </div>

          {status !== "success" && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link href="/auth/signin" className="rp-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>
                ← Back to sign in
              </Link>
            </div>
          )}
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
