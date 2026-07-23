"use client";

import { Coins, Sparkles, Trophy } from "lucide-react";

export interface LeaderboardRewardTier {
  rank: number | string;
  points: number;
  xp: number;
}

export interface LeaderboardRewardTiersProps {
  tiers: LeaderboardRewardTier[];
  periodLabel: "Week" | "Month";
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString();
}

const IRREGULAR_ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

function ordinal(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (IRREGULAR_ORDINALS[n]) return IRREGULAR_ORDINALS[n];
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatRewardRankLabel(rank: unknown): string {
  if (typeof rank === "number") {
    if (!Number.isFinite(rank) || rank < 1) return "Rank";
    if (rank === 1) return "1st Place";
    if (rank === 2) return "2nd Place";
    if (rank === 3) return "3rd Place";
    return `Rank #${rank}`;
  }

  if (typeof rank !== "string") return "Rank";

  const trimmed = rank.trim();
  if (!trimmed) return "Rank";

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    return `${ordinal(start)}–${ordinal(end)}`;
  }

  // An unfamiliar but non-empty string — preserve it rather than guessing.
  return trimmed;
}

export default function LeaderboardRewardTiers({ tiers, periodLabel }: LeaderboardRewardTiersProps) {
  if (tiers.length === 0) return null;

  return (
    <div data-testid="leaderboard-reward-tiers" className="min-w-0 rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}>
      <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pw-brand-secondary)" }}>
        <Trophy aria-hidden="true" size={14} />
        {periodLabel === "Week" ? "Weekly rewards" : "Monthly rewards"}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--pw-text-muted)" }}>
        Final standings determine rewards after the period ends.
      </p>
      <ul className="mt-3 grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {tiers.map((tier) => (
          <li
            key={String(tier.rank)}
            className="min-w-0 w-full rounded-lg border px-3.5 py-2.5"
            style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-2)" }}
          >
            <p className="break-words text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>
              {formatRewardRankLabel(tier.rank)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
              <Coins aria-hidden="true" size={13} />
              {formatMetric(tier.points)} Points
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
              <Sparkles aria-hidden="true" size={12} />
              {formatMetric(tier.xp)} XP
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
