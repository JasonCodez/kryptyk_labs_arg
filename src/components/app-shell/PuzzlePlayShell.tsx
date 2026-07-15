"use client";

import type { ReactNode } from "react";
import PuzzleHeader from "./PuzzleHeader";

interface PuzzlePlayShellProps {
  backHref: string;
  title: string;
  subtitle?: ReactNode;
  progress?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  /** Extra class(es) for the content region. */
  contentClassName?: string;
  /**
   * "scroll" (default) — the content region scrolls internally, for puzzles
   * whose content can exceed the viewport (text, images, forms).
   * "fixed" — overflow:hidden, children get the full remaining viewport with
   * no scroll. Use for puzzles that manage their own gestures/canvas and where
   * page scroll would fight drag interactions (e.g. Jigsaw).
   */
  contentMode?: "scroll" | "fixed";
}

/**
 * Full-screen mobile game shell for an active puzzle. On mobile (< 1032px) it
 * fills 100dvh with a fixed PuzzleHeader and an internally scrolling content
 * region, so the puzzle owns the whole viewport (the global browse chrome is
 * cleared by AppChrome in play mode). On desktop (>= 1032px) it flows under the
 * preserved global navbar instead of taking over the screen.
 */
export default function PuzzlePlayShell({
  backHref,
  title,
  subtitle,
  progress,
  actions,
  onBack,
  children,
  contentClassName,
  contentMode = "scroll",
}: PuzzlePlayShellProps) {
  return (
    <div className="pw-play-shell">
      <PuzzleHeader
        backHref={backHref}
        title={title}
        subtitle={subtitle}
        progress={progress}
        actions={actions}
        onBack={onBack}
      />
      <div
        className={`pw-play-content pw-play-content--${contentMode}${contentClassName ? ` ${contentClassName}` : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
