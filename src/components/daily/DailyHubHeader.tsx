"use client";

export interface DailyHubHeaderProps {
  /** Formatted HH:MM:SS until the next daily reset, owned by the page. */
  countdown: string;
}

/** Decorative clock emblem for the reset timer. */
function IconClock({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Compact command-panel header for the Daily hub — replaces the old centered
 * hero title block. Presentational only; the countdown ticks in the page.
 */
export default function DailyHubHeader({ countdown }: DailyHubHeaderProps) {
  return (
    <header
      className="pw-bevel w-full max-w-5xl mt-6 mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left"
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
          Daily Arena
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

      {/* Reset timer — gold is reserved for the daily reset/reward role. */}
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
          <IconClock color="var(--pw-gold)" />
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
            className="font-mono"
            style={{ display: "block", fontSize: 15, fontWeight: 800, color: "var(--pw-gold)" }}
          >
            {countdown}
          </span>
        </span>
      </div>
    </header>
  );
}
