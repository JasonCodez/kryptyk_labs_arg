"use client";

import Link from "next/link";
import GameButton from "@/components/game-ui/GameButton";

export interface CatalogSkipControlProps {
  /** Remaining skip tokens for this puzzle. */
  tokens: number;
  /** True while a skip request is in flight. */
  skipping: boolean;
  onSkip: () => void;
}

/** Decorative skip/forward emblem. */
function IconSkipForward({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 6v12l9-6-9-6Z" fill={color} />
      <path d="M18 6v12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Reusable Skip control for the catalog puzzle detail page. Presentational
 * only — the page owns the skip token count, in-flight state, and API call.
 */
export default function CatalogSkipControl({ tokens, skipping, onSkip }: CatalogSkipControlProps) {
  if (tokens < 1) {
    return (
      <Link
        href="/store"
        className="inline-flex items-center justify-center gap-2 px-4 rounded-2xl text-sm font-extrabold uppercase tracking-wide"
        style={{
          minHeight: 44,
          color: "var(--pw-brand-secondary)",
          border: "1px solid color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent)",
          background: "color-mix(in srgb, var(--pw-brand-secondary) 10%, transparent)",
        }}
      >
        <IconSkipForward color="var(--pw-brand-secondary)" />
        Get Skip Tokens
      </Link>
    );
  }

  const label = skipping ? "Skipping…" : "Skip Puzzle";
  const tokenText = `${tokens} token${tokens !== 1 ? "s" : ""} available`;

  return (
    <GameButton
      type="button"
      variant="secondary"
      size="sm"
      onClick={onSkip}
      disabled={skipping}
      icon={<IconSkipForward color="currentColor" />}
    >
      <span className="flex flex-col items-start leading-tight normal-case">
        <span>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{tokenText}</span>
      </span>
    </GameButton>
  );
}
