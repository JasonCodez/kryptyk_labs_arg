"use client";

function IconEye() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4v.6" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconReturn() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h11a5 5 0 0 1 5 5v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M20 11A8 8 0 1 0 18 16" strokeLinecap="round" />
      <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconContract() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function JigsawControls({ canInteract, fullscreen, showUtilities = true, onPreview, onFullscreen, onExitFullscreen, onHelp, onReturn, onReset }: {
  canInteract: boolean;
  fullscreen: boolean;
  showUtilities?: boolean;
  onPreview: () => void;
  onFullscreen: () => void;
  onExitFullscreen: () => void;
  onHelp: () => void;
  onReturn: () => void;
  onReset: () => void;
}) {
  return <div className="jigsaw-controls" aria-label="Jigsaw controls">
    {showUtilities && <>
      <button
        type="button"
        className="jigsaw-control jigsaw-control--preview"
        aria-label="Preview image"
        disabled={!canInteract}
        onClick={onPreview}
      >
        <IconEye />
        <span className="jigsaw-control-label">Preview</span>
      </button>
      <button
        type="button"
        className="jigsaw-control jigsaw-control--help"
        aria-label="How to play"
        onClick={onHelp}
      >
        <IconHelp />
        <span className="jigsaw-control-label">Help</span>
      </button>
      <button
        type="button"
        className="jigsaw-control jigsaw-control--return"
        aria-label="Return loose pieces to tray"
        disabled={!canInteract}
        onClick={onReturn}
      >
        <IconReturn />
        <span className="jigsaw-control-label">Return</span>
      </button>
      <button
        type="button"
        className="jigsaw-control jigsaw-control--reset"
        aria-label="Reset puzzle"
        disabled={!canInteract}
        onClick={onReset}
      >
        <IconReset />
        <span className="jigsaw-control-label">Reset</span>
      </button>
      <button
        type="button"
        className={`jigsaw-control jigsaw-control--fullscreen${fullscreen ? " jigsaw-control--fullscreen-active" : ""}`}
        aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        onClick={fullscreen ? onExitFullscreen : onFullscreen}
      >
        {fullscreen ? <IconContract /> : <IconExpand />}
        <span className="jigsaw-control-label">{fullscreen ? "Exit" : "Fullscreen"}</span>
      </button>
    </>}
  </div>;
}
