"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const PrelaunchRewardModal = dynamic(() => import("@/components/PrelaunchRewardModal"), { ssr: false });

type PrelaunchRewards = { xp: number; points: number; solves: number } | null;
type VerifyStatus = "loading" | "success" | "error";
type ResendState = "idle" | "loading" | "success" | "error";

// Fixed, privacy-safe resend outcomes — duplicated locally from
// /auth/verify-sent per the intentional small-duplication allowance for this
// pass (no shared auth component extracted). Never derived from response
// fields like `alreadyVerified`/`autoVerified`.
const RESEND_SUCCESS_MESSAGE =
  "If this account still needs verification, a new verification link has been sent. Check your inbox and spam folder.";
const RESEND_GENERIC_FAILURE_MESSAGE = "We couldn’t send another verification email. Please try again.";
const RESEND_DEFAULT_RATE_LIMIT_MESSAGE = "Too many verification email requests. Please try again later.";
const KNOWN_RATE_LIMIT_MESSAGES = new Set([
  "Too many verification email requests. Please try again later.",
  "Too many verification email requests for this address. Please try again later.",
]);

// Small local pure normalizer — duplicated from /auth/verify-sent for the
// same reason as the constants above.
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

const VE_STYLE = `
  @keyframes ve-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
  @keyframes ve-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(0.94)} }
  @keyframes ve-fade { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ve-spin { to { transform: rotate(360deg); } }
  .ve-card { animation: ve-fade 0.6s ease forwards; }
  .ve-btn { position:relative; overflow:hidden; box-sizing: border-box; }
  .ve-btn::after { content:''; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:rgba(255,255,255,0.12); transform:skewX(-20deg); transition:left 0.5s ease; }
  .ve-btn:hover:not(:disabled)::after { left:130%; }
  .ve-link:focus-visible, .ve-btn:focus-visible { outline: 2px solid #FDE74C; outline-offset: 2px; }
  .ve-spinner { animation: ve-spin 0.8s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .ve-orb1, .ve-orb2, .ve-card { animation: none !important; }
    .ve-spinner { animation-duration: 2.4s; }
  }
`;

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [message, setMessage] = useState<string>("Please wait while we securely activate your PuzzleWarz account.");
  const [prelaunchRewards, setPrelaunchRewards] = useState<PrelaunchRewards>(null);

  const verificationStartedRef = useRef(false);
  const mountedRef = useRef(false);
  const resendInFlightRef = useRef(false);
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [resendMessage, setResendMessage] = useState("");

  const normalizedEmail = normalizeVerificationEmail(searchParams.get("email"));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // EFFECT — starts the verification request exactly once per mounted
  // document. verificationStartedRef (not a module-global, not a timer)
  // guards against React Strict Mode's dev-only setup-cleanup-setup cycle
  // submitting the same token twice. Deliberately does NOT tie the pending
  // fetch's result to this effect invocation's own cleanup/cancellation —
  // doing so would let Strict Mode's simulated cleanup discard the one real
  // request's result and leave the page stuck in "loading" forever.
  useEffect(() => {
    const rawEmail = searchParams.get("email") || "";
    const token = searchParams.get("token") || "";

    if (!rawEmail || !token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    if (verificationStartedRef.current) return;
    verificationStartedRef.current = true;

    (async () => {
      try {
        const resp = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: rawEmail, token }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          setStatus("error");
          setMessage(typeof data?.error === "string" && data.error.trim() ? data.error : "Verification failed.");
          return;
        }

        const data = await resp.json().catch(() => ({}));
        setStatus("success");

        if (data?.prelaunchRewards?.xp > 0 || data?.prelaunchRewards?.points > 0) {
          // Show the reward modal; redirect happens when the user dismisses it.
          setPrelaunchRewards(data.prelaunchRewards);
          setMessage("Email verified! Your pre-launch rewards have been deposited.");
        } else {
          setMessage("Your account is ready. Taking you to sign in…");
        }
      } catch {
        setStatus("error");
        setMessage("Verification failed.");
      }
    })();
    // Intentionally run once per mount — verificationStartedRef already
    // guards re-entrancy, and this request is a one-time action tied to the
    // token in the URL at load time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preserves the exact 1500ms redirect for a normal (non-reward) success,
  // and never starts it while the reward modal is present.
  useEffect(() => {
    if (status !== "success" || prelaunchRewards) return;

    const timeout = window.setTimeout(() => {
      router.push("/auth/signin");
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [status, prelaunchRewards, router]);

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

  const resendBlock = normalizedEmail ? (
    <div style={{ marginTop: 20, textAlign: "left" }}>
      {resendState === "success" ? (
        <div data-testid="verify-resend-status" role="status" aria-live="polite" style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.4)", color: "#6EE7B7", fontSize: 14, lineHeight: 1.5 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Verification email sent</p>
          <p style={{ margin: "4px 0 0" }}>{resendMessage}</p>
        </div>
      ) : (
        <>
          {resendState === "error" && (
            <div data-testid="verify-resend-error" role="alert" style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 14, lineHeight: 1.5 }}>
              {resendMessage}
            </div>
          )}
          <button
            type="button"
            data-testid="verify-resend-button"
            onClick={handleResend}
            disabled={resendState === "loading"}
            className="ve-btn"
            style={{
              width: "100%", minHeight: 44, padding: "13px", borderRadius: 10, fontWeight: 700, fontSize: 15,
              color: "#fff", backgroundColor: "#3891A6", border: "none",
              cursor: resendState === "loading" ? "not-allowed" : "pointer",
              opacity: resendState === "loading" ? 0.6 : 1,
              boxShadow: "0 0 28px rgba(56,145,166,0.4)", transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            {resendState === "loading" ? "Sending…" : "Resend verification email"}
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <style>{VE_STYLE}</style>
      <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div className="ve-orb1" style={{ position: "absolute", top: "15%", left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.2) 0%, transparent 70%)", animation: "ve-orb1 16s ease-in-out infinite" }} />
          <div className="ve-orb2" style={{ position: "absolute", bottom: "10%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,145,166,0.12) 0%, transparent 70%)", animation: "ve-orb2 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,145,166,0.35) 1px, transparent 1px)", backgroundSize: "36px 36px", opacity: 0.04 }} />
        </div>

        <div className="ve-card" style={{ width: "100%", maxWidth: 440, position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz" style={{ height: 72, width: "auto", display: "inline-block" }} />
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(56,145,166,0.25)", borderRadius: 20, padding: "36px 32px", backdropFilter: "blur(12px)", boxSizing: "border-box", textAlign: "center" }}>
            {status === "loading" && (
              <div data-testid="verify-loading" role="status" aria-live="polite">
                <p style={{ fontSize: 12, fontWeight: 700, color: "#3891A6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Email verification
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
                  Verifying your email
                </h1>
                <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.5 }}>
                  Please wait while we securely activate your PuzzleWarz account.
                </p>
                <div
                  aria-hidden="true"
                  className="ve-spinner"
                  style={{ width: 32, height: 32, margin: "0 auto", borderRadius: "50%", border: "3px solid rgba(56,145,166,0.25)", borderTopColor: "#3891A6" }}
                />
              </div>
            )}

            {status === "success" && (
              <div data-testid="verify-success">
                <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(110,231,183,0.15)", border: "1px solid #6EE7B7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, lineHeight: 1, color: "#6EE7B7" }}>
                  ✓
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
                  Email verified
                </h1>
                <div data-testid="verify-success-status" role="status" aria-live="polite" style={{ marginTop: 16, marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.4)", color: "#6EE7B7", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                  {message}
                </div>
                <Link
                  href="/auth/signin"
                  className="ve-link"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, width: "100%", borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none", boxSizing: "border-box" }}
                >
                  Sign in now
                </Link>
              </div>
            )}

            {status === "error" && (
              <div data-testid="verify-error">
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>
                  Verification unsuccessful
                </h1>
                <div data-testid="verify-error-alert" role="alert" style={{ marginTop: 16, marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
                  {message || "Verification failed."}
                </div>

                {resendBlock}

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
                  {!normalizedEmail && (
                    <Link
                      href="/auth/register"
                      className="ve-link"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 15, color: "#fff", backgroundColor: "#3891A6", textDecoration: "none" }}
                    >
                      Back to registration
                    </Link>
                  )}
                  <Link href="/auth/signin" className="ve-link" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none", padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44 }}>
                    Go to sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {prelaunchRewards && (
        <PrelaunchRewardModal
          xp={prelaunchRewards.xp}
          points={prelaunchRewards.points}
          solves={prelaunchRewards.solves}
          onDismiss={() => {
            setPrelaunchRewards(null);
            router.push("/auth/signin");
          }}
        />
      )}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", backgroundColor: "#020202", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
          <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <style>{`@keyframes ve-fallback-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .ve-fallback-spinner { animation-duration: 2.4s; } }`}</style>
            <div
              aria-hidden="true"
              className="ve-fallback-spinner"
              style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(56,145,166,0.25)", borderTopColor: "#3891A6", animation: "ve-fallback-spin 0.8s linear infinite" }}
            />
            <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
              Loading…
            </span>
          </div>
        </main>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
