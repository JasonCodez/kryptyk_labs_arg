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
  role?: string;
  tabIndex?: number;
  // Icon-only 44x44 trigger for tight toolbars (e.g. the Hidden Word round-status bar) —
  // same modal, same accessible name, no visible "Report Bug" text.
  compact?: boolean;
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

const COMPACT_STYLE: React.CSSProperties = {
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--pw-surface-2) 82%, transparent)",
  border: "1px solid var(--pw-border-default)",
  color: "var(--pw-text-primary)",
  cursor: "pointer",
};

/** Decorative bug/report emblem for the compact trigger. */
function IconBug({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M9 8.5V7a3 3 0 0 1 6 0v1.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="7" y="8.5" width="10" height="9.5" rx="4" stroke={color} strokeWidth="1.6" />
      <path
        d="M7 12H4M20 12h-3M8 16.5l-2.5 2M18.5 18.5 16 16.5M8 9.5 5.5 7M18.5 7 16 9.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PuzzleBugReportButton({
  puzzleId,
  puzzleTitle,
  style,
  className,
  role,
  tabIndex,
  label = "🐞 Report Bug",
  compact = false,
}: PuzzleBugReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report Bug"
          style={{ ...COMPACT_STYLE, ...style }}
          role={role}
          tabIndex={tabIndex}
        >
          <IconBug color="var(--pw-text-primary)" />
        </button>
      ) : className ? (
        <button type="button" onClick={() => setOpen(true)} className={className} style={style} role={role} tabIndex={tabIndex}>
          {label}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ ...DEFAULT_STYLE, ...style }} role={role} tabIndex={tabIndex}>
          {label}
        </button>
      )}
      {open && (
        <BugReportModal puzzleId={puzzleId} puzzleTitle={puzzleTitle} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
