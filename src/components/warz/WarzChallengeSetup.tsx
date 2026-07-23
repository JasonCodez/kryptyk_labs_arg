"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Target, Timer, Ban, ShieldAlert, CircleCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import Card from "@/components/ui/Card";
import WarzOpponentSearch, { type WarzOpponentSearchResult } from "@/components/warz/WarzOpponentSearch";

export const WAGER_PRESETS = [10, 25, 50, 100, 250, 500] as const;

export interface WarzSetupPuzzle {
  id: string;
  title: string;
  difficulty: string;
  puzzleType: string;
}

export interface WarzSetupUser {
  id: string;
  username: string;
  totalPoints: number;
}

export type WarzSetupOpponent = WarzOpponentSearchResult;

export interface WarzChallengeSetupProps {
  puzzle: WarzSetupPuzzle;
  currentUser: WarzSetupUser;
  wagerInput: string;
  wager: number | null;
  wagerError: string | null;
  selectedOpponent: WarzSetupOpponent | null;
  resolvingInvite: boolean;
  inviteError: string | null;
  onPresetWager: (value: number) => void;
  onWagerInputChange: (value: string) => void;
  onSelectOpponent: (opponent: WarzSetupOpponent) => void;
  onRemoveOpponent: () => void;
  onRetryInvite?: () => void;
  onStart: () => void;
  onCancel: () => void;
  startDisabled: boolean;
}

const RULES = [
  { icon: Ban, text: "No hints" },
  { icon: ShieldAlert, text: "No XP" },
  { icon: Timer, text: "The timer begins when you start" },
  { icon: CircleCheck, text: "Your challenge is posted only after a valid solve" },
];

export default function WarzChallengeSetup({
  puzzle,
  currentUser,
  wagerInput,
  wager,
  wagerError,
  selectedOpponent,
  resolvingInvite,
  inviteError,
  onPresetWager,
  onWagerInputChange,
  onSelectOpponent,
  onRemoveOpponent,
  onRetryInvite,
  onStart,
  onCancel,
  startDisabled,
}: WarzChallengeSetupProps) {
  const reduceMotion = useAppReducedMotion();
  const pot = wager != null ? wager * 2 : null;
  const wagerErrorId = "warz-setup-wager-error";

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto flex w-full max-w-xl flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <p
          className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest"
          style={{ color: "var(--pw-brand-secondary)" }}
        >
          <Swords aria-hidden="true" size={14} strokeWidth={2.5} />
          Puzzle Warz
        </p>
        <h1 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--pw-text-primary)" }}>
          Set Your Challenge
        </h1>
        <p className="max-w-md text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          Choose your wager and opponent before the timer begins.
        </p>
      </div>

      <Card padding="md">
        <h2 className="mb-1 break-words text-base font-bold" style={{ color: "var(--pw-text-primary)" }}>
          {puzzle.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded px-1.5 py-0.5 font-bold"
            style={{ color: "var(--pw-brand-primary)", background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" }}
          >
            {getPuzzleTypeLabel(puzzle.puzzleType)}
          </span>
          {puzzle.difficulty && (
            <span style={{ color: "var(--pw-text-muted)" }}>{puzzle.difficulty}</span>
          )}
        </div>
      </Card>

      <Card padding="md">
        <div className="flex flex-wrap gap-2">
          {WAGER_PRESETS.map((preset) => {
            const active = wager === preset && wagerInput === String(preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => onPresetWager(preset)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-bold"
                style={{
                  minHeight: 46,
                  background: active
                    ? "color-mix(in srgb, var(--pw-brand-secondary) 20%, transparent)"
                    : "var(--pw-surface-2)",
                  border: `1px solid ${active ? "var(--pw-brand-secondary)" : "var(--pw-border-default)"}`,
                  color: active ? "var(--pw-brand-secondary)" : "var(--pw-text-muted)",
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <label htmlFor="warz-setup-wager" className="text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
            Custom wager <span className="font-normal">(10–500 Points)</span>
          </label>
          <input
            id="warz-setup-wager"
            type="text"
            inputMode="numeric"
            value={wagerInput}
            onChange={(event) => onWagerInputChange(event.target.value)}
            aria-invalid={wagerError != null}
            aria-describedby={wagerError ? wagerErrorId : undefined}
            className="min-h-11 w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              minHeight: 46,
              background: "var(--pw-surface-2)",
              border: `1px solid ${wagerError ? "var(--pw-error)" : "var(--pw-border-default)"}`,
              color: "var(--pw-text-primary)",
            }}
          />
          {wagerError && (
            <p id={wagerErrorId} className="text-xs" style={{ color: "var(--pw-error-text)" }}>
              {wagerError}
            </p>
          )}
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Available balance
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              {currentUser.totalPoints} Points
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Your wager
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              {wager != null ? `${wager} Points` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Total pot
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-success)" }}>
              {pot != null ? `${pot} Points` : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card padding="md">
        {resolvingInvite ? (
          <p role="status" className="flex items-center gap-2 text-sm" style={{ color: "var(--pw-text-muted)" }}>
            <Target aria-hidden="true" size={14} />
            Resolving your targeted opponent…
          </p>
        ) : inviteError ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <TriangleAlert aria-hidden="true" size={20} style={{ color: "var(--pw-error-text)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
              {inviteError}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {onRetryInvite && (
                <button
                  type="button"
                  onClick={onRetryInvite}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
                  style={{ color: "var(--pw-brand-primary)", background: "var(--pw-surface-2)" }}
                >
                  <RefreshCw aria-hidden="true" size={13} />
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={onRemoveOpponent}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
                style={{ color: "var(--pw-text-muted)", background: "var(--pw-surface-2)" }}
              >
                Choose another opponent
              </button>
            </div>
          </div>
        ) : (
          <WarzOpponentSearch selectedOpponent={selectedOpponent} onSelect={onSelectOpponent} onRemove={onRemoveOpponent} />
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--pw-text-muted)" }}>
          {selectedOpponent
            ? "Only the selected player can accept this challenge."
            : "Any eligible player can accept this challenge."}
        </p>
      </Card>

      <Card padding="md">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-brand-secondary)" }}>
          Your Challenge
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt style={{ color: "var(--pw-text-muted)" }}>Puzzle</dt>
            <dd className="break-words text-right font-semibold" style={{ color: "var(--pw-text-primary)" }}>
              {puzzle.title}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt style={{ color: "var(--pw-text-muted)" }}>Opponent</dt>
            <dd className="break-words text-right font-semibold" style={{ color: "var(--pw-text-primary)" }}>
              {selectedOpponent ? `@${selectedOpponent.username}` : "Open to anyone"}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt style={{ color: "var(--pw-text-muted)" }}>Your wager</dt>
            <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              {wager != null ? `${wager} Points` : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt style={{ color: "var(--pw-text-muted)" }}>Total pot</dt>
            <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-success)" }}>
              {pot != null ? `${pot} Points` : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <div
        className="flex flex-col gap-2 rounded-xl p-4 text-sm"
        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
      >
        {RULES.map((rule) => (
          <p key={rule.text} className="flex items-center gap-2" style={{ color: "var(--pw-text-secondary)" }}>
            <rule.icon aria-hidden="true" size={14} />
            {rule.text}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={startDisabled}
        className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised relative inline-flex items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase tracking-wide disabled:opacity-50"
        style={{ minHeight: 52 }}
      >
        <span className="game-gloss-overlay" aria-hidden />
        <Swords aria-hidden="true" size={18} className="relative" />
        <span className="relative">Start Battle</span>
      </button>

      <Link
        href="/warz"
        onClick={onCancel}
        className="inline-flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold"
        style={{ color: "var(--pw-text-muted)" }}
      >
        Back to Warz Arena
      </Link>
    </motion.div>
  );
}
