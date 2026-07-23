"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Crown, Gem, Medal } from "lucide-react";

export interface LeaderboardDisplayEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  activeFlair: string;
  isPremium?: boolean;
  points: number;
  puzzlesSolved: number;
  rank: number;
  isCurrentUser: boolean;
}

export type LeaderboardRowVariant = "featured" | "standard";

export interface LeaderboardRowProps {
  entry: LeaderboardDisplayEntry;
  pointsLabel: string;
  variant?: LeaderboardRowVariant;
}

export function getLeaderboardDisplayName(userName: string | null): string {
  const trimmed = (userName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Anonymous";
}

export function getLeaderboardInitials(userName: string | null): string {
  const trimmed = (userName ?? "").trim();
  if (!trimmed) return "P";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "P";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function formatLeaderboardMetric(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString();
}

function getRankLabel(rank: number): string {
  if (!Number.isFinite(rank) || rank < 1) return "—";
  return `#${rank}`;
}

const PLACEMENT: Record<number, { label: string; Icon: typeof Crown; accent: string }> = {
  1: { label: "1st Place", Icon: Crown, accent: "var(--pw-warning)" },
  2: { label: "2nd Place", Icon: Medal, accent: "var(--pw-text-secondary)" },
  3: { label: "3rd Place", Icon: Award, accent: "var(--pw-brand-secondary)" },
};

function AvatarOrInitials({ userImage, userName }: { userImage: string | null; userName: string | null }) {
  const [failed, setFailed] = useState(false);
  // Clears a previous failure whenever the URL itself changes — a genuinely
  // new image gets its own chance to load rather than inheriting a stale
  // failure from a different entry/URL.
  useEffect(() => {
    setFailed(false);
  }, [userImage]);

  const trimmedUrl = (userImage ?? "").trim();
  const showImage = trimmedUrl.length > 0 && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar source is
      // arbitrary user-supplied/remote URLs; no next.config domain list to extend.
      <img
        src={trimmedUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"
        style={{ border: "1px solid var(--pw-border-default)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10"
      style={{
        background: "var(--pw-surface-2)",
        color: "var(--pw-text-secondary)",
        border: "1px solid var(--pw-border-default)",
      }}
    >
      {getLeaderboardInitials(userName)}
    </span>
  );
}

function IdentityContent({ entry }: { entry: LeaderboardDisplayEntry }) {
  const displayName = getLeaderboardDisplayName(entry.userName);
  const trimmedFlair = (entry.activeFlair ?? "").trim();
  const hasFlair = trimmedFlair.length > 0 && trimmedFlair !== "none";

  return (
    <>
      <AvatarOrInitials userImage={entry.userImage} userName={entry.userName} />
      <span className="min-w-0 flex-1">
        <span
          className="block break-words font-semibold sm:whitespace-normal"
          style={{ color: "var(--pw-text-primary)" }}
        >
          {displayName}
        </span>
        {(entry.isCurrentUser || entry.isPremium || hasFlair) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {entry.isCurrentUser && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  background: "color-mix(in srgb, var(--pw-brand-primary) 22%, var(--pw-surface-2))",
                  color: "var(--pw-brand-primary)",
                }}
              >
                You
              </span>
            )}
            {entry.isPremium && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  background: "color-mix(in srgb, var(--pw-warning) 18%, var(--pw-surface-2))",
                  color: "var(--pw-warning)",
                }}
              >
                <Gem aria-hidden="true" size={11} />
                Premium
              </span>
            )}
            {hasFlair && (
              <span
                className="max-w-[150px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "var(--pw-surface-2)", color: "var(--pw-text-secondary)" }}
                aria-label={`Active flair: ${trimmedFlair}`}
              >
                {trimmedFlair}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function Identity({ entry }: { entry: LeaderboardDisplayEntry }) {
  if (entry.userId) {
    return (
      <Link
        href={`/profile/${entry.userId}`}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg ${FOCUS_RING}`}
      >
        <IdentityContent entry={entry} />
      </Link>
    );
  }
  return (
    <span className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
      <IdentityContent entry={entry} />
    </span>
  );
}

export default function LeaderboardRow({ entry, pointsLabel, variant = "standard" }: LeaderboardRowProps) {
  const currentUserRing = entry.isCurrentUser ? "inset 0 0 0 2px var(--pw-brand-primary)" : undefined;

  if (variant === "featured") {
    const placement = PLACEMENT[entry.rank] ?? { label: getRankLabel(entry.rank), Icon: Award, accent: "var(--pw-text-secondary)" };
    const Icon = placement.Icon;
    const isFirst = entry.rank === 1;
    return (
      <li
        className="flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-5"
        style={{
          borderColor: isFirst ? "var(--pw-warning)" : "var(--pw-border-default)",
          background: isFirst
            ? "color-mix(in srgb, var(--pw-warning) 10%, var(--pw-surface-1))"
            : "var(--pw-surface-1)",
          boxShadow: currentUserRing,
        }}
      >
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
          style={{ color: placement.accent }}
        >
          <Icon aria-hidden="true" size={16} />
          {placement.label}
        </span>
        <Identity entry={entry} />
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          <span className="tabular-nums">{formatLeaderboardMetric(entry.puzzlesSolved)} puzzles solved</span>
          <span className="text-right">
            <span className="block text-lg font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              {formatLeaderboardMetric(entry.points)}
            </span>
            <span className="block text-xs" style={{ color: "var(--pw-text-muted)" }}>{pointsLabel}</span>
          </span>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex min-w-0 items-center gap-3 border-b p-3 last:border-0 sm:p-4"
      style={{ borderColor: "var(--pw-border-default)", boxShadow: currentUserRing }}
    >
      <span
        className="w-9 shrink-0 text-center font-mono text-sm font-bold tabular-nums"
        style={{ color: "var(--pw-text-secondary)" }}
      >
        {getRankLabel(entry.rank)}
      </span>
      <Identity entry={entry} />
      <div className="shrink-0 text-right">
        <p className="text-xs tabular-nums sm:hidden" style={{ color: "var(--pw-text-muted)" }}>
          {formatLeaderboardMetric(entry.puzzlesSolved)} solved
        </p>
        <p className="hidden text-sm tabular-nums sm:block" style={{ color: "var(--pw-text-muted)" }}>
          {formatLeaderboardMetric(entry.puzzlesSolved)} puzzles solved
        </p>
        <p className="text-base font-bold tabular-nums sm:text-lg" style={{ color: "var(--pw-text-primary)" }}>
          {formatLeaderboardMetric(entry.points)}
        </p>
        <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>{pointsLabel}</p>
      </div>
    </li>
  );
}
