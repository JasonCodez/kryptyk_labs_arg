"use client";

import { useEffect, useRef, useState } from "react";
import GameButton from "@/components/game-ui/GameButton";

export interface DashboardInviteCardProps {
  inviteLink: string;
  signedUp: number;
}

const COPY_ERROR_MESSAGE = "Unable to copy automatically. Select the referral link and copy it manually.";
const HEADING_ID = "dashboard-invite-heading";
const INPUT_ID = "dashboard-invite-link";

/** Decorative invite emblem — replaces the chain-link emoji. */
function IconInvite({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.4" stroke={color} strokeWidth="1.6" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 8v6M15 11h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Compact Invite Friends card replacing the old inline referral widget.
 * Owns its own copy-to-clipboard state; never touches the inviteLink,
 * dashboard APIs, or navigation.
 */
export default function DashboardInviteCard({ inviteLink, signedUp }: DashboardInviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyError(null);
      setCopied(true);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(COPY_ERROR_MESSAGE);
    }
  };

  const bodyText =
    signedUp > 0
      ? `${signedUp} player${signedUp === 1 ? "" : "s"} ${signedUp === 1 ? "has" : "have"} joined through your invite.`
      : "Share PuzzleWarz with another solver. Every new player makes the competition stronger.";

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="pw-bevel mb-6 sm:mb-12"
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 30%, var(--pw-border-default))",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                flexShrink: 0,
                background: "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
              }}
            >
              <IconInvite color="var(--pw-brand-primary)" />
            </span>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--pw-brand-accent)",
                margin: 0,
              }}
            >
              Grow the Arena
            </p>
          </div>

          <h2 id={HEADING_ID} style={{ fontSize: 16, fontWeight: 900, color: "var(--pw-brand-primary)", margin: "0 0 4px" }}>
            Invite Friends
          </h2>

          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: signedUp > 0 ? "var(--pw-gold)" : "var(--pw-text-secondary)",
              margin: 0,
              maxWidth: 420,
            }}
          >
            {bodyText}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <input
            id={INPUT_ID}
            type="text"
            readOnly
            value={inviteLink}
            aria-label="Referral link"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full sm:w-64 min-w-0"
            style={{
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "var(--pw-text-primary)",
              background: "var(--pw-surface-1)",
              border: "1px solid var(--pw-border-default)",
              borderRadius: 8,
              padding: "9px 12px",
              minHeight: 44,
            }}
          />
          <GameButton
            variant={copied ? "success" : "secondary"}
            size="sm"
            onClick={handleCopy}
            className="w-full sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--pw-brand-secondary)" }}
          >
            {copied ? "Copied" : "Copy Invite Link"}
          </GameButton>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </p>

      {copyError && (
        <p role="alert" style={{ fontSize: 12, color: "var(--pw-error-text)", margin: "10px 0 0" }}>
          {copyError}
        </p>
      )}
    </section>
  );
}
