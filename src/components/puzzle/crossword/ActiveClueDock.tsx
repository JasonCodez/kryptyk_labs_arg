"use client";

import Pressable from "@/components/juice/Pressable";
import type { CrosswordPresentationState } from "@/components/puzzle/CrosswordPuzzle";

interface ActiveClueDockProps {
  activeClue: CrosswordPresentationState["activeClue"];
  canSwitchDirection: boolean;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSwitchDirection: () => void;
  onOpenClues: () => void;
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

export default function ActiveClueDock({
  activeClue,
  canSwitchDirection,
  disabled = false,
  onPrevious,
  onNext,
  onSwitchDirection,
  onOpenClues,
}: ActiveClueDockProps) {
  return (
    <section className="crossword-active-dock" aria-label="Active crossword clue">
      <Pressable
        type="button"
        className="crossword-dock-button"
        onClick={onPrevious}
        disabled={disabled || !activeClue}
        aria-label="Previous clue"
        title="Previous clue"
      >
        <ArrowIcon direction="left" />
      </Pressable>

      <div className="crossword-active-dock-copy" aria-live="polite" aria-atomic="true">
        {activeClue ? (
          <>
            <div className="crossword-active-dock-label">
              {activeClue.number} {activeClue.direction}
            </div>
            <div className="crossword-active-dock-text">{activeClue.clueText}</div>
          </>
        ) : (
          <div className="crossword-active-dock-empty">Select a square to begin</div>
        )}
      </div>

      <Pressable
        type="button"
        className="crossword-dock-button"
        onClick={onSwitchDirection}
        disabled={disabled || !canSwitchDirection}
        aria-label="Switch between Across and Down"
        title="Switch direction"
      >
        <span aria-hidden className="crossword-direction-icon">A/D</span>
      </Pressable>

      <Pressable
        type="button"
        className="crossword-dock-button crossword-dock-clues-button"
        onClick={onOpenClues}
        disabled={disabled}
        aria-label="Open all clues"
      >
        <span aria-hidden>☰</span>
        <span className="crossword-dock-button-text">Clues</span>
      </Pressable>

      <Pressable
        type="button"
        className="crossword-dock-button"
        onClick={onNext}
        disabled={disabled || !activeClue}
        aria-label="Next clue"
        title="Next clue"
      >
        <ArrowIcon direction="right" />
      </Pressable>
    </section>
  );
}
