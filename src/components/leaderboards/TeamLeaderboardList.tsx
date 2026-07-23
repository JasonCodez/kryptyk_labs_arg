"use client";

import Link from "next/link";
import { Award, Crown, Lock, Medal, UsersRound } from "lucide-react";

export interface TeamLeaderboardDisplayEntry {
  teamId: string;
  teamName: string | null;
  isPublic: boolean;
  bannerColor: string | null;
  totalPoints: number;
  totalPuzzlesSolved: number;
  memberCount: number;
  rank: number;
  isUserTeam: boolean;
}

export interface TeamLeaderboardListProps {
  entries: TeamLeaderboardDisplayEntry[];
}

export function getTeamDisplayName(teamName: string | null): string {
  const trimmed = (teamName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unnamed Team";
}

export function getTeamInitials(teamName: string | null): string {
  const trimmed = (teamName ?? "").trim();
  if (!trimmed) return "T";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function formatTeamMetric(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString();
}

const BANNER_ACCENT: Record<string, string> = {
  gold: "var(--pw-warning)",
  crimson: "var(--pw-error-text)",
  neon: "var(--pw-brand-primary)",
  none: "var(--pw-text-secondary)",
};

export function getTeamBannerAccent(bannerColor: unknown): string {
  if (typeof bannerColor !== "string") return "var(--pw-text-secondary)";
  const normalized = bannerColor.trim().toLowerCase();
  return BANNER_ACCENT[normalized] ?? "var(--pw-text-secondary)";
}

function getRankLabel(rank: number): string {
  if (!Number.isFinite(rank) || rank < 1) return "—";
  return `#${rank}`;
}

function memberLabel(count: number): string {
  const safe = Number.isFinite(count) && count >= 0 ? count : 0;
  return `${safe.toLocaleString()} ${safe === 1 ? "member" : "members"}`;
}

function puzzleLabel(count: number): string {
  const safe = Number.isFinite(count) && count >= 0 ? count : 0;
  return `${safe.toLocaleString()} ${safe === 1 ? "puzzle solved" : "puzzles solved"}`;
}

const PLACEMENT: Record<number, { label: string; Icon: typeof Crown; accent: string }> = {
  1: { label: "1st Place", Icon: Crown, accent: "var(--pw-warning)" },
  2: { label: "2nd Place", Icon: Medal, accent: "var(--pw-text-secondary)" },
  3: { label: "3rd Place", Icon: Award, accent: "var(--pw-brand-secondary)" },
};

function TeamEmblem({ teamName, bannerColor }: { teamName: string | null; bannerColor: string | null }) {
  const accent = getTeamBannerAccent(bannerColor);
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10"
      style={{
        background: "color-mix(in srgb, " + accent + " 14%, var(--pw-surface-2))",
        color: accent,
        border: `1px solid color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
    >
      {getTeamInitials(teamName)}
    </span>
  );
}

function StatusBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
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
  );
}

function YourTeamBadge() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{
        background: "color-mix(in srgb, var(--pw-brand-primary) 22%, var(--pw-surface-2))",
        color: "var(--pw-brand-primary)",
      }}
    >
      Your team
    </span>
  );
}

function IdentityContent({ entry }: { entry: TeamLeaderboardDisplayEntry }) {
  const displayName = getTeamDisplayName(entry.teamName);
  return (
    <>
      <TeamEmblem teamName={entry.teamName} bannerColor={entry.bannerColor} />
      <span className="min-w-0 flex-1">
        <span
          className="block break-words font-semibold sm:whitespace-normal"
          style={{ color: "var(--pw-text-primary)" }}
        >
          {displayName}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {entry.isUserTeam && <YourTeamBadge />}
          <StatusBadge isPublic={entry.isPublic} />
        </span>
      </span>
    </>
  );
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function Identity({ entry }: { entry: TeamLeaderboardDisplayEntry }) {
  const canLink = entry.teamId.trim().length > 0 && (entry.isPublic || entry.isUserTeam);
  if (canLink) {
    return (
      <Link
        href={`/teams/${entry.teamId}`}
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

interface TeamRowProps {
  entry: TeamLeaderboardDisplayEntry;
  variant: "featured" | "standard";
}

function TeamRow({ entry, variant }: TeamRowProps) {
  const currentTeamRing = entry.isUserTeam ? "inset 0 0 0 2px var(--pw-brand-primary)" : undefined;

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
          boxShadow: currentTeamRing,
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
          <span className="tabular-nums">
            {memberLabel(entry.memberCount)} · {puzzleLabel(entry.totalPuzzlesSolved)}
          </span>
          <span className="text-right">
            <span className="block text-lg font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              {formatTeamMetric(entry.totalPoints)}
            </span>
            <span className="block text-xs" style={{ color: "var(--pw-text-muted)" }}>Team points</span>
          </span>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex min-w-0 items-center gap-3 border-b p-3 last:border-0 sm:p-4"
      style={{ borderColor: "var(--pw-border-default)", boxShadow: currentTeamRing }}
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
          {memberLabel(entry.memberCount)}
        </p>
        <p className="hidden text-sm tabular-nums sm:block" style={{ color: "var(--pw-text-muted)" }}>
          {memberLabel(entry.memberCount)} · {puzzleLabel(entry.totalPuzzlesSolved)}
        </p>
        <p className="text-xs tabular-nums sm:hidden" style={{ color: "var(--pw-text-muted)" }}>
          {puzzleLabel(entry.totalPuzzlesSolved)}
        </p>
        <p className="text-base font-bold tabular-nums sm:text-lg" style={{ color: "var(--pw-text-primary)" }}>
          {formatTeamMetric(entry.totalPoints)}
        </p>
        <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>Team points</p>
      </div>
    </li>
  );
}

function isTopThree(rank: number): boolean {
  return rank >= 1 && rank <= 3;
}

export default function TeamLeaderboardList({ entries }: TeamLeaderboardListProps) {
  // Partition by the authoritative server rank only — never by array index or
  // by sorting — so a rank-4 entry at index 0 is never mistaken for first place.
  const featuredEntries = entries.filter((entry) => isTopThree(entry.rank));
  const standardEntries = entries.filter((entry) => !isTopThree(entry.rank));

  const featuredColumns =
    featuredEntries.length === 1 ? "sm:grid-cols-1" : featuredEntries.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div data-testid="team-leaderboard-list" className="flex flex-col gap-6">
      {featuredEntries.length > 0 && (
        <section aria-labelledby="team-leaderboard-featured-heading">
          <h2
            id="team-leaderboard-featured-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--pw-text-muted)" }}
          >
            Top teams
          </h2>
          <ul className={`grid min-w-0 gap-3 ${featuredColumns}`}>
            {featuredEntries.map((entry) => (
              <TeamRow key={entry.teamId} entry={entry} variant="featured" />
            ))}
          </ul>
        </section>
      )}

      {standardEntries.length > 0 && (
        <section aria-labelledby="team-leaderboard-standard-heading">
          <h2
            id="team-leaderboard-standard-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--pw-text-muted)" }}
          >
            Rankings
          </h2>
          <ul className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: "var(--pw-border-default)" }}>
            {standardEntries.map((entry) => (
              <TeamRow key={entry.teamId} entry={entry} variant="standard" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
