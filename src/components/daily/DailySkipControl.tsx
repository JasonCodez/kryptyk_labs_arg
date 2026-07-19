"use client";

import GameButton from "@/components/game-ui/GameButton";

export interface DailySkipControlProps {
  /** Remaining skip tokens; the control renders nothing below one. */
  tokens: number;
  /** True while a skip request is in flight. */
  skipping: boolean;
  onSkip: () => void;
  /** Shorter label for tight layouts (e.g. the fullscreen frame toolbar). */
  compact?: boolean;
}

/** Decorative ticket emblem for the skip action. */
function IconTicket({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 8.5A2.5 2.5 0 0 0 6.5 6h11A2.5 2.5 0 0 0 20 8.5v1a2 2 0 0 0 0 4v1a2.5 2.5 0 0 0-2.5 2.5h-11A2.5 2.5 0 0 0 4 14.5v-1a2 2 0 0 0 0-4v-1Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 7v10" stroke={color} strokeWidth="1.6" strokeDasharray="2.2 2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Reusable Skip control for the Daily Hidden Word puzzle. Presentational
 * only — the page owns the skip token count, in-flight state, and API call.
 */
export default function DailySkipControl({ tokens, skipping, onSkip, compact = false }: DailySkipControlProps) {
  if (tokens < 1) return null;

  const label = skipping ? "Skipping…" : compact ? "Skip" : "Skip Today";
  const tokenText = `${tokens} token${tokens !== 1 ? "s" : ""}`;

  return (
    <GameButton
      type="button"
      variant="secondary"
      size="sm"
      onClick={onSkip}
      disabled={skipping}
      icon={<IconTicket color="currentColor" />}
      style={{
        // Restrained info tone instead of the loud reward-gold "secondary"
        // fill — a skip token isn't an earned reward.
        ["--btn-light" as string]: "var(--pw-info)",
        ["--btn-mid" as string]: "color-mix(in srgb, var(--pw-info) 55%, var(--pw-surface-2))",
        ["--btn-dark" as string]: "color-mix(in srgb, var(--pw-info) 30%, #000)",
        ["--btn-mid-hover" as string]: "color-mix(in srgb, var(--pw-info) 65%, var(--pw-surface-2))",
        ["--btn-mid-pressed" as string]: "color-mix(in srgb, var(--pw-info) 40%, #000)",
        ["--btn-edge" as string]: "var(--pw-info-border)",
        ["--btn-ink" as string]: "var(--pw-text-on-info)",
      }}
    >
      <span className="flex flex-col items-start leading-tight normal-case">
        <span>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{tokenText}</span>
      </span>
    </GameButton>
  );
}
