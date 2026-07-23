"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CircleCheckBig, CalendarClock } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import Card from "@/components/ui/Card";

export interface WarzChallengePostedOpponent {
  id: string;
  username: string;
}

export interface WarzChallengePostedProps {
  puzzleTitle: string;
  solveTimeSeconds: number;
  wager: number;
  opponent: WarzChallengePostedOpponent | null;
}

function formatSolveTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

/**
 * Presentational Warz challenge-posted confirmation. Renders only the values
 * already returned by the completed create request — performs no requests,
 * no balance math, and no reward/refund calculations of its own.
 */
export default function WarzChallengePosted({ puzzleTitle, solveTimeSeconds, wager, opponent }: WarzChallengePostedProps) {
  const reduceMotion = useAppReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const pot = wager * 2;

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex w-full max-w-xl flex-col gap-6"
    >
      <Card accent="success" padding="lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <CircleCheckBig aria-hidden="true" size={40} strokeWidth={2} color="var(--pw-success)" />
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-success)" }}>
            Puzzle Warz
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-extrabold outline-none"
            style={{ color: "var(--pw-text-primary)" }}
          >
            Challenge Posted
          </h1>
          <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            Your challenge is live.{" "}
            {opponent ? `Challenge sent to @${opponent.username}.` : "Any eligible player can accept it."}
          </p>

          <dl className="mt-2 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
            <div>
              <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                Puzzle
              </dt>
              <dd className="break-words font-semibold" style={{ color: "var(--pw-text-primary)" }}>
                {puzzleTitle}
              </dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                Your time
              </dt>
              <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
                {formatSolveTime(solveTimeSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                Your wager
              </dt>
              <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
                {wager} Points
              </dd>
            </div>
            <div>
              <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                Total pot
              </dt>
              <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-success)" }}>
                {pot} Points
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                Opponent
              </dt>
              <dd className="break-words font-semibold" style={{ color: "var(--pw-text-primary)" }}>
                {opponent ? `@${opponent.username}` : "Open to anyone"}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <div
        className="flex flex-col gap-2 rounded-xl p-4 text-sm"
        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
      >
        <p className="flex items-start gap-2" style={{ color: "var(--pw-text-secondary)" }}>
          <CalendarClock aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          <span>
            Your challenge remains open for up to 24 hours. You&rsquo;ll be notified when an opponent completes it.{" "}
            {opponent
              ? "Only the selected player can accept this challenge."
              : "If no opponent accepts, the existing server refund rules apply."}
          </span>
        </p>
      </div>

      <Link
        href="/warz"
        className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised relative inline-flex items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase tracking-wide"
        style={{ minHeight: 48 }}
      >
        <span className="game-gloss-overlay" aria-hidden />
        <span className="relative">View My Battles</span>
      </Link>

      <Link
        href="/warz"
        className="inline-flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold"
        style={{ color: "var(--pw-text-muted)" }}
      >
        Back to Warz Arena
      </Link>
    </motion.div>
  );
}
