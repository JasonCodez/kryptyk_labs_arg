"use client";

interface JigsawMobileCoachProps {
  onFullscreen: () => void;
  onDismiss: () => void;
}

function IconInfo() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export default function JigsawMobileCoach({ onFullscreen, onDismiss }: JigsawMobileCoachProps) {
  return (
    <div className="jigsaw-mobile-coach">
      <IconInfo />
      <div className="jigsaw-mobile-coach-copy">
        <span className="jigsaw-mobile-coach-eyebrow">QUICK TIP</span>
        <span className="jigsaw-mobile-coach-text">Swipe the tray, then drag a piece onto the board.</span>
      </div>
      <button type="button" className="jigsaw-mobile-coach-fullscreen" onClick={onFullscreen}>
        <IconExpand />
        Fullscreen
      </button>
      <button type="button" className="jigsaw-mobile-coach-dismiss" onClick={onDismiss} aria-label="Dismiss jigsaw tip">
        <IconClose />
      </button>
    </div>
  );
}
