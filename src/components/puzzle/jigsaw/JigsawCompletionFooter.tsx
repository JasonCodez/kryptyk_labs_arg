"use client";

import { useRef } from "react";

export type JigsawCompletionFooterProps = {
  continuing: boolean;
  onContinue: () => void;
};

export default function JigsawCompletionFooter({ continuing, onContinue }: JigsawCompletionFooterProps) {
  // Closes the gap between a click and the parent's `continuing` prop actually re-rendering
  // (which isn't synchronous) — without this, two rapid clicks/taps/Enter presses before that
  // re-render lands could both call onContinue.
  const firedRef = useRef(false);

  const handleContinueClick = () => {
    if (continuing || firedRef.current) return;
    firedRef.current = true;
    onContinue();
  };

  return (
    <section className="jigsaw-completion-footer" aria-label="Jigsaw completion actions">
      <h2 className="jigsaw-completion-footer-title">Puzzle complete</h2>
      <p className="jigsaw-completion-footer-support">Your finished puzzle is ready.</p>
      <button
        type="button"
        className="jigsaw-completion-footer-button"
        onClick={handleContinueClick}
        disabled={continuing}
      >
        {continuing ? "Continuing…" : "Continue"}
      </button>
    </section>
  );
}
