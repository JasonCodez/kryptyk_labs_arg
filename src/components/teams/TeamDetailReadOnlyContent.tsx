"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  Coins,
  Crown,
  Gauge,
  Medal,
  Puzzle,
  Shield,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import type { ThemeConfig } from "@/lib/profileThemes";

export interface TeamDetailMember {
  user: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  };
  role: string;
}

export interface TeamDetailContributor {
  userId: string;
  name: string | null;
  image: string | null;
  role: string;
  joinedAt: string | null;
  earnedPoints: number;
  puzzlesSolved: number;
}

export interface TeamDetailActivity {
  userName: string | null;
  userImage: string | null;
  puzzleTitle: string | null;
  puzzleType: string | null;
  difficulty: string | null;
  pointsEarned: number;
  solvedAt: string | null;
}

export interface TeamDetailStatsData {
  rank: number;
  totalTeams: number;
  totalEarnedPoints: number;
  totalPuzzlesSolved: number;
  avgPointsPerMember: number;
  memberCount: number;
  topContributors: TeamDetailContributor[];
  recentActivity: TeamDetailActivity[];
}

export interface TeamDetailReadOnlyContentProps {
  members: TeamDetailMember[];
  stats: TeamDetailStatsData | null;
  statsLoading: boolean;
  theme: ThemeConfig;
  renderMemberAction?: (member: TeamDetailMember) => ReactNode;
}

const BORDER_STYLE = { borderColor: "var(--pw-border-default)" };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isContributor(value: unknown): value is TeamDetailContributor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.userId === "string" &&
    (typeof c.name === "string" || c.name === null) &&
    (typeof c.image === "string" || c.image === null) &&
    typeof c.role === "string" &&
    (typeof c.joinedAt === "string" || c.joinedAt === null) &&
    isFiniteNumber(c.earnedPoints) &&
    isFiniteNumber(c.puzzlesSolved)
  );
}

function isActivity(value: unknown): value is TeamDetailActivity {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  return (
    (typeof a.userName === "string" || a.userName === null) &&
    (typeof a.userImage === "string" || a.userImage === null) &&
    (typeof a.puzzleTitle === "string" || a.puzzleTitle === null) &&
    (typeof a.puzzleType === "string" || a.puzzleType === null) &&
    (typeof a.difficulty === "string" || a.difficulty === null) &&
    isFiniteNumber(a.pointsEarned) &&
    (typeof a.solvedAt === "string" || a.solvedAt === null)
  );
}

export function normalizeTeamDetailStats(value: unknown): TeamDetailStatsData | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    !isFiniteNumber(v.rank) ||
    !isFiniteNumber(v.totalTeams) ||
    !isFiniteNumber(v.totalEarnedPoints) ||
    !isFiniteNumber(v.totalPuzzlesSolved) ||
    !isFiniteNumber(v.avgPointsPerMember) ||
    !isFiniteNumber(v.memberCount)
  ) {
    return null;
  }

  const topContributors = Array.isArray(v.topContributors) ? v.topContributors.filter(isContributor) : [];
  const recentActivity = Array.isArray(v.recentActivity) ? v.recentActivity.filter(isActivity) : [];

  return {
    rank: v.rank,
    totalTeams: v.totalTeams,
    totalEarnedPoints: v.totalEarnedPoints,
    totalPuzzlesSolved: v.totalPuzzlesSolved,
    avgPointsPerMember: v.avgPointsPerMember,
    memberCount: v.memberCount,
    topContributors,
    recentActivity,
  };
}

export function getTeamPersonDisplayName(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Member";
}

export function getTeamPersonInitials(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "M";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "M";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function formatTeamDetailMetric(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString();
}

export function formatTeamDetailDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Date unavailable";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTeamActivityTime(value: string | null, now: number = Date.now()): string {
  if (!value) return "Time unavailable";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Time unavailable";
  const diffMs = now - ms;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ROLE_INFO: Record<string, { label: string; Icon: typeof Crown; color: string }> = {
  admin: { label: "Admin", Icon: Crown, color: "var(--pw-warning)" },
  moderator: { label: "Moderator", Icon: Shield, color: "var(--pw-brand-secondary)" },
};

export function getTeamRoleLabel(role: string | null | undefined): { label: string; Icon: typeof Crown; color: string } {
  const entry = role ? ROLE_INFO[role] : undefined;
  return entry ?? { label: "Member", Icon: UserRound, color: "var(--pw-text-secondary)" };
}

const DIFFICULTY_INFO: Record<string, { label: string; color: string }> = {
  easy: { label: "Easy", color: "var(--pw-success)" },
  medium: { label: "Medium", color: "var(--pw-warning)" },
  hard: { label: "Hard", color: "var(--pw-error-text)" },
};

export function getDifficultyTone(difficulty: string | null): { label: string; color: string } {
  const normalized = (difficulty ?? "").trim().toLowerCase();
  return DIFFICULTY_INFO[normalized] ?? { label: difficulty && difficulty.trim() ? difficulty : "Unknown", color: "var(--pw-text-secondary)" };
}

function AvatarOrInitials({ image, name, size }: { image: string | null; name: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const trimmedUrl = (image ?? "").trim();
  const showImage = trimmedUrl.length > 0 && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied/remote URLs
      <img
        src={trimmedUrl}
        alt=""
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, border: "1px solid var(--pw-border-default)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--pw-surface-2)",
        color: "var(--pw-text-secondary)",
        border: "1px solid var(--pw-border-default)",
      }}
    >
      {getTeamPersonInitials(name)}
    </span>
  );
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function ProfileIdentity({ userId, name, image }: { userId: string; name: string | null; image: string | null }) {
  const canLink = userId.trim().length > 0;
  const content = (
    <>
      <AvatarOrInitials image={image} name={name} size={36} />
      <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: "var(--pw-text-primary)" }}>
        {getTeamPersonDisplayName(name)}
      </span>
    </>
  );
  if (canLink) {
    return (
      <Link href={`/profile/${userId}`} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg ${FOCUS_RING}`}>
        {content}
      </Link>
    );
  }
  return <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5">{content}</span>;
}

const PLACEMENT: Record<number, { label: string; Icon: typeof Crown; color: string }> = {
  0: { label: "1st", Icon: Crown, color: "var(--pw-warning)" },
  1: { label: "2nd", Icon: Medal, color: "var(--pw-text-secondary)" },
  2: { label: "3rd", Icon: Award, color: "var(--pw-brand-secondary)" },
};

function StatCard({
  icon: Icon,
  label,
  loading,
  value,
  supporting,
}: {
  icon: typeof Trophy;
  label: string;
  loading: boolean;
  value: string;
  supporting?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border p-4" style={BORDER_STYLE}>
      <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pw-text-muted)" }}>
        <Icon aria-hidden="true" size={13} />
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-6 w-14 rounded" />
      ) : (
        <p className="text-xl font-bold tabular-nums sm:text-2xl" style={{ color: "var(--pw-text-primary)" }}>
          {value}
          {supporting && <span className="ml-1 text-xs font-normal" style={{ color: "var(--pw-text-muted)" }}>{supporting}</span>}
        </p>
      )}
    </div>
  );
}

export default function TeamDetailReadOnlyContent({
  members,
  stats,
  statsLoading,
  theme,
  renderMemberAction,
}: TeamDetailReadOnlyContentProps) {
  const rankValue = stats && Number.isFinite(stats.rank) && stats.rank > 0 ? `#${stats.rank}` : "—";
  const rankSupporting = stats && Number.isFinite(stats.totalTeams) && stats.totalTeams > 0 ? `of ${stats.totalTeams} teams` : undefined;

  const contributors = (stats?.topContributors ?? []).slice(0, 5);
  const leadingPoints = contributors.length > 0 && Number.isFinite(contributors[0]!.earnedPoints) && contributors[0]!.earnedPoints > 0
    ? contributors[0]!.earnedPoints
    : 0;

  const contributorById = new Map((stats?.topContributors ?? []).map((c) => [c.userId, c]));

  return (
    <div className="flex flex-col gap-6">
      {/* Statistics */}
      <div data-testid="team-detail-stats" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={Trophy} label="Rank" loading={statsLoading} value={rankValue} supporting={rankSupporting} />
        <StatCard icon={Coins} label="Team Points" loading={statsLoading} value={stats ? formatTeamDetailMetric(stats.totalEarnedPoints) : "—"} />
        <StatCard icon={Puzzle} label="Puzzles Solved" loading={statsLoading} value={stats ? formatTeamDetailMetric(stats.totalPuzzlesSolved) : "—"} />
        <StatCard icon={UsersRound} label="Members" loading={false} value={formatTeamDetailMetric(members.length)} />
        <StatCard icon={Gauge} label="Average Points" loading={statsLoading} value={stats ? formatTeamDetailMetric(stats.avgPointsPerMember) : "—"} />
      </div>

      {/* Top Contributors */}
      <section aria-labelledby="team-detail-contributors-heading" data-testid="team-detail-contributors" className="rounded-xl border p-5 sm:p-6" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, boxShadow: theme.cardGlow }}>
        <h2 id="team-detail-contributors-heading" className="mb-4 inline-flex items-center gap-2 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
          <TrendingUp aria-hidden="true" size={18} style={{ color: theme.accentText }} />
          Top Contributors
        </h2>
        {statsLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : contributors.length > 0 ? (
          <ul className="space-y-2">
            {contributors.map((c, i) => {
              const placement = PLACEMENT[i];
              const pct = Number.isFinite(c.earnedPoints) && c.earnedPoints > 0 && leadingPoints > 0
                ? Math.max(5, Math.round((c.earnedPoints / leadingPoints) * 100))
                : 0;
              return (
                <li key={c.userId || `${c.name}-${i}`} className="relative overflow-hidden rounded-lg border" style={BORDER_STYLE}>
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 opacity-10"
                    style={{ width: `${pct}%`, background: placement ? placement.color : "var(--pw-text-secondary)" }}
                  />
                  <div className="relative flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex w-9 shrink-0 items-center justify-center gap-1 text-xs font-bold"
                        style={{ color: placement ? placement.color : "var(--pw-text-secondary)" }}
                      >
                        {placement ? <placement.Icon aria-hidden="true" size={16} /> : <span>{`#${i + 1}`}</span>}
                      </span>
                      <ProfileIdentity userId={c.userId} name={c.name} image={c.image} />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>{formatTeamDetailMetric(c.earnedPoints)}</p>
                      <p className="text-xs tabular-nums" style={{ color: "var(--pw-text-muted)" }}>{formatTeamDetailMetric(c.puzzlesSolved)} solved</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--pw-text-muted)" }}>No contributor activity yet.</p>
        )}
      </section>

      {/* Recent Activity */}
      <section aria-labelledby="team-detail-activity-heading" data-testid="team-detail-activity" className="rounded-xl border p-5 sm:p-6" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, boxShadow: theme.cardGlow }}>
        <h2 id="team-detail-activity-heading" className="mb-4 inline-flex items-center gap-2 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
          <Activity aria-hidden="true" size={18} style={{ color: theme.primary }} />
          Recent Activity
        </h2>
        {statsLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (stats?.recentActivity.length ?? 0) > 0 ? (
          <ul className="space-y-2">
            {stats!.recentActivity.map((a, i) => {
              const tone = a.difficulty ? getDifficultyTone(a.difficulty) : null;
              const validPoints = Number.isFinite(a.pointsEarned) && a.pointsEarned >= 0;
              return (
                <li key={`${a.userName}-${a.solvedAt}-${i}`} className="flex items-center gap-3 rounded-lg border p-3" style={BORDER_STYLE}>
                  <AvatarOrInitials image={a.userImage} name={a.userName} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" style={{ color: "var(--pw-text-primary)" }}>
                      <span className="font-semibold">{getTeamPersonDisplayName(a.userName)}</span> solved{" "}
                      <span style={{ color: theme.primary }}>{a.puzzleTitle ?? "a puzzle"}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--pw-text-muted)" }}>
                      {tone && (
                        <span className="rounded px-1.5 py-0.5 font-semibold" style={{ background: "var(--pw-surface-2)", color: tone.color }}>
                          {tone.label}
                        </span>
                      )}
                      <span>{validPoints ? `+${formatTeamDetailMetric(a.pointsEarned)} ${a.pointsEarned === 1 ? "point" : "points"}` : "Points unavailable"}</span>
                      <span>{formatTeamActivityTime(a.solvedAt)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--pw-text-muted)" }}>No recent puzzle activity.</p>
        )}
      </section>

      {/* Members */}
      <section aria-labelledby="team-detail-members-heading" data-testid="team-detail-members" className="rounded-xl border p-5 sm:p-6" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, boxShadow: theme.cardGlow }}>
        <h2 id="team-detail-members-heading" className="mb-4 inline-flex items-center gap-2 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
          <UsersRound aria-hidden="true" size={18} style={{ color: theme.primary }} />
          Members
          <span className="text-sm font-normal" style={{ color: "var(--pw-text-muted)" }}>({members.length})</span>
        </h2>
        {members.length > 0 ? (
          <ul className="space-y-2">
            {members.map((member) => {
              const contributor = contributorById.get(member.user.id);
              const role = getTeamRoleLabel(member.role);
              return (
                <li
                  key={member.user.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  style={BORDER_STYLE}
                >
                  <ProfileIdentity userId={member.user.id} name={member.user.name} image={member.user.image} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: "var(--pw-surface-2)", color: role.color }}
                    >
                      <role.Icon aria-hidden="true" size={12} />
                      {role.label}
                    </span>
                    {contributor?.joinedAt && (
                      <span className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                        Joined {formatTeamDetailDate(contributor.joinedAt)}
                      </span>
                    )}
                    {stats && contributor && (
                      <span className="text-xs tabular-nums" style={{ color: "var(--pw-text-muted)" }}>
                        {formatTeamDetailMetric(contributor.puzzlesSolved)} solved · {formatTeamDetailMetric(contributor.earnedPoints)} pts
                      </span>
                    )}
                    {renderMemberAction?.(member)}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--pw-text-muted)" }}>No members to display.</p>
        )}
      </section>
    </div>
  );
}
