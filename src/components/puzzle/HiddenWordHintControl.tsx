"use client";

import Link from "next/link";

export interface HiddenWordHintControlProps {
  tokens: number;
  loading: boolean;
  used: boolean;
  revealedPosition?: number;
  revealedLetter?: string;
  onReveal: () => void;
}

/** Decorative letter/lightbulb emblem for the hint control. */
function IconHintLetter({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5a5.5 5.5 0 0 0-3.2 9.98c.55.4.87 1.02.87 1.68V16h4.66v-.84c0-.66.32-1.28.87-1.68A5.5 5.5 0 0 0 12 3.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.8 19h4.4M10.4 20.5h3.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Compact utility control for the Hidden Word letter-reveal hint.
 * Presentational only — the puzzle owns hint state, cost, and the API call.
 */
export default function HiddenWordHintControl({
  tokens,
  loading,
  used,
  revealedPosition,
  revealedLetter,
  onReveal,
}: HiddenWordHintControlProps) {
  if (used) {
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm" style={{ color: "var(--pw-text-primary)" }}>
          Position <span className="font-bold">{(revealedPosition ?? 0) + 1}</span> is{" "}
          <span className="font-bold text-lg">{revealedLetter}</span>
        </p>
        <p className="text-xs" style={{ color: "var(--pw-text-secondary)" }}>Hint used</p>
      </div>
    );
  }

  if (tokens < 1) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold cursor-not-allowed"
          style={{
            minHeight: 44,
            color: "var(--pw-text-secondary)",
            border: "1px solid var(--pw-border-default)",
            background: "color-mix(in srgb, var(--pw-surface-2) 82%, transparent)",
          }}
        >
          <IconHintLetter color="var(--pw-text-secondary)" />
          No Hint Tokens
        </button>
        <Link
          href="/store"
          className="text-xs font-semibold underline transition-opacity hover:opacity-80"
          style={{ color: "var(--pw-info)" }}
        >
          Get Hint Tokens
        </Link>
      </div>
    );
  }

  const label = loading ? "Revealing…" : "Reveal a Letter";
  const tokenText = `${tokens} token${tokens !== 1 ? "s" : ""}`;

  return (
    <button
      type="button"
      onClick={onReveal}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold transition-opacity active:opacity-70 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        minHeight: 44,
        color: "var(--pw-text-primary)",
        border: "1px solid var(--pw-info-border)",
        background: "color-mix(in srgb, var(--pw-info) 12%, transparent)",
      }}
    >
      <IconHintLetter color="var(--pw-info)" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pw-text-secondary)" }}>{tokenText}</span>
      </span>
    </button>
  );
}
