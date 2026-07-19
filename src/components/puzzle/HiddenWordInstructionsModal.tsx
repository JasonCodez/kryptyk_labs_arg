"use client";

import { useEffect, useRef } from "react";

export interface HiddenWordInstructionsModalProps {
  wordLength: number;
  maxGuesses: number;
  onClose: () => void;
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "0 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                flexShrink: 0,
                background: "var(--pw-success)",
                border: "1px solid var(--pw-success-border)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--pw-text-secondary)" }}>
              <strong style={{ color: "var(--pw-text-primary)" }}>CORRECT</strong> — Right letter, right position
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                flexShrink: 0,
                background: "transparent",
                border: "2px solid var(--pw-info)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--pw-text-secondary)" }}>
              <strong style={{ color: "var(--pw-text-primary)" }}>CLOSE</strong> — Letter exists, wrong position
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                flexShrink: 0,
                background: "var(--pw-surface-1)",
                border: "1px solid var(--pw-border-default)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--pw-text-secondary)" }}>
              <strong style={{ color: "var(--pw-text-primary)" }}>COLD</strong> — Letter is not in the word
            </span>
          </div>
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
