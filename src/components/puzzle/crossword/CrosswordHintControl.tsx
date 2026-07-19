"use client";

import Link from "next/link";

export interface CrosswordHintControlProps {
  tokens: number;
  loading: boolean;
  canReveal: boolean;
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

const buttonBaseClass =
  "inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold transition-opacity";

/**
 * Compact utility control for the Crossword letter-reveal hint.
 * Presentational only — CrosswordPuzzle owns hint state, cost, and the API call.
 */
export default function CrosswordHintControl({ tokens, loading, canReveal, onReveal }: CrosswordHintControlProps) {
  if (tokens < 1) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          className={`${buttonBaseClass} cursor-not-allowed`}
          style={{
            minHeight: 44,
            color: "var(--pw-text-secondary)",
            border: "1px solid var(--pw-border-default)",
            background: "var(--pw-surface-2)",
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

  const disabled = loading || !canReveal;
  const label = loading ? "Revealing…" : "Reveal Letter";
  const supportingText = loading ? "" : canReveal ? `${tokens} token${tokens !== 1 ? "s" : ""}` : "Select a square first";

  return (
    <button
      type="button"
      onClick={onReveal}
      disabled={disabled}
      className={`${buttonBaseClass} active:opacity-70 disabled:cursor-not-allowed`}
      style={{
        minHeight: 44,
        color: "var(--pw-text-primary)",
        border: `1px solid ${canReveal && !loading ? "var(--pw-info-border)" : "var(--pw-border-default)"}`,
        background: canReveal && !loading ? "color-mix(in srgb, var(--pw-info) 12%, var(--pw-surface-2))" : "var(--pw-surface-2)",
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <IconHintLetter color="var(--pw-info)" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        {supportingText && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pw-text-secondary)" }}>{supportingText}</span>
        )}
      </span>
    </button>
  );
}
