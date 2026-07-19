"use client";

import { useRef } from "react";
import JigsawDialogFrame from "./JigsawDialogFrame";

function FullscreenIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m5 17 4.5-4.5 3 3 2-2L19 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.5A7 7 0 1 1 7 17" strokeLinecap="round" />
      <path d="M5 11 9 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5A8 8 0 1 1 6 18" strokeLinecap="round" />
    </svg>
  );
}

export default function JigsawHelpDialog({ onClose }: { onClose: () => void }) {
  const startButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <JigsawDialogFrame title="How to play Jigsaw" onClose={onClose} safestActionRef={startButtonRef}>
      <div className="jigsaw-help-content">
        <div className="jigsaw-help-intro">
          <p className="jigsaw-help-eyebrow">JIGSAW // BRIEFING</p>
          <h3 className="jigsaw-help-heading">Rebuild the image</h3>
          <p className="jigsaw-help-summary">Browse the tray, place matching pieces, and assemble the complete picture.</p>
        </div>

        <ol className="jigsaw-help-steps">
          <li className="jigsaw-help-step">
            <span className="jigsaw-help-step-number" aria-hidden="true">1</span>
            <div className="jigsaw-help-step-copy">
              <span className="jigsaw-help-step-label">BROWSE</span>
              <h4>Find a piece</h4>
              <p>Swipe sideways across the tray to browse the remaining pieces.</p>
            </div>
          </li>
          <li className="jigsaw-help-step">
            <span className="jigsaw-help-step-number" aria-hidden="true">2</span>
            <div className="jigsaw-help-step-copy">
              <span className="jigsaw-help-step-label">PLACE</span>
              <h4>Drag it onto the board</h4>
              <p>Drag a piece upward from the tray, then move it into position on the board.</p>
            </div>
          </li>
          <li className="jigsaw-help-step">
            <span className="jigsaw-help-step-number" aria-hidden="true">3</span>
            <div className="jigsaw-help-step-copy">
              <span className="jigsaw-help-step-label">CONNECT</span>
              <h4>Build matching groups</h4>
              <p>Neighboring pieces connect automatically. Connected pieces move together as one group.</p>
            </div>
          </li>
        </ol>

        <section className="jigsaw-help-section" aria-labelledby="jigsaw-help-tools-heading">
          <h3 id="jigsaw-help-tools-heading" className="jigsaw-help-section-title">Puzzle Tools</h3>
          <ul className="jigsaw-help-tools">
            <li>
              <span className="jigsaw-help-tool-icon"><FullscreenIcon /></span>
              <p><strong>Fullscreen</strong><span>Gives you more room while keeping the full board visible.</span></p>
            </li>
            <li>
              <span className="jigsaw-help-tool-icon"><PreviewIcon /></span>
              <p><strong>Preview Image</strong><span>Shows the completed picture for reference.</span></p>
            </li>
            <li>
              <span className="jigsaw-help-tool-icon"><ReturnIcon /></span>
              <p><strong>Return Loose Pieces</strong><span>Sends unconnected pieces back to the tray.</span></p>
            </li>
            <li>
              <span className="jigsaw-help-tool-icon"><ResetIcon /></span>
              <p><strong>Reset Puzzle</strong><span>Starts the puzzle over.</span></p>
            </li>
          </ul>
        </section>

        <section className="jigsaw-help-section" aria-labelledby="jigsaw-help-keyboard-heading">
          <h3 id="jigsaw-help-keyboard-heading" className="jigsaw-help-section-title">Keyboard</h3>
          <ul className="jigsaw-help-keyboard">
            <li><kbd>Enter</kbd><span>selects a tray group.</span></li>
            <li><kbd>Arrow keys</kbd><span>move it.</span></li>
            <li><kbd>Enter</kbd><span>tries a snap.</span></li>
            <li><kbd>T</kbd><span>returns it to the tray.</span></li>
            <li><kbd>P</kbd><span>opens Preview.</span></li>
          </ul>
        </section>

        <div className="jigsaw-help-actions">
          <button ref={startButtonRef} type="button" className="jigsaw-help-primary" onClick={onClose}>Start Building</button>
        </div>
      </div>
    </JigsawDialogFrame>
  );
}
