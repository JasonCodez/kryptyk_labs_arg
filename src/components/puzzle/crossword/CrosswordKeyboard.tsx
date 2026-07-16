"use client";

import Pressable from "@/components/juice/Pressable";
import { useReducedMotion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/juice";

interface CrosswordKeyboardProps {
  disabled?: boolean;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
}

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

export default function CrosswordKeyboard({
  disabled = false,
  onLetter,
  onBackspace,
}: CrosswordKeyboardProps) {
  const reduceMotion = Boolean(useReducedMotion() || prefersReducedMotion());
  return (
    <div
      className="crossword-keyboard"
      aria-label="Crossword keyboard"
      data-testid="crossword-keyboard"
      data-reduced-motion={reduceMotion ? "true" : undefined}
    >
      {KEY_ROWS.map((row, rowIndex) => (
        <div className="crossword-keyboard-row" key={row}>
          {row.split("").map((letter) => (
            <Pressable
              key={letter}
              type="button"
              cue="tap"
              ripple="light"
              noLift
              className="crossword-key"
              disabled={disabled}
              onClick={() => onLetter(letter)}
              aria-label={`Enter ${letter}`}
              data-testid={`crossword-key-${letter}`}
            >
              {letter}
            </Pressable>
          ))}
          {rowIndex === KEY_ROWS.length - 1 && (
            <Pressable
              type="button"
              cue="tap"
              ripple="light"
              noLift
              className="crossword-key crossword-key-backspace"
              disabled={disabled}
              onClick={onBackspace}
              aria-label="Backspace"
              data-testid="crossword-key-backspace"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 4H8l-6 8 6 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z" />
                <path d="m10 9 6 6m0-6-6 6" />
              </svg>
            </Pressable>
          )}
        </div>
      ))}
    </div>
  );
}
