"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface PuzzleHeaderProps {
  /** Where the back button navigates (e.g. "/daily"). */
  backHref: string;
  title: string;
  /** Optional secondary line — day number, category, etc. */
  subtitle?: ReactNode;
  /** Optional timer / progress element rendered before the right-side actions. */
  progress?: ReactNode;
  /** Optional right-side actions (streak pill, menu, etc.). */
  actions?: ReactNode;
  /** Optional click handler for the back control (still navigates via backHref). */
  onBack?: () => void;
}

/**
 * Compact top bar for the full-screen puzzle play shell. Replaces the global
 * navbar during gameplay on mobile. Provides a 48px back target, safe-area
 * inset, and slots for a subtitle, timer/progress, and right-side actions.
 */
export default function PuzzleHeader({
  backHref,
  title,
  subtitle,
  progress,
  actions,
  onBack,
}: PuzzleHeaderProps) {
  return (
    <header className="pw-play-header">
      <Link
        href={backHref}
        onClick={onBack}
        aria-label="Back"
        className="pw-play-header-back pw-press"
        data-testid="puzzle-header-back"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <div className="pw-play-header-titles">
        <span className="pw-play-header-title" data-testid="puzzle-header-title">{title}</span>
        {subtitle != null && subtitle !== "" && (
          <span className="pw-play-header-subtitle" data-testid="puzzle-header-subtitle">{subtitle}</span>
        )}
      </div>

      {progress && (
        <div className="pw-play-header-progress" data-testid="puzzle-header-progress">
          {progress}
        </div>
      )}
      {actions && (
        <div className="pw-play-header-actions" data-testid="puzzle-header-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
