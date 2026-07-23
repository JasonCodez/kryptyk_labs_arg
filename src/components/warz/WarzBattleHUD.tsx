"use client";

import type { RefObject } from "react";
import { motion } from "framer-motion";
import { Swords, Coins, Timer, Flag } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

export interface WarzBattleHUDProps {
  puzzleTitle: string;
  wager: number;
  elapsedSeconds: number;
  ended: boolean;
  forfeitDisabled?: boolean;
  onForfeit: () => void;
  forfeitButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Formats a battle-clock value as `MM:SS`. Negative or non-finite input is
 * clamped to zero rather than displayed — the shell never manufactures a
 * negative on-screen time.
 */
export function formatBattleTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const remaining = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

/**
 * Presentational battle HUD — puzzle title, wager, elapsed time, and the
 * Forfeit action. Owns no timer, performs no requests, and never submits a
 * result; the page/board above supplies live values and the forfeit handler.
 */
export default function WarzBattleHUD({
  puzzleTitle,
  wager,
  elapsedSeconds,
  ended,
  forfeitDisabled = false,
  onForfeit,
  forfeitButtonRef,
}: WarzBattleHUDProps) {
  const reduceMotion = useAppReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      style={{ background: "var(--pw-surface-2)", borderColor: "var(--pw-border-default)" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Swords aria-hidden="true" size={16} style={{ color: "var(--pw-brand-secondary)" }} />
        <div className="min-w-0">
          <p
            className="text-xs font-extrabold uppercase tracking-widest"
            style={{ color: "var(--pw-brand-secondary)" }}
          >
            Puzzle Warz
          </p>
          <p className="break-words text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
            {puzzleTitle}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Coins aria-hidden="true" size={15} style={{ color: "var(--pw-brand-secondary)" }} />
          <span>
            <span className="sr-only">Wager</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              {wager} Points
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Timer aria-hidden="true" size={15} style={{ color: ended ? "var(--pw-success)" : "var(--pw-text-secondary)" }} />
          <span>
            <span className="sr-only">Battle time</span>
            <span
              className="text-lg font-black tabular-nums"
              style={{ color: ended ? "var(--pw-success)" : "var(--pw-text-primary)" }}
            >
              {formatBattleTime(elapsedSeconds)}
            </span>
          </span>
        </div>

        {!ended && (
          <button
            ref={forfeitButtonRef}
            type="button"
            onClick={onForfeit}
            disabled={forfeitDisabled}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold disabled:opacity-50"
            style={{
              minHeight: 44,
              background: "color-mix(in srgb, var(--pw-error) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--pw-error) 35%, transparent)",
              color: "var(--pw-error-text)",
            }}
          >
            <Flag aria-hidden="true" size={13} />
            Forfeit
          </button>
        )}
      </div>
    </motion.div>
  );
}
