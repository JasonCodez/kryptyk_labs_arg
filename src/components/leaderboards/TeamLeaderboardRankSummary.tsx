"use client";

import Link from "next/link";
import { Lock, UsersRound } from "lucide-react";
import type { TeamLeaderboardDisplayEntry } from "./TeamLeaderboardList";
import { formatTeamMetric, getTeamDisplayName } from "./TeamLeaderboardList";

export interface TeamLeaderboardRankSummaryProps {
  entry: TeamLeaderboardDisplayEntry | null;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function isValidNumber(value: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getRankLabel(rank: number): string {
  if (!isValidNumber(rank) || rank < 1) return "—";
  return `#${rank}`;
}

function memberLabel(count: number): string {
  const safe = isValidNumber(count) ? count : 0;
  return `${safe.toLocaleString()} ${safe === 1 ? "member" : "members"}`;
}

function puzzleLabel(count: number): string {
  const safe = isValidNumber(count) ? count : 0;
  return `${safe.toLocaleString()} ${safe === 1 ? "puzzle solved" : "puzzles solved"}`;
}

export default function TeamLeaderboardRankSummary({ entry }: TeamLeaderboardRankSummaryProps) {
  return (
    <section
      className="rounded-xl border p-4 sm:p-6"
      style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
      aria-labelledby="team-leaderboard-rank-summary-title"
      data-testid="team-rank-summary"
    >
      <p
        id="team-leaderboard-rank-summary-title"
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--pw-text-muted)" }}
      >
        Your Team Rank
      </p>

      {entry ? (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>
              Your Team
            </p>
            <Link
              href={`/teams/${entry.teamId}`}
              className={`mt-1 inline-flex min-h-11 items-center rounded-lg break-words text-xl font-bold sm:text-2xl ${FOCUS_RING}`}
              style={{ color: "var(--pw-text-primary)" }}
            >
              {getTeamDisplayName(entry.teamName)}
            </Link>
            <span className="mt-1 flex items-center gap-1.5">
              {entry.isPublic ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: "var(--pw-surface-2)", color: "var(--pw-text-secondary)" }}
                >
                  <UsersRound aria-hidden="true" size={11} />
                  Public
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: "var(--pw-surface-2)", color: "var(--pw-text-secondary)" }}
                >
                  <Lock aria-hidden="true" size={11} />
                  Private
                </span>
              )}
            </span>
            <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
              {getRankLabel(entry.rank)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
              {formatTeamMetric(entry.totalPoints)}
            </p>
            <p className="text-sm" style={{ color: "var(--pw-text-muted)" }}>Team points</p>
            <p className="mt-1 text-sm tabular-nums" style={{ color: "var(--pw-text-muted)" }}>
              {memberLabel(entry.memberCount)}
            </p>
            <p className="text-sm tabular-nums" style={{ color: "var(--pw-text-muted)" }}>
              {puzzleLabel(entry.totalPuzzlesSolved)}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>
            Your Team
          </p>
          <p className="mt-1 text-3xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
            Not ranked
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--pw-text-muted)" }}>
            Join or create a team to compete in the team rankings.
          </p>
          <Link
            href="/teams"
            className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold ${FOCUS_RING}`}
            style={{ minHeight: 44, background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
          >
            <UsersRound aria-hidden="true" size={16} />
            <span>Explore Teams</span>
          </Link>
        </div>
      )}
    </section>
  );
}
