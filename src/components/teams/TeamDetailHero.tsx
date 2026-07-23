"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Crown, Lock, Shield, Trophy, UserRound, UsersRound } from "lucide-react";
import type { ThemeConfig } from "@/lib/profileThemes";

export interface TeamDetailHeroProps {
  teamId: string;
  name: string | null;
  description: string | null;
  isPublic: boolean;
  createdAt: string | null;
  userRole: string | null;
  rank: number | null;
  totalTeams: number | null;
  theme: ThemeConfig;
  actions?: ReactNode;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function getHeroDisplayName(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unnamed Team";
}

function getHeroInitials(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "T";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

function isValidRank(rank: number | null): rank is number {
  return typeof rank === "number" && Number.isFinite(rank) && rank > 0;
}

function formatHeroDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Date unavailable";
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const ROLE_LABEL: Record<string, { label: string; Icon: typeof Crown }> = {
  admin: { label: "Admin", Icon: Crown },
  moderator: { label: "Moderator", Icon: Shield },
  member: { label: "Member", Icon: UserRound },
};

export default function TeamDetailHero({
  teamId,
  name,
  description,
  isPublic,
  createdAt,
  userRole,
  rank,
  totalTeams,
  theme,
  actions,
}: TeamDetailHeroProps) {
  const roleEntry = userRole ? ROLE_LABEL[userRole] ?? ROLE_LABEL.member : null;
  const RoleIcon = roleEntry?.Icon ?? UserRound;
  const trimmedDescription = (description ?? "").trim();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href="/teams"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${FOCUS_RING}`}
          style={{
            borderColor: "var(--pw-border-default)",
            background: "var(--pw-surface-1)",
            color: "var(--pw-text-secondary)",
          }}
        >
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Back to Teams</span>
        </Link>
        <Link
          href="/leaderboards/teams"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${FOCUS_RING}`}
          style={{ background: "var(--pw-brand-secondary)", color: "var(--pw-bg-base)" }}
        >
          <Trophy aria-hidden="true" size={18} />
          <span>Team Leaderboards</span>
        </Link>
      </div>

      <div
        className="rounded-2xl border p-5 sm:p-8"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, boxShadow: theme.cardGlow }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold sm:h-16 sm:w-16"
            style={{ background: theme.primaryMuted, color: theme.primary, border: `1px solid ${theme.primaryBorder}` }}
          >
            {getHeroInitials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
              {getHeroDisplayName(name)}
            </h1>
            {trimmedDescription.length > 0 && (
              <p className="mt-1 break-words text-sm sm:text-base" style={{ color: theme.subtleText }}>
                {trimmedDescription}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isPublic ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: "var(--pw-surface-2)", color: "var(--pw-text-secondary)" }}
                >
                  <UsersRound aria-hidden="true" size={13} />
                  Public
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: "var(--pw-surface-2)", color: "var(--pw-text-secondary)" }}
                >
                  <Lock aria-hidden="true" size={13} />
                  Private
                </span>
              )}
              {isValidRank(rank) && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: theme.primaryMuted, color: theme.accentText, border: `1px solid ${theme.primaryBorder}` }}
                >
                  <Trophy aria-hidden="true" size={13} />
                  Rank #{rank}
                  {typeof totalTeams === "number" && Number.isFinite(totalTeams) && totalTeams > 0 && (
                    <span> of {totalTeams} teams</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.subtleText }}>
              Created
            </dt>
            <dd className="mt-1 text-sm" style={{ color: "var(--pw-text-primary)" }}>
              {formatHeroDate(createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.subtleText }}>
              Your role
            </dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--pw-text-primary)" }}>
              <RoleIcon aria-hidden="true" size={15} />
              {roleEntry ? roleEntry.label : "Not a member"}
            </dd>
          </div>
          {userRole && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.subtleText }}>
                Team code
              </dt>
              <dd className="mt-1">
                <code
                  className="rounded px-2 py-1 font-mono text-xs"
                  style={{ color: theme.primary, backgroundColor: theme.inputBg }}
                >
                  {teamId.slice(0, 8)}
                </code>
              </dd>
            </div>
          )}
        </dl>

        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
