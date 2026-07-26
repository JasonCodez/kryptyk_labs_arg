"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const FALLBACK_SAVE_ERROR = "Display name could not be saved. Please try again.";
const REFRESH_ERROR = "Your name was saved, but your session could not be refreshed. Please try again.";

export default function CompleteProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  // Tracks whether the current displayName value has already been persisted
  // to the database, so a retry after a failed session refresh only retries
  // the refresh — it never re-submits the same name a second time.
  const savedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasValidName = typeof session?.user?.name === "string" && session.user.name.trim().length > 0;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    } else if (status === "authenticated" && hasValidName) {
      router.replace("/dashboard");
    }
  }, [status, hasValidName, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;

    const trimmed = displayName.trim();
    if (!savedRef.current && trimmed.length === 0) {
      setError("Enter a display name.");
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      if (!savedRef.current) {
        const response = await fetch("/api/user/update-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });

        let body: { success?: boolean; error?: string } | null = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (!mountedRef.current) return;

        if (!response.ok || !body?.success) {
          setError(typeof body?.error === "string" ? body.error : FALLBACK_SAVE_ERROR);
          return;
        }

        savedRef.current = true;
      }

      // Deliberately called with no arguments: the JWT callback reloads the
      // trusted name from Prisma itself rather than trusting anything this
      // client passes to update().
      const refreshed = await update();
      if (!mountedRef.current) return;

      const refreshedName = refreshed?.user?.name;
      if (typeof refreshedName === "string" && refreshedName.trim().length > 0) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setError(REFRESH_ERROR);
    } catch {
      if (!mountedRef.current) return;
      setError(savedRef.current ? REFRESH_ERROR : FALLBACK_SAVE_ERROR);
    } finally {
      if (mountedRef.current) setSubmitting(false);
      inFlightRef.current = false;
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: "/auth/signin" });
    } catch {
      if (mountedRef.current) setSigningOut(false);
    }
  }

  if (status !== "authenticated" || hasValidName) {
    return <main style={{ minHeight: "100vh", backgroundColor: "#020202" }} />;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#020202",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(56,145,166,0.25)",
            borderRadius: 20,
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Choose your display name
          </h1>
          <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 24 }}>
            Other players will see this name. Your email address stays private.
          </p>

          {error && (
            <div
              id="complete-profile-error-text"
              role="alert"
              data-testid="complete-profile-error"
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                htmlFor="display-name"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9CA3AF",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Display name
              </label>
              <input
                id="display-name"
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  savedRef.current = false;
                }}
                placeholder="3-16 letters and numbers"
                autoComplete="off"
                aria-describedby={error ? "complete-profile-error-text" : undefined}
                aria-invalid={Boolean(error)}
                disabled={submitting}
                data-testid="complete-profile-name-input"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(56,145,166,0.3)",
                  borderRadius: 10,
                  color: "#fff",
                  padding: "12px 16px",
                  width: "100%",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="complete-profile-submit"
              style={{
                minHeight: 44,
                padding: "13px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                color: "#fff",
                backgroundColor: "#3891A6",
                border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Saving…" : "Save and continue"}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              data-testid="complete-profile-sign-out"
              style={{
                minHeight: 44,
                padding: "8px 16px",
                background: "transparent",
                border: "none",
                color: "#6B7280",
                fontSize: 13,
                cursor: signingOut ? "not-allowed" : "pointer",
              }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
