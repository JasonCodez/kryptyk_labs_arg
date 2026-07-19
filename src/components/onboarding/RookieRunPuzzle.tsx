"use client";

import { useEffect, useState } from "react";
import GameButton from "@/components/game-ui/GameButton";
import { completeOnboardingStep } from "@/lib/onboarding";

/* ── Puzzle data ────────────────────────────────────────────────────── */

const CLUE = "What do players do with puzzles?";
const ANSWER = "SOLVE";
/** Scrambled presentation order — indices into this array identify tiles. */
const TILES = ["V", "E", "S", "O", "L"] as const;

const INCORRECT_FEEDBACK = "Not quite—remove a letter and try again.";
const SUCCESS_MESSAGE = "Starter puzzle complete.";

/* ── Rookie Run progress rail (Solve active on this screen) ─────────── */

type StageState = "done" | "active" | "upcoming";

const STAGES: { label: string; state: StageState; gold?: boolean }[] = [
  { label: "Learn", state: "done" },
  { label: "Solve", state: "active" },
  { label: "Celebrate", state: "upcoming", gold: true },
];

function stageNodeStyle(stage: (typeof STAGES)[number]): React.CSSProperties {
  if (stage.state === "active") {
    return {
      background: "color-mix(in srgb, var(--pw-brand-primary) 22%, transparent)",
      border: "2px solid var(--pw-brand-primary)",
      color: "var(--pw-brand-primary)",
      boxShadow: "0 0 12px color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
    };
  }
  if (stage.state === "done") {
    return {
      background: "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)",
      border: "2px solid color-mix(in srgb, var(--pw-brand-primary) 45%, transparent)",
      color: "var(--pw-brand-primary)",
    };
  }
  if (stage.gold) {
    return {
      background: "color-mix(in srgb, var(--pw-brand-secondary) 10%, transparent)",
      border: "2px solid color-mix(in srgb, var(--pw-brand-secondary) 55%, transparent)",
      color: "var(--pw-brand-secondary)",
    };
  }
  return {
    background: "transparent",
    border: "2px solid var(--pw-border-default)",
    color: "var(--pw-text-muted)",
  };
}

function ProgressRail() {
  return (
    <ol aria-label="Rookie Run progress" className="flex items-start justify-center mb-6 list-none p-0 m-0">
      {STAGES.map((stage, i) => (
        <li
          key={stage.label}
          aria-current={stage.state === "active" ? "step" : undefined}
          className="flex items-start"
        >
          {i > 0 && (
            <span
              aria-hidden
              className="block w-6 sm:w-10 h-[2px] mt-[15px]"
              style={{
                background: stage.gold
                  ? "linear-gradient(90deg, var(--pw-border-default), color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent))"
                  : "var(--pw-border-default)",
              }}
            />
          )}
          <span className="flex flex-col items-center gap-1.5 w-16">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
              style={stageNodeStyle(stage)}
            >
              {stage.gold ? "🏆" : stage.state === "done" ? "✓" : i + 1}
            </span>
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{
                color:
                  stage.state === "active"
                    ? "var(--pw-brand-primary)"
                    : stage.gold
                      ? "color-mix(in srgb, var(--pw-brand-secondary) 75%, var(--pw-text-muted))"
                      : "var(--pw-text-muted)",
              }}
            >
              {stage.label}
            </span>
            <span className="sr-only">
              {stage.state === "active" ? "(active)" : stage.state === "done" ? "(complete)" : "(upcoming)"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

interface RookieRunPuzzleProps {
  userId: string;
  /** Invoked by the success panel's "Return to Dashboard" button. */
  onReturnToDashboard: () => void;
}

/**
 * Guided starter anagram for Rookie Run Mission 01. Practice only — it records
 * onboarding steps (first_puzzle_started / first_puzzle_completed) in local
 * state and never touches puzzle completion APIs, points, or streaks.
 */
export default function RookieRunPuzzle({ userId, onReturnToDashboard }: RookieRunPuzzleProps) {
  // Tile indices (into TILES) in the order they were placed into slots.
  const [placed, setPlaced] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("");
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    completeOnboardingStep(userId, "first_puzzle_started");
  }, [userId]);

  const isFull = placed.length === TILES.length;

  function placeTile(tileIndex: number) {
    if (solved) return;
    setPlaced((prev) =>
      prev.includes(tileIndex) || prev.length >= TILES.length ? prev : [...prev, tileIndex],
    );
    setFeedback("");
  }

  function removeLast() {
    if (solved) return;
    setPlaced((prev) => prev.slice(0, -1));
    setFeedback("");
  }

  function checkAnswer() {
    if (solved || placed.length < TILES.length) return;
    const word = placed.map((i) => TILES[i]).join("");
    if (word === ANSWER) {
      completeOnboardingStep(userId, "first_puzzle_completed");
      setSolved(true);
      setFeedback("");
    } else {
      setFeedback(INCORRECT_FEEDBACK);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (solved) return;
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      removeLast();
      return;
    }
    if (event.key === "Enter" && isFull) {
      // Takes over Enter once every slot is filled — the slot/tile buttons no
      // longer need it, and this makes Enter-to-check work from anywhere.
      event.preventDefault();
      checkAnswer();
      return;
    }
    if (/^[a-zA-Z]$/.test(event.key)) {
      const letter = event.key.toUpperCase();
      const tileIndex = TILES.findIndex((l, i) => l === letter && !placed.includes(i));
      if (tileIndex !== -1) {
        event.preventDefault();
        placeTile(tileIndex);
      }
    }
  }

  return (
    <div className="px-4 py-6 sm:py-8" onKeyDown={handleKeyDown}>
      <div className="mx-auto w-full" style={{ maxWidth: 480 }}>
        <ProgressRail />

        {/* Clue panel — neutral navy surface */}
        <div
          className="rounded-2xl px-5 py-4 mb-6 text-center"
          style={{
            background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
            border: "1px solid var(--pw-border-default)",
          }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
            style={{ color: "var(--pw-brand-primary)" }}
          >
            Clue
          </p>
          <p className="text-base font-bold" style={{ color: "var(--pw-text-primary)" }}>
            {CLUE}
          </p>
        </div>

        {/* Answer slots */}
        <div
          role="group"
          aria-label="Answer slots"
          className="flex justify-center gap-2 mb-6 flex-wrap"
        >
          {Array.from({ length: TILES.length }, (_, slotIndex) => {
            const tileIndex = placed[slotIndex];
            const letter = tileIndex !== undefined ? TILES[tileIndex] : null;
            const filled = letter !== null;
            return (
              <button
                key={slotIndex}
                type="button"
                aria-label={`Answer slot ${slotIndex + 1}${filled ? `: ${letter}` : ", empty"}`}
                onClick={filled ? removeLast : undefined}
                disabled={solved}
                className="rounded-xl text-xl font-black flex items-center justify-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  width: 48,
                  height: 48,
                  minWidth: 44,
                  minHeight: 44,
                  outlineColor: "var(--pw-brand-primary)",
                  cursor: filled && !solved ? "pointer" : "default",
                  background: solved
                    ? "color-mix(in srgb, var(--pw-success) 14%, transparent)"
                    : filled
                      ? "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)"
                      : "var(--pw-bg-elevated)",
                  border: solved
                    ? "2px solid var(--pw-success)"
                    : filled
                      ? "2px solid var(--pw-brand-primary)"
                      : "2px dashed var(--pw-border-default)",
                  color: solved
                    ? "var(--pw-success)"
                    : filled
                      ? "var(--pw-text-primary)"
                      : "var(--pw-text-muted)",
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Letter tiles */}
        <div role="group" aria-label="Letter tiles" className="flex justify-center gap-2 mb-6 flex-wrap">
          {TILES.map((letter, tileIndex) => {
            const used = placed.includes(tileIndex);
            return (
              <button
                key={tileIndex}
                type="button"
                aria-label={`Letter ${letter}`}
                onClick={() => placeTile(tileIndex)}
                disabled={used || solved}
                className="rounded-xl text-xl font-black flex items-center justify-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  width: 48,
                  height: 48,
                  minWidth: 44,
                  minHeight: 44,
                  outlineColor: "var(--pw-brand-primary)",
                  cursor: used || solved ? "default" : "pointer",
                  opacity: used || solved ? 0.35 : 1,
                  background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
                  border: "2px solid color-mix(in srgb, var(--pw-brand-primary) 45%, var(--pw-border-default))",
                  color: "var(--pw-text-primary)",
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Incorrect-answer feedback */}
        <p
          role="status"
          aria-live="polite"
          className="text-center text-sm font-semibold mb-5 min-h-5"
          style={{ color: "var(--pw-brand-accent)" }}
        >
          {feedback}
        </p>

        {solved ? (
          /* Success panel — green appears only now */
          <div
            role="status"
            className="rounded-2xl px-5 py-6 text-center"
            style={{
              background: "color-mix(in srgb, var(--pw-success) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--pw-success) 45%, transparent)",
            }}
          >
            <p className="text-lg font-black mb-4" style={{ color: "var(--pw-success)" }}>
              {SUCCESS_MESSAGE}
            </p>
            <GameButton variant="success" fullWidth onClick={onReturnToDashboard}>
              Return to Dashboard
            </GameButton>
          </div>
        ) : (
          <GameButton variant="primary" fullWidth disabled={!isFull} onClick={checkAnswer}>
            Check Answer
          </GameButton>
        )}
      </div>
    </div>
  );
}
