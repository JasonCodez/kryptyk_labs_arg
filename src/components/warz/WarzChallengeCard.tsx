"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Clock, Coins, Swords } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import Card from "@/components/ui/Card";

export interface WarzChallenge {
  id: string;
  status: string;
  challengerWager: number;
  createdAt: string;
  expiresAt: string;
  spotlightUntil?: string | null;
  puzzle: { id: string; title: string; difficulty: string; puzzleType: string };
  challenger: { id: string; name: string | null; image: string | null; level: number | null };
  opponent?: { id: string; name: string | null; image?: string | null } | null;
  invitedUser?: { id: string; name: string | null } | null;
  winner?: { id: string; name: string | null } | null;
}

export interface WarzChallengeCardProps {
  challenge: WarzChallenge;
  currentUserId: string;
  featured?: boolean;
  onCancelled?: (challengeId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

/** Safe broad time-left string; never throws on an invalid date. */
function timeLeft(expiresAt: string): string {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return "Expired";
  const diff = target - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function spotlightTimeLeft(spotlightUntil: string): string {
  const target = new Date(spotlightUntil).getTime();
  if (Number.isNaN(target)) return "";
  const diff = target - Date.now();
  if (diff <= 0) return "";
  const m = Math.ceil(diff / 60000);
  return `${m}m spotlight left`;
}

export default function WarzChallengeCard({
  challenge,
  currentUserId,
  featured = false,
  onCancelled,
}: WarzChallengeCardProps) {
  const reduceMotion = useAppReducedMotion();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const isChallenger = challenge.challenger.id === currentUserId;
  const isOpponent = challenge.opponent?.id === currentUserId;
  const isInvited = challenge.invitedUser?.id === currentUserId;
  const pot = challenge.challengerWager * 2;
  const status = cancelled ? "CANCELLED" : challenge.status;
  const statusLabel = STATUS_LABELS[status] ?? status;

  const handleCancel = async () => {
    if (cancelling || cancelled) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/warz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id }),
      });
      if (res.ok) {
        setCancelled(true);
        onCancelled?.(challenge.id);
      }
    } finally {
      setCancelling(false);
    }
  };

  const showCancel = challenge.status === "OPEN" && isChallenger && !cancelled;
  const showAccept =
    challenge.status === "OPEN" &&
    !isChallenger &&
    (!challenge.invitedUser || isInvited);
  const showInvitedElsewhere =
    challenge.status === "OPEN" &&
    !isChallenger &&
    challenge.invitedUser &&
    !isInvited;
  const showPlay = challenge.status === "IN_PROGRESS" && isOpponent;
  const showViewResult = challenge.status === "COMPLETED";
  const showView = isChallenger && challenge.status !== "OPEN" && challenge.status !== "COMPLETED";

  return (
    <motion.div
      data-testid="warz-challenge-card"
      data-challenge-id={challenge.id}
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        accent={featured ? "secondary" : "none"}
        padding="md"
        className="w-full"
        style={
          featured
            ? { border: "1px solid color-mix(in srgb, var(--pw-brand-secondary) 45%, var(--pw-border-default))" }
            : undefined
        }
      >
        {featured && (
          <p
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest"
            style={{ color: "var(--pw-brand-secondary)" }}
          >
            <Sparkles aria-hidden="true" size={13} />
            Spotlighted
            {challenge.spotlightUntil && spotlightTimeLeft(challenge.spotlightUntil) && (
              <span className="font-semibold normal-case tracking-normal">
                &middot; {spotlightTimeLeft(challenge.spotlightUntil)}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-words font-bold text-sm" style={{ color: "var(--pw-text-primary)" }}>
                {challenge.puzzle.title}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-xs font-bold"
                style={{
                  color: "var(--pw-brand-primary)",
                  background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)",
                }}
              >
                {getPuzzleTypeLabel(challenge.puzzle.puzzleType)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--pw-text-muted)" }}>
              <span>by {challenge.challenger.name ?? "Unknown"}</span>
              {challenge.invitedUser && <span className="break-words">invited: {challenge.invitedUser.name}</span>}
              {challenge.status === "OPEN" && (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" size={12} />
                  {timeLeft(challenge.expiresAt)}
                </span>
              )}
            </div>
          </div>

          <span
            className="shrink-0 rounded-full px-2 py-1 text-xs font-bold"
            style={{
              color: "var(--pw-text-secondary)",
              background: "var(--pw-surface-2)",
              border: "1px solid var(--pw-border-default)",
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            <span className="inline-flex items-center gap-1 font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              <Coins aria-hidden="true" size={14} />
              {challenge.challengerWager}
            </span>
            <span className="text-xs"> pts each &middot; pot </span>
            <span className="font-bold tabular-nums" style={{ color: "var(--pw-success)" }}>
              {pot}
            </span>
            <span className="text-xs"> pts</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {showCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs font-bold disabled:opacity-60"
                style={{
                  color: "var(--pw-error-text)",
                  background: "color-mix(in srgb, var(--pw-error) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pw-error) 30%, transparent)",
                }}
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            )}
            {showAccept && (
              <Link
                href={`/warz/challenge/${challenge.id}`}
                className="game-btn game-btn--secondary inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-3 text-xs font-extrabold uppercase"
              >
                <Swords aria-hidden="true" size={13} />
                Accept
              </Link>
            )}

            {showInvitedElsewhere && (
              <span className="inline-flex min-h-11 items-center text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
                Invited to another player
              </span>
            )}

            {showPlay && (
              <Link
                href={`/warz/challenge/${challenge.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs font-bold"
                style={{
                  color: "var(--pw-brand-primary)",
                  background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
                }}
              >
                Play
              </Link>
            )}

            {showViewResult && (
              <Link
                href={`/warz/challenge/${challenge.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs font-semibold"
                style={{ color: "var(--pw-text-secondary)", background: "var(--pw-surface-2)" }}
              >
                View Result
              </Link>
            )}

            {showView && (
              <Link
                href={`/warz/challenge/${challenge.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs font-semibold"
                style={{ color: "var(--pw-text-secondary)", background: "var(--pw-surface-2)" }}
              >
                View
              </Link>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
