"use client";

import type { RefObject } from "react";
import { motion } from "framer-motion";
import { Swords, Coins, Shield, Crosshair, Puzzle, Timer, Trophy } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

export interface WarzLobbyCurrentUser {
  id: string;
  username: string | null;
  totalPoints: number;
  level: number;
}

export interface WarzLobbyHeaderProps {
  currentUser: WarzLobbyCurrentUser | null;
  targetingRival: boolean;
  onIssueChallenge: () => void;
  issueButtonRef?: RefObject<HTMLButtonElement | null>;
}

const STEPS = [
  { icon: Puzzle, text: "Choose a puzzle" },
  { icon: Timer, text: "Set a wager and post your time" },
  { icon: Trophy, text: "Fastest valid solve wins the pot" },
];

/**
 * Compact, presentational Warz lobby identity + summary block. Performs no
 * requests — every value it renders (user summary, counts) is derived and
 * passed in by the page from data it already fetched.
 */
export default function WarzLobbyHeader({
  currentUser,
  targetingRival,
  onIssueChallenge,
  issueButtonRef,
}: WarzLobbyHeaderProps) {
  const reduceMotion = useAppReducedMotion();

  return (
    <motion.header
      className="pw-surface relative overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{ border: "1px solid var(--pw-border-default)" }}
      initial={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <p
          className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest"
          style={{ color: "var(--pw-brand-secondary)" }}
        >
          <Swords aria-hidden="true" size={14} strokeWidth={2.5} />
          Competitive Arena
        </p>

        <h1 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--pw-text-primary)" }}>
          Puzzle Warz
        </h1>

        <p className="max-w-md text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          Race another player on the same puzzle. Fastest valid solve wins the pot.
        </p>

        {currentUser && (
          <div
            className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full px-4 py-2 text-sm"
            style={{
              background: "color-mix(in srgb, var(--pw-brand-secondary) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--pw-brand-secondary) 30%, transparent)",
            }}
          >
            <span className="inline-flex items-center gap-1.5 font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              <Coins aria-hidden="true" size={15} />
              {currentUser.totalPoints} Points
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--pw-text-secondary)" }}>
              <Shield aria-hidden="true" size={15} />
              Level {currentUser.level}
            </span>
          </div>
        )}

        {targetingRival && (
          <p
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "var(--pw-brand-secondary)" }}
          >
            <Crosshair aria-hidden="true" size={15} />
            You&rsquo;re targeting a specific rival. Choose a puzzle to begin.
          </p>
        )}

        <button
          type="button"
          ref={issueButtonRef}
          onClick={onIssueChallenge}
          className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised relative inline-flex items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase tracking-wide"
          style={{ minHeight: 48 }}
        >
          <span className="game-gloss-overlay" aria-hidden />
          <Swords aria-hidden="true" size={18} className="relative" />
          <span className="relative">Issue a Challenge</span>
        </button>

        <ul className="flex flex-col items-start gap-1.5 text-xs sm:flex-row sm:items-center sm:gap-4" style={{ color: "var(--pw-text-muted)" }}>
          {STEPS.map((step, index) => (
            <li key={step.text} className="inline-flex items-center gap-1.5">
              <step.icon aria-hidden="true" size={14} />
              <span>
                {index + 1}. {step.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.header>
  );
}
