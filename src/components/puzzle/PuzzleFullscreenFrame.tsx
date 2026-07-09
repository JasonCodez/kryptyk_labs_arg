"use client";

import { useEffect, useState, type ReactNode } from "react";
import PuzzleBugReportButton from "./PuzzleBugReportButton";

interface PuzzleFullscreenFrameProps {
  children: ReactNode;
  // Content that normally lives below the puzzle in the page (e.g. the skip-token button) and
  // would otherwise be hidden behind the fullscreen overlay once it covers the viewport. Shown
  // as a floating control, top-left, only while fullscreen is active.
  extraControls?: ReactNode;
  // When provided, renders a floating "Report a Bug" trigger pre-filled with this puzzle —
  // skips the hundreds-of-puzzles picker on /report-bug entirely.
  puzzleId?: string;
  puzzleTitle?: string;
}

// Generic fullscreen/focus-mode toggle for puzzle types that don't have their own (jigsaw and
// Blackout each already built their own bespoke fullscreen, wired in separately and left
// untouched). Deliberately does NOT use a portal to move `children` to document.body — a portal
// changes where `children` sits in the fiber tree, which makes React unmount and remount the
// wrapped puzzle on every toggle, wiping out any in-progress timer or game state inside it.
// Instead `children` always renders inside the exact same wrapper element, at the same position
// among siblings; only that wrapper's own CSS (static vs. fixed/inset-0) changes on toggle,
// which React can update in place with no remount.
export default function PuzzleFullscreenFrame({ children, extraControls, puzzleId, puzzleTitle }: PuzzleFullscreenFrameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: isFullscreen ? 0 : 10 }}>
        {isFullscreen && extraControls && (
          <div style={{ position: "fixed", top: 12, left: 12, zIndex: 12001 }}>
            {extraControls}
          </div>
        )}
        {/* Grouped together (rather than each independently fixed) so their fixed positioning
            moves as one unit — avoids hand-offsetting two buttons by pixel guesswork. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...(isFullscreen ? { position: "fixed", top: 12, right: 12, zIndex: 12001 } : {}),
          }}
        >
          {puzzleId && puzzleTitle && (
            <PuzzleBugReportButton puzzleId={puzzleId} puzzleTitle={puzzleTitle} />
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(10,20,40,0.9)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isFullscreen ? "✕ Exit Fullscreen" : "⤢ Fullscreen"}
          </button>
        </div>
      </div>
      <div
        style={
          isFullscreen
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 12000,
                background: "#020202",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
                padding: "56px 12px 20px",
                // Center the puzzle horizontally in the fullscreen viewport — without this,
                // puzzle boards narrower than the screen (Sudoku, Anagram Blitz, etc.) sit
                // pinned to the left edge with empty space on the right. Deliberately not
                // centering vertically too: with overflow:auto, justify-content:center on
                // content taller than the viewport makes the portion that overflows above
                // the fold unreachable by scrolling (scrollTop can't go negative), so tall
                // puzzles would get their top clipped off with no way to scroll up to it.
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
