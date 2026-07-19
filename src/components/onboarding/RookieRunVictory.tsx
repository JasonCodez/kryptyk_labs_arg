"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/game-ui/GameButton";
import { AnimatedCheck, SparkleBurst, SuccessRing } from "@/components/juice/particles";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

// Literal canonical token values (globals.css). SuccessRing appends an alpha
// channel to its color and SparkleBurst falls back to the legacy jewel palette
// (which still contains purple), so both must receive explicit hex — a CSS
// var() reference would break the ring's derived shadow color.
const TOKEN_BLUE = "#03ACF4"; // --pw-brand-primary
const TOKEN_GOLD = "#FED007"; // --pw-brand-secondary / --pw-gold
const TOKEN_SUCCESS = "#3BC46A"; // --pw-success

interface RookieRunVictoryProps {
  /** Invoked by the "Continue to Dashboard" button. */
  onReturnToDashboard: () => void;
}

/**
 * First-victory card for Rookie Run Mission 01. Purely presentational — the
 * puzzle records first_puzzle_completed before mounting this; no XP, points,
 * streaks, or badges are involved.
 */
export default function RookieRunVictory({ onReturnToDashboard }: RookieRunVictoryProps) {
  const reduceMotion = useAppReducedMotion();
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueRef.current?.focus();
  }, []);

  const card = (
    <div
      role="status"
      aria-live="polite"
      className="relative rounded-2xl px-5 py-7 text-center"
      style={{
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 40%, var(--pw-border-default))",
        boxShadow: "0 8px 32px color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)",
      }}
    >
      {!reduceMotion && (
        <span data-testid="victory-ring" className="absolute inset-0 rounded-[inherit]" aria-hidden>
          <SuccessRing trigger={1} color={TOKEN_BLUE} />
        </span>
      )}

      {/* Puzzle emblem with confirmation check */}
      <div
        className="relative mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)",
          border: "2px solid var(--pw-brand-primary)",
        }}
      >
        {!reduceMotion && (
          <span data-testid="victory-sparkles" className="absolute inset-0" aria-hidden>
            <SparkleBurst trigger={1} color={TOKEN_GOLD} />
          </span>
        )}
        <span className="text-3xl" aria-hidden>
          🧩
        </span>
        <span
          className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: "var(--pw-bg-elevated)",
            border: "2px solid var(--pw-success)",
          }}
        >
          {reduceMotion ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12.5l5 5L20 6.5"
                stroke={TOKEN_SUCCESS}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <AnimatedCheck size={16} color={TOKEN_SUCCESS} />
          )}
        </span>
      </div>

      <p
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
        style={{ color: "var(--pw-brand-primary)" }}
      >
        Rookie Run // Mission Complete
      </p>
      <h2 className="text-xl font-black mb-2" style={{ color: "var(--pw-text-primary)" }}>
        First solve complete.
      </h2>
      <p className="text-sm font-semibold mb-4" style={{ color: "var(--pw-text-muted)" }}>
        You learned the core loop: choose, solve, confirm.
      </p>

      {/* Gold milestone chip */}
      <p
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 mb-4 text-[11px] font-black tracking-widest uppercase"
        style={{
          background: "color-mix(in srgb, var(--pw-brand-secondary) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pw-brand-secondary) 60%, transparent)",
          color: "color-mix(in srgb, var(--pw-brand-secondary) 80%, var(--pw-text-primary))",
        }}
      >
        <span aria-hidden>🏆</span>
        First Solve
      </p>

      <p className="text-xs font-bold tracking-wide mb-4" style={{ color: "var(--pw-text-primary)" }}>
        Starter Path • 1 of 4 complete
      </p>

      {/* Next objective */}
      <div
        className="rounded-xl px-4 py-3 mb-5 text-left"
        style={{
          background: "color-mix(in srgb, var(--pw-brand-accent) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pw-brand-accent) 40%, transparent)",
        }}
      >
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-0.5"
          style={{ color: "var(--pw-brand-accent)" }}
        >
          Next objective
        </p>
        <p className="text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
          Discover today&rsquo;s Daily Puzzle
        </p>
      </div>

      <GameButton
        ref={continueRef}
        variant="primary"
        fullWidth
        onClick={onReturnToDashboard}
        className="focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--pw-brand-secondary)" }}
      >
        Continue to Dashboard
      </GameButton>
    </div>
  );

  if (reduceMotion) return card;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {card}
    </motion.div>
  );
}
