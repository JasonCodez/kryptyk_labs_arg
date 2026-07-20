"use client";

function IconPieceStack() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 4h4a1 1 0 0 1 1 1v2.2a1.8 1.8 0 1 0 0 3.6V13a1 1 0 0 1-1 1h-2.2a1.8 1.8 0 1 1-3.6 0H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h2.2A1.8 1.8 0 1 0 9 4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconEmptyTray() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M4 15h16M4 15l2.2-7a1 1 0 0 1 .96-.7h9.68a1 1 0 0 1 .96.7L20 15M4 15v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckPiece() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5 11 15l4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type JigsawTrayStatusProps = {
  remainingCount: number;
  isSolved: boolean;
};

export default function JigsawTrayStatus({ remainingCount, isSolved }: JigsawTrayStatusProps) {
  if (remainingCount > 0) {
    return (
      <div
        className="jigsaw-tray-status"
        aria-label={`${remainingCount} loose piece group${remainingCount === 1 ? "" : "s"} remaining`}
      >
        <span className="jigsaw-tray-status-icon"><IconPieceStack /></span>
        <span className="jigsaw-tray-status-copy">
          <span className="jigsaw-tray-status-label">LOOSE PIECES</span>
          <span className="jigsaw-tray-status-count">{remainingCount}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="jigsaw-tray-empty" aria-label={isSolved ? "Puzzle complete" : "All pieces are on the board"}>
      <span className="jigsaw-tray-empty-icon">{isSolved ? <IconCheckPiece /> : <IconEmptyTray />}</span>
      <span className="jigsaw-tray-empty-title">{isSolved ? "Puzzle complete!" : "All pieces are on the board"}</span>
      <span className="jigsaw-tray-empty-support">
        {isSolved ? "Every piece is in place." : "Drag a piece back here whenever you need more room."}
      </span>
    </div>
  );
}
