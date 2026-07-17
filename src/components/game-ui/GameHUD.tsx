"use client";

import type { ReactNode, CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton, { type GameButtonVariant } from "./GameButton";

export interface GameHUDStat {
  key: string;
  icon: ReactNode;
  value: string | number;
  variant?: GameButtonVariant;
  label?: string;
}

export interface GameHUDAction {
  key: string;
  icon: ReactNode;
  label: string;
  variant?: GameButtonVariant;
  onClick: () => void;
  disabled?: boolean;
  /** Emphasize this action (e.g. the primary "Play"/"Continue" button). */
  pulse?: boolean;
}

export interface GameHUDProps {
  /** Top-bar stat pills, left to right — e.g. Score, Moves, Health. */
  stats: GameHUDStat[];
  /** Bottom action bar buttons — e.g. Pause, Hint, Shuffle. */
  actions?: GameHUDAction[];
  onPause?: () => void;
  children?: ReactNode;
}

/**
 * A soft glass/jelly pill used for every HUD stat (Score, Moves, Health, …).
 * Purely presentational — the value swap itself is what gets the "juice"
 * (a quick scale-bounce) via AnimatePresence/key below.
 */
function StatPill({ stat }: { stat: GameHUDStat }) {
  const variant = stat.variant ?? "purple";
  return (
    <div
      className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 border-2 shadow-skeu-pill overflow-hidden"
      style={{
        backgroundImage:
          variant === "gold"
            ? "linear-gradient(160deg, #FFE58A 0%, #FFC93C 60%, #E0960B 100%)"
            : variant === "cyan"
              ? "linear-gradient(160deg, #8FF6F3 0%, #2FE6E0 60%, #0FA6A1 100%)"
              : variant === "grass"
                ? "linear-gradient(160deg, #8CF3AE 0%, #3ED97A 60%, #1F9E52 100%)"
                : variant === "ember"
                  ? "linear-gradient(160deg, #FF9C9C 0%, #FF5A5A 60%, #C72A2A 100%)"
                  : "linear-gradient(160deg, #B98CFF 0%, #8B3DFF 60%, #5B1FB0 100%)",
        borderColor: "rgba(0,0,0,0.25)",
      }}
    >
      <span className="game-gloss-overlay game-gloss-overlay--pill" aria-hidden />
      <span className="relative text-base sm:text-lg leading-none drop-shadow-sm">{stat.icon}</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={String(stat.value)}
          initial={{ scale: 1.5, opacity: 0, y: -6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="relative font-black text-white text-sm sm:text-base game-text-stroke game-text-pop tabular-nums"
          style={{ "--stroke-width": "1.5px" } as CSSProperties}
        >
          {stat.value}
        </motion.span>
      </AnimatePresence>
      {stat.label && (
        <span className="relative hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-white/80">
          {stat.label}
        </span>
      )}
    </div>
  );
}

/**
 * Non-diegetic HUD overlay: a top bar (stat pills + pause) and an optional
 * bottom action bar, both floating above the game board — never part of the
 * board's own coordinate space. Mobile-first: the top bar wraps/shrinks
 * before anything is clipped, and every actionable element keeps a 44px+
 * touch target via GameButton's size floor.
 */
export default function GameHUD({ stats, actions, onPause, children }: GameHUDProps) {
  return (
    <div className="relative w-full h-full flex flex-col pointer-events-none">
      {/* ── Top bar: stats + pause ─────────────────────────────────────────── */}
      <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {stats.map((stat) => (
            <StatPill key={stat.key} stat={stat} />
          ))}
        </div>
        {onPause && (
          <GameButton
            variant="purple"
            size="sm"
            onClick={onPause}
            aria-label="Pause"
            className="!px-3 shrink-0"
          >
            ⏸
          </GameButton>
        )}
      </div>

      {/* ── Game board slot — the HUD never occupies this space, it floats above it ── */}
      <div className="flex-1 min-h-0 pointer-events-auto">{children}</div>

      {/* ── Bottom action bar ──────────────────────────────────────────────── */}
      {actions && actions.length > 0 && (
        <div className="pointer-events-auto flex items-center justify-center gap-2 sm:gap-4 px-3 pb-4 sm:px-6 sm:pb-6 flex-wrap">
          {actions.map((action) => (
            <GameButton
              key={action.key}
              variant={action.variant ?? "pink"}
              size="md"
              icon={action.icon}
              pulse={action.pulse}
              disabled={action.disabled}
              onClick={action.onClick}
              aria-label={action.label}
            >
              {action.label}
            </GameButton>
          ))}
        </div>
      )}
    </div>
  );
}
