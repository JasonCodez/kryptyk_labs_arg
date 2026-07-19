"use client";

import { useRef } from "react";
import JigsawDialogFrame from "./JigsawDialogFrame";

function StepEmblem({ number }: { number: number }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text x="11" y="15" textAnchor="middle" fontSize="10" fontWeight="800" fill="currentColor">{number}</text>
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPreview() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
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

const STEPS = [
  { kicker: "BROWSE", title: "Find a piece", copy: "Swipe sideways across the tray to browse the remaining pieces." },
  { kicker: "PLACE", title: "Drag it onto the board", copy: "Drag a piece upward from the tray, then move it into position on the board." },
  { kicker: "CONNECT", title: "Build matching groups", copy: "Neighboring pieces connect automatically. Connected pieces move together as one group." },
];

const TOOLS = [
  { title: "Fullscreen", copy: "Gives you more room while keeping the full board visible.", Icon: IconFullscreen },
  { title: "Preview Image", copy: "Shows the completed picture for reference.", Icon: IconPreview },
  { title: "Return Loose Pieces", copy: "Sends unconnected pieces back to the tray.", Icon: IconReturn },
  { title: "Reset Puzzle", copy: "Starts the puzzle over.", Icon: IconReset },
];

export default function JigsawHelpDialog({ onClose }: { onClose: () => void }) {
  const startBuildingRef = useRef<HTMLButtonElement>(null);
  return (
    <JigsawDialogFrame title="How to play Jigsaw" onClose={onClose} safestActionRef={startBuildingRef}>
      <div className="jigsaw-help">
        <div className="jigsaw-help-intro">
          <span className="jigsaw-help-eyebrow">JIGSAW // BRIEFING</span>
          <h3 className="jigsaw-help-heading">Rebuild the image</h3>
          <p className="jigsaw-help-lead">Browse the tray, place matching pieces, and assemble the complete picture.</p>
        </div>

        <ol className="jigsaw-help-steps">
          {STEPS.map((step, index) => (
            <li key={step.kicker} className="jigsaw-help-step">
              <StepEmblem number={index + 1} />
              <span className="jigsaw-help-step-body">
                <span className="jigsaw-help-step-kicker">{step.kicker}</span>
                <span className="jigsaw-help-step-title">{step.title}</span>
                <span className="jigsaw-help-step-copy">{step.copy}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="jigsaw-help-section">
          <span className="jigsaw-help-section-title">PUZZLE TOOLS</span>
          <ul className="jigsaw-help-tools">
            {TOOLS.map((tool) => (
              <li key={tool.title} className="jigsaw-help-tool">
                <tool.Icon />
                <span className="jigsaw-help-tool-body">
                  <span className="jigsaw-help-tool-title">{tool.title}</span>
                  <span className="jigsaw-help-tool-copy">{tool.copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="jigsaw-help-section">
          <span className="jigsaw-help-section-title">KEYBOARD</span>
          <p className="jigsaw-help-keys-copy">
            Enter selects a tray group. Arrow keys move it. Enter tries a snap. T returns it to the tray. P opens Preview.
          </p>
        </div>

        <button type="button" ref={startBuildingRef} className="jigsaw-help-primary" onClick={onClose}>
          Start Building
        </button>
      </div>
    </JigsawDialogFrame>
  );
}
