"use client";

import { useEffect, useRef } from "react";
import { HIDDEN_WORD_RESULT_VISUALS, type HiddenWordResultVisual } from "@/lib/hiddenWordVisuals";

export interface HiddenWordInstructionsModalProps {
  wordLength: number;
  maxGuesses: number;
  onClose: () => void;
}

/** Miniature version of the real game tile, plus its readable label/description. */
function LegendRow({
  testId,
  letter,
  visual,
  label,
  description,
}: {
  testId: string;
  letter: string;
  visual: HiddenWordResultVisual;
  label: string;
  description: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        aria-hidden="true"
        data-testid={`hw-legend-tile-${testId}`}
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 8,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 18,
          background: visual.background,
          border: `2px solid ${visual.border}`,
          color: visual.text,
        }}
      >
        {letter}
        {visual.marker === "filled" && (
          <span
            aria-hidden="true"
            data-testid={`hw-legend-marker-${testId}`}
            data-marker="filled"
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: visual.text,
            }}
          />
        )}
        {visual.marker === "ring" && (
          <span
            aria-hidden="true"
            data-testid={`hw-legend-marker-${testId}`}
            data-marker="ring"
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "transparent",
              border: `1.5px solid ${visual.text}`,
            }}
          />
        )}
      </div>
      <span style={{ fontSize: 12, color: "var(--pw-text-secondary)" }}>
        <strong style={{ color: "var(--pw-text-primary)" }}>{label}</strong> — {description}
      </span>
    </div>
  );
}

/**
 * Compact mobile-first mission briefing shown before a Hidden Word round starts.
 * Replaces the legacy "HOW TO PLAY" modal — same content, canonical PuzzleWarz tokens.
 */
export default function HiddenWordInstructionsModal({
  wordLength,
  maxGuesses,
  onClose,
}: HiddenWordInstructionsModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    primaryButtonRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: "rgba(6,10,20,0.85)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hidden-word-briefing-heading"
        className="w-full max-w-sm"
        style={{
          background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
          border: "1px solid var(--pw-border-default)",
          borderRadius: 16,
          padding: "18px 18px 16px",
          maxHeight: "calc(100vh - 24px)",
          overflowY: "auto",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--pw-brand-accent)",
            margin: "0 0 6px",
          }}
        >
          Hidden Word // Briefing
        </p>
        <h2
          id="hidden-word-briefing-heading"
          style={{ fontSize: 20, fontWeight: 900, color: "var(--pw-brand-primary)", margin: "0 0 8px" }}
        >
          Find the hidden word
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: "0 0 14px" }}>
          You have {maxGuesses} attempts to identify today&rsquo;s {wordLength}-letter word.
        </p>

        <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li style={{ fontSize: 13, lineHeight: 1.4, color: "var(--pw-text-primary)" }}>
            Enter a valid word and submit it.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.4, color: "var(--pw-text-primary)" }}>
            Each tile reveals how close your guess is.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.4, color: "var(--pw-text-primary)" }}>
            Solve in fewer attempts for a stronger grade.
          </li>
        </ul>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "0 0 16px" }}>
          <LegendRow
            testId="correct"
            letter="C"
            visual={HIDDEN_WORD_RESULT_VISUALS.correct}
            label="CORRECT"
            description="Right letter, right position"
          />
          <LegendRow
            testId="present"
            letter="P"
            visual={HIDDEN_WORD_RESULT_VISUALS.present}
            label="CLOSE"
            description="Letter exists, wrong position"
          />
          <LegendRow
            testId="absent"
            letter="X"
            visual={HIDDEN_WORD_RESULT_VISUALS.absent}
            label="COLD"
            description="Letter is not in the word"
          />
        </div>

        <button
          ref={primaryButtonRef}
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.02em",
            background: "var(--pw-brand-primary)",
            color: "var(--pw-bg-base)",
            border: "none",
          }}
        >
          Start Solving
        </button>
      </div>
    </div>
  );
}
