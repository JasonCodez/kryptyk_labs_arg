"use client";

function IconRotate() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M9 18h6" strokeLinecap="round" />
      <path d="M19 8a7 7 0 0 1-1.5 8.5" strokeLinecap="round" />
      <path d="M18.5 12.5 19.5 16.5 15.5 15.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Full-viewport blocking overlay shown on touch devices while the puzzle is in landscape
 * orientation. Jigsaw's board/tray layout is portrait-only — this replaces the old landscape
 * reflow with a simple instruction to rotate back, rather than trying to keep two layouts
 * (and their measurement/DPR math) in sync.
 */
export default function JigsawOrientationLock() {
  return (
    <div className="jigsaw-orientation-lock" role="alert">
      <IconRotate />
      <p className="jigsaw-orientation-lock-text">Rotate your device back to portrait mode to continue this puzzle.</p>
    </div>
  );
}
