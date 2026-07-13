"use client";

import type { ReactNode } from "react";

interface PuzzleFullscreenFrameProps {
  children: ReactNode;
  // Fullscreen mode was removed (the puzzle page is now sized for the full mobile viewport by
  // default, so a separate focus mode no longer adds anything). These props are accepted so the
  // ~19 call sites across PuzzleTypeRenderer/page.tsx don't all need editing, but nothing here
  // is rendered from them anymore — skip-token and report-a-bug controls live in their normal
  // in-page spots instead of needing a floating fallback.
  extraControls?: ReactNode;
  puzzleId?: string;
  puzzleTitle?: string;
}

export default function PuzzleFullscreenFrame({ children }: PuzzleFullscreenFrameProps) {
  return <>{children}</>;
}
