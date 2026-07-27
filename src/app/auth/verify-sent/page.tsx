"use client";

import { useEffect, useRef, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Fixed, privacy-safe resend outcomes — never derived from response fields
// like `alreadyVerified`/`autoVerified`, which must never drive UI branching
// (that would let a caller distinguish "account exists" from "doesn't").
const RESEND_SUCCESS_MESSAGE =
  "If this account still needs verification, a new verification link has been sent. Check your inbox and spam folder.";
const RESEND_GENERIC_FAILURE_MESSAGE = "We couldn’t send another verification email. Please try again.";
const RESEND_DEFAULT_RATE_LIMIT_MESSAGE = "Too many verification email requests. Please try again later.";
const KNOWN_RATE_LIMIT_MESSAGES = new Set([
  "Too many verification email requests. Please try again later.",
  "Too many verification email requests for this address. Please try again later.",
]);

// Small local pure normalizer — intentionally not a full RFC-5322 validator,
// just enough to reject obviously-invalid query values before ever masking
// or sending them anywhere. Never logs, stores, or forwards the value except
// to the existing resend endpoint.
function normalizeVerificationEmail(raw: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.includes(" ")) return null;

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) return null;

  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return null;
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return null;
  if (domain.startsWith("-") || domain.endsWith("-")) return null;

  return trimmed;
}

// Shows the domain and at most the first two local-part characters — never
// the full local part, and never rendered at all for an invalid email.
function maskEmailForDisplay(normalizedEmail: string): string {
  const atIndex = normalizedEmail.indexOf("@");
  const local = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}****@${domain}`;
}

type ResendState = "idle" | "loading" | "success" | "error";

const VS_STYLE = `
  @keyframes vs-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
  @keyframes vs-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(0.94)} }
  @keyframes vs-fade { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .vs-card { animation: vs-fade 0.6s ease forwards; }
  .vs-btn { position:relative; overflow:hidden; box-sizing: border-box; }
  .vs-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
  .vs-btn:hover:not(:disabled)::after { left:130%; }
  .vs-link:focus-visible, .vs-btn:focus-visible { outline: 2px solid #FDE74C; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .vs-orb1, .vs-orb2, .vs-card { animation: none !important; }
  }
`;

function VerifySentInner() {
  const searchParams = useSearchParams();
  const normalizedEmail = normalizeVerificationEmail(searchParams.get("email"));
  const maskedEmail = normalizedEmail ? maskEmailForDisplay(normalizedEmail) : null;

  const mountedRef = useRef(false);
  const resendInFlightRef = useRef(false);
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleResend() {
    if (!normalizedEmail || resendInFlightRef.current) return;

    resendInFlightRef.current = true;
    setResendState("loading");
    setResendMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (res.ok) {
        if (!mountedRef.current) return;
        // Guard intentionally stays locked — the button is replaced by a
        // status message, so there is no further immediate resend to guard.
        setResendState("success");
        setResendMessage(RESEND_SUCCESS_MESSAGE);
        return;
      }

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const safeMessage =
          typeof data?.error === "string" && KNOWN_RATE_LIMIT_MESSAGES.has(data.error)
            ? data.error
            : RESEND_DEFAULT_RATE_LIMIT_MESSAGE;
        if (!mountedRef.current) return;
        setResendState("error");
        setResendMessage(safeMessage);
        resendInFlightRef.current = false;
        return;
      }

      if (!mountedRef.current) return;
      setResendState("error");
      setResendMessage(RESEND_GENERIC_FAILURE_MESSAGE);
      resendInFlightRef.current = false;
    } catch {
      if (!mountedRef.current) return;
      setResendState("error");
      setResendMessage(RESEND_GENERIC_FAILURE_MESSAGE);
      resendInFlightRef.current = false;
    }
  }

  if (!normalizedEmail) {
    return (
      <>
        <style>{VS_STYLE}</style>
        <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="vs-orb1" style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "vs-orb1 16s ease-in-out infinite" }} />
            <div className="vs-orb2" style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "vs-orb2 20s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
          </div>

          <div className="vs-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box", textAlign: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Verification email unavailable
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.5 }}>
                We could not determine which email address should receive another verification link.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Link
                  href="/auth/register"
                  className="vs-link"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none" }}
                >
                  Back to registration
                </Link>
                <Link href="/auth/signin" className="vs-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none", padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                  Go to sign in
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
      <style>{VS_STYLE}</style>
      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div className="vs-orb1" style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "vs-orb1 16s ease-in-out infinite" }} />
          <div className="vs-orb2" style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "vs-orb2 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="vs-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box" }}>
            <div style={{ textAlign: "center" }}>
              <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(56,145,166,0.15)", border: "1px solid #3891A6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20, lineHeight: 1, color: "#9BD1D6" }}>
                ✉
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#3891A6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Email verification
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
                We sent a verification link to your registered email address. Open the message and follow the link to activate your account.
              </p>

              {maskedEmail && (
                <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.3)", color: "#9BD1D6", fontSize: 13, wordBreak: "break-word" }}>
                  {maskedEmail}
                </div>
              )}

              <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 24, lineHeight: 1.5 }}>
                Verification links expire after 24 hours.
              </p>

              {resendState === "success" ? (
                <div data-testid="verify-sent-resend-status" role="status" aria-live="polite" style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.4)", color: "#6EE7B7", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Verification email sent</p>
                  <p style={{ margin: "4px 0 0" }}>{resendMessage}</p>
                </div>
              ) : (
                <>
                  {resendState === "error" && (
                    <div data-testid="verify-sent-resend-error" role="alert" style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                      {resendMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid="verify-sent-resend-button"
                    onClick={handleResend}
                    disabled={resendState === "loading"}
                    className="vs-btn"
                    style={{
                      width: "100%", minHeight: 44, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15,
                      color: "#fff", backgroundColor: "#3891A6", border: "none",
                      cursor: resendState === "loading" ? "not-allowed" : "pointer",
                      opacity: resendState === "loading" ? 0.6 : 1,
                      boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
                      marginBottom: 16,
                    }}
                  >
                    {resendState === "loading" ? "Sending…" : "Resend verification email"}
                  </button>
                </>
              )}

              <div>
                <Link href="/auth/signin" className="vs-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none", padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                  Go to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function VerifySentPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
          <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <style>{`@keyframes vs-fallback-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .vs-fallback-spinner { animation-duration: 2.4s; } }`}</style>
            <div
              aria-hidden="true"
              className="vs-fallback-spinner"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(56,145,166,0.25)", borderTopColor: "#3891A6", animation: "vs-fallback-spin 0.8s linear infinite" }}
            />
            <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
              Loading…
            </span>
          </div>
        </main>
      }
    >
      <VerifySentInner />
    </Suspense>
  );
}
