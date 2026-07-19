"use client";

function IconClock() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPieces() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 4h4a1 1 0 0 1 1 1v2.2a1.8 1.8 0 1 0 0 3.6V13a1 1 0 0 1-1 1h-2.2a1.8 1.8 0 1 1-3.6 0H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h2.2A1.8 1.8 0 1 0 9 4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconGroups() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="12" cy="17" r="3" />
      <path d="M9.2 8.6 10.5 15M14.8 8.6 13.5 15M9.6 6.2h4.8" strokeLinecap="round" />
    </svg>
  );
}

export type JigsawStatusHudProps = {
  elapsedLabel: string;
  placedCount: number;
  totalCount: number;
  groupCount: number;
};

export default function JigsawStatusHud({ elapsedLabel, placedCount, totalCount, groupCount }: JigsawStatusHudProps) {
  const safeTotal = totalCount > 0 ? totalCount : 0;
  const safePlaced = Math.max(0, Math.min(placedCount, safeTotal));
  const percent = safeTotal <= 0 ? 0 : Math.max(0, Math.min(100, (safePlaced / safeTotal) * 100));

  return (
    <div className="jigsaw-status-hud" aria-label="Jigsaw status">
      <div className="jigsaw-status-items">
        <div className="jigsaw-status-item">
          <span className="jigsaw-status-icon"><IconClock /></span>
          <span className="jigsaw-status-copy">
            <span className="jigsaw-status-label">TIME</span>
            <span className="jigsaw-status-value">{elapsedLabel}</span>
          </span>
        </div>
        <div className="jigsaw-status-item">
          <span className="jigsaw-status-icon"><IconPieces /></span>
          <span className="jigsaw-status-copy">
            <span className="jigsaw-status-label">PIECES</span>
            <span className="jigsaw-status-value">{placedCount}/{totalCount} placed</span>
          </span>
        </div>
        {groupCount > 1 && (
          <div className="jigsaw-status-item">
            <span className="jigsaw-status-icon"><IconGroups /></span>
            <span className="jigsaw-status-copy">
              <span className="jigsaw-status-label">GROUPS</span>
              <span className="jigsaw-status-value">{groupCount}</span>
            </span>
          </div>
        )}
      </div>
      <div
        className="jigsaw-status-progress"
        role="progressbar"
        aria-label="Puzzle completion progress"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safePlaced}
      >
        <div className="jigsaw-status-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
