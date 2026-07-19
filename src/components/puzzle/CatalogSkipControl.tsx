"use client";

import Link from "next/link";

export interface CatalogSkipControlProps {
  /** Remaining skip tokens for this puzzle. */
  tokens: number;
  /** True while a skip request is in flight. */
  skipping: boolean;
  onSkip: () => void;
  /**
   * Forwarded through to the root element. When this control is placed inside
   * PuzzleHeaderOverflowMenu, the menu clones its children to inject these —
   * without forwarding them the control silently drops out of the menu's
   * role="menuitem" semantics and arrow-key/Home/End navigation.
   */
  className?: string;
  role?: string;
  tabIndex?: number;
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
 * Deliberately quiet: this is a utility action, not a reward/premium CTA.
 */
export default function CatalogSkipControl({ tokens, skipping, onSkip, className, role, tabIndex }: CatalogSkipControlProps) {
  if (tokens < 1) {
    return (
      <Link
        href="/store"
        role={role}
        tabIndex={tabIndex}
        className={`inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold${className ? ` ${className}` : ""}`}
        style={{
          minHeight: 44,
          color: "var(--pw-text-primary)",
          border: "1px solid var(--pw-border-default)",
          background: "color-mix(in srgb, var(--pw-surface-2) 82%, transparent)",
        }}
      >
        <IconSkipForward color="var(--pw-text-secondary)" />
        Get Skip Tokens
      </Link>
    );
  }

  const label = skipping ? "Skipping…" : "Skip Puzzle";
  const tokenText = `${tokens} token${tokens !== 1 ? "s" : ""}`;

  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={skipping}
      role={role}
      tabIndex={tabIndex}
      className={`inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold transition-opacity active:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed${className ? ` ${className}` : ""}`}
      style={{
        minHeight: 44,
        color: "var(--pw-text-primary)",
        border: "1px solid var(--pw-border-default)",
        background: "color-mix(in srgb, var(--pw-surface-2) 82%, transparent)",
      }}
    >
      <IconSkipForward color="var(--pw-text-secondary)" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pw-text-secondary)" }}>{tokenText}</span>
      </span>
    </button>
  );
}
