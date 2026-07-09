"use client";

import { useState } from "react";
import BugReportModal from "./BugReportModal";

interface PuzzleBugReportButtonProps {
  puzzleId: string;
  puzzleTitle: string;
  // Positioning/layout override for the trigger button — callers embed this in different
  // toolbars (PuzzleFullscreenFrame's toggle row, jigsaw's own fullscreen/non-fullscreen
  // controls), each with its own layout needs.
  style?: React.CSSProperties;
  // If provided, replaces the default inline-styled look entirely — used by call sites that
  // already style their sibling buttons via Tailwind classes (e.g. jigsaw's toolbar) so this
  // button matches them instead of looking like a one-off.
  className?: string;
  label?: string;
}

const DEFAULT_STYLE: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "rgba(10,20,40,0.9)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.2)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

export default function PuzzleBugReportButton({
  puzzleId,
  puzzleTitle,
  style,
  className,
  label = "🐞 Report Bug",
}: PuzzleBugReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {className ? (
        <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
          {label}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ ...DEFAULT_STYLE, ...style }}>
          {label}
        </button>
      )}
      {open && (
        <BugReportModal puzzleId={puzzleId} puzzleTitle={puzzleTitle} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
