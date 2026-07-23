"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Ban, Timer, ShieldAlert, CircleCheck, LockKeyhole } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import Card from "@/components/ui/Card";
import WarzChallengeStatus, { type WarzChallengeStatusKind } from "@/components/warz/WarzChallengeStatus";

export interface WarzBattleBriefingChallenge {
  puzzle: {
    title: string;
    puzzleType: string;
    difficulty?: string;
  };
  challenger: {
    username?: string | null;
    name?: string | null;
  };
  invitedUser?: {
    username?: string | null;
    name?: string | null;
  } | null;
  challengerWager: number;
  expiresAt: string;
}

export interface WarzBattleBriefingUser {
  id: string;
  username: string;
  totalPoints: number;
}

export interface WarzBattleBriefingProps {
  challenge: WarzBattleBriefingChallenge;
  currentUser: WarzBattleBriefingUser;
  statusKind: WarzChallengeStatusKind;
  accepting: boolean;
  acceptError: string | null;
  onAccept: () => void;
  onResume: () => void;
}

function formatExpiration(expiresAt: string): string {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return "Expired";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Expired";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const ACTIONABLE_KINDS: WarzChallengeStatusKind[] = ["open", "direct"];

export default function WarzBattleBriefing({
  challenge,
  currentUser,
  statusKind,
  accepting,
  acceptError,
  onAccept,
  onResume,
}: WarzBattleBriefingProps) {
  const reduceMotion = useAppReducedMotion();
  const pot = challenge.challengerWager * 2;
  const challengerName = challenge.challenger.name ?? challenge.challenger.username ?? "Player";
  const invitedUserName = challenge.invitedUser
    ? challenge.invitedUser.name ?? challenge.invitedUser.username ?? null
    : null;
  const expiration = formatExpiration(challenge.expiresAt);

  const isActionable = ACTIONABLE_KINDS.includes(statusKind);
  const isResume = statusKind === "resume";
  const isInsufficientBalance = statusKind === "insufficient-balance";

  const rules = [
    { icon: Ban, text: "No hints" },
    { icon: ShieldAlert, text: "No XP" },
    { icon: Timer, text: "The timer begins when the puzzle appears" },
    { icon: LockKeyhole, text: "You cannot replay this puzzle in Warz" },
    {
      icon: CircleCheck,
      text: isResume ? "Your wager is already committed" : "Accepting commits your wager",
    },
  ];

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
          You&rsquo;ve Been Challenged
        </h1>
        <p className="max-w-md break-words text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--pw-brand-secondary)" }}>
            @{challengerName}
          </span>{" "}
          posted a battle. Review the stakes before entering.
        </p>
      </div>

      <WarzChallengeStatus
        kind={statusKind}
        challengerName={challengerName}
        invitedUserName={invitedUserName}
        requiredPoints={challenge.challengerWager}
        availablePoints={currentUser.totalPoints}
      />

      <Card padding="md">
        <h2 className="mb-1 break-words text-base font-bold" style={{ color: "var(--pw-text-primary)" }}>
          {challenge.puzzle.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded px-1.5 py-0.5 font-bold"
            style={{ color: "var(--pw-brand-primary)", background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" }}
          >
            {getPuzzleTypeLabel(challenge.puzzle.puzzleType)}
          </span>
          {challenge.puzzle.difficulty && (
            <span style={{ color: "var(--pw-text-muted)" }}>{challenge.puzzle.difficulty}</span>
          )}
        </div>
        <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
          <dt style={{ color: "var(--pw-text-muted)" }}>Challenger</dt>
          <dd className="break-words text-right font-semibold" style={{ color: "var(--pw-text-primary)" }}>
            @{challengerName}
          </dd>
        </dl>
        <dl className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
          <dt style={{ color: "var(--pw-text-muted)" }}>Expires in</dt>
          <dd className="font-semibold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
            {expiration}
          </dd>
        </dl>
      </Card>

      <Card padding="md">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Wager per player
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              {challenge.challengerWager} Points
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Total pot
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-success)" }}>
              {pot} Points
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
              Available balance
            </dt>
            <dd className="font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              {currentUser.totalPoints} Points
            </dd>
          </div>
        </dl>
      </Card>

      {(isActionable || isResume) && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
        >
          {isResume ? (
            <p style={{ color: "var(--pw-text-secondary)" }}>
              Your wager has already been committed.
              <br />
              Starting the puzzle does not deduct Points again.
            </p>
          ) : (
            <p style={{ color: "var(--pw-text-secondary)" }}>
              Accepting commits <span className="font-bold">{challenge.challengerWager} Points</span> to this battle.
              <br />
              The winner receives the <span className="font-bold">{pot} Point</span> pot.
            </p>
          )}
        </div>
      )}

      <div
        className="flex flex-col gap-2 rounded-xl p-4 text-sm"
        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
      >
        {rules.map((rule) => (
          <p key={rule.text} className="flex items-center gap-2" style={{ color: "var(--pw-text-secondary)" }}>
            <rule.icon aria-hidden="true" size={14} />
            {rule.text}
          </p>
        ))}
      </div>

      {acceptError && (
        <p
          role="status"
          id="warz-accept-error"
          className="rounded-lg p-3 text-sm font-semibold"
          style={{ background: "color-mix(in srgb, var(--pw-error) 12%, transparent)", color: "var(--pw-error-text)" }}
        >
          {acceptError}
        </p>
      )}

      {isActionable && (
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          aria-describedby={acceptError ? "warz-accept-error" : undefined}
          className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised relative inline-flex items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase tracking-wide disabled:opacity-50"
          style={{ minHeight: 52 }}
        >
          <span className="game-gloss-overlay" aria-hidden />
          <Swords aria-hidden="true" size={18} className="relative" />
          <span className="relative">
            {accepting ? "Accepting challenge…" : statusKind === "direct" ? "Accept Direct Challenge" : "Accept & Start Battle"}
          </span>
        </button>
      )}

      {isResume && (
        <button
          type="button"
          onClick={onResume}
          className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised relative inline-flex items-center justify-center gap-2 rounded-2xl px-8 text-base font-extrabold uppercase tracking-wide"
          style={{ minHeight: 52 }}
        >
          <span className="game-gloss-overlay" aria-hidden />
          <Swords aria-hidden="true" size={18} className="relative" />
          <span className="relative">Play Battle</span>
        </button>
      )}

      {isInsufficientBalance && (
        <Link
          href="/store"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-bold"
          style={{
            minHeight: 44,
            color: "var(--pw-brand-primary)",
            background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
          }}
        >
          Visit Point Store
        </Link>
      )}

      <Link
        href="/warz"
        className="inline-flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold"
        style={{ minHeight: 44, color: "var(--pw-text-muted)" }}
      >
        Back to Warz Arena
      </Link>
    </motion.div>
  );
}
