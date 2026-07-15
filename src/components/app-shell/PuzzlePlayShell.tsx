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
  /** Extra class(es) for the scrollable content region. */
  contentClassName?: string;
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
      <div className={`pw-play-content${contentClassName ? ` ${contentClassName}` : ""}`}>
        {children}
      </div>
    </div>
  );
}
