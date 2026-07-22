"use client";

import { Clock3 } from "lucide-react";

export interface DailyHubHeaderProps {
  /** Formatted HH:MM:SS until the next daily reset, owned by the page. */
  countdown: string;
  /** Accessible-label equivalent of the countdown, e.g. "7 hours, 41 minutes, and 9 seconds". Owned by the page so both stay in sync. */
  countdownLabel: string;
}

/**
 * Compact command-panel header for the Daily hub. Presentational only; the
 * countdown value and its accessible label both tick in the page.
 */
export default function DailyHubHeader({ countdown, countdownLabel }: DailyHubHeaderProps) {
  return (
    <header
      className="pw-bevel w-full max-w-5xl mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left"
      style={{
        padding: "16px 18px",
        borderRadius: 16,
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 30%, var(--pw-border-default))",
      }}
    >
      <div className="min-w-0">
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--pw-brand-accent)",
            margin: "0 0 4px",
          }}
        >
          DAILY ARENA
        </p>
        <h1
          className="text-[17px] leading-[1.25] sm:text-2xl"
          style={{ fontWeight: 900, color: "var(--pw-brand-primary)", margin: "0 0 4px" }}
        >
          Today&rsquo;s Puzzle Lineup
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: 0, maxWidth: 460 }}>
          Six fresh challenges reset every day. Choose one and keep your streak alive.
        </p>
      </div>

      {/* Reset timer — gold is reserved for the daily reset/reward role. The
          visible HH:MM:SS ticks every second, but that's a poor screen-reader
          experience, so the live value stays out of any live region and an
          accessible label describes it in words instead. */}
      <div
        className="flex items-center gap-2.5 self-start sm:self-center shrink-0"
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "color-mix(in srgb, var(--pw-gold) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pw-gold) 40%, transparent)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            flexShrink: 0,
            background: "color-mix(in srgb, var(--pw-gold) 16%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pw-gold) 40%, transparent)",
          }}
        >
          <Clock3 aria-hidden="true" focusable="false" size={16} color="var(--pw-gold)" />
        </span>
        <span>
          <span
            style={{
              display: "block",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--pw-text-muted)",
            }}
          >
            Next Reset
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ display: "block", fontSize: 15, fontWeight: 800, color: "var(--pw-gold)" }}
            aria-live="off"
            aria-label={`Next daily reset in ${countdownLabel}`}
          >
            {countdown}
          </span>
        </span>
      </div>
    </header>
  );
}
