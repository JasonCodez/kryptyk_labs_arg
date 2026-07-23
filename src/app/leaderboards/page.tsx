"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Trophy, UserPlus } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import LeaderboardIntroCard from "@/components/onboarding/LeaderboardIntroCard";
import LeaderboardHeader from "@/components/leaderboards/LeaderboardHeader";
import LeaderboardTabs, { type LeaderboardTab } from "@/components/leaderboards/LeaderboardTabs";
import LeaderboardRankSummary from "@/components/leaderboards/LeaderboardRankSummary";
import LeaderboardLoadingState from "@/components/leaderboards/LeaderboardLoadingState";

interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  activeFlair: string;
  isPremium?: boolean;
  totalPoints: number;
  puzzlesSolved: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface PeriodEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  activeFlair: string;
  isPremium?: boolean;
  periodPoints: number;
  puzzlesSolved: number;
  rank: number;
}

interface RewardTier {
  rank: number | string;
  points: number;
  xp: number;
}

export function formatCountdown(endsAt: string, nowMs = Date.now()): string {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return "Schedule unavailable";
  const diff = end - nowMs;
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

type CountdownUrgency = "normal" | "warning" | "critical";

export function getCountdownUrgency(endsAt: string, nowMs = Date.now()): CountdownUrgency {
  const hoursLeft = (new Date(endsAt).getTime() - nowMs) / 3_600_000;
  if (!Number.isFinite(hoursLeft)) return "normal";
  if (hoursLeft <= 6) return "critical";
  if (hoursLeft <= 48) return "warning";
  return "normal";
}

const URGENCY_COLOR: Record<CountdownUrgency, string> = {
  normal: "var(--pw-brand-primary)",
  warning: "var(--pw-warning)",
  critical: "var(--pw-error-text)",
};

// ── Frozen for Pass 14 — do not redesign row mechanics or visual styling ──

const RANK_STYLE: Record<number, { color: string; glow: string; ring: string }> = {
  1: { color: "#FFC93C", glow: "rgba(255,201,60,0.5)", ring: "#FFC93C" },
  2: { color: "#EEF1FA", glow: "rgba(236,232,247,0.35)", ring: "#8891AC" },
  3: { color: "#E8934A", glow: "rgba(232,147,74,0.45)", ring: "#E8934A" },
};

function getMedalEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

/** Shared row for both the all-time and weekly/monthly leaderboards — flex-based rather
 * than a table so it reflows cleanly at any width instead of hiding columns/scrolling.
 * Frozen for Pass 14 — mechanics and visual styling are not part of Pass 13. */
function LeaderboardRow({
  rank,
  userId,
  userName,
  userImage,
  isPremium,
  activeFlair,
  points,
  puzzlesSolved,
  isCurrentUser,
}: {
  rank: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  isPremium?: boolean;
  activeFlair?: string;
  points: number;
  puzzlesSolved: number;
  isCurrentUser: boolean;
}) {
  const podium = RANK_STYLE[rank];
  const medal = getMedalEmoji(rank);

  return (
    <div
      className={`relative overflow-hidden transition-colors${podium ? " shadow-skeu-raised-sm" : ""}`}
      style={{
        borderBottom: "1px solid var(--pw-line)",
        borderLeft: podium ? `3px solid ${podium.color}` : isCurrentUser ? "3px solid #8B3DFF" : "3px solid transparent",
      }}
    >
      {podium && <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.4 }} />}
      <div
        className="relative flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4"
        style={{
          background: isCurrentUser
            ? "linear-gradient(160deg, rgba(139,61,255,0.16), rgba(139,61,255,0.05))"
            : "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
        }}
      >
        {/* Rank */}
        <div
          className="shrink-0 flex items-center justify-center font-mono font-bold text-sm"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            color: podium ? podium.color : "#8891AC",
            background: podium ? "rgba(255,255,255,0.06)" : "transparent",
            boxShadow: podium ? `0 0 14px ${podium.glow}` : undefined,
            fontSize: medal ? 17 : 13,
          }}
        >
          {medal || rank}
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <img
            src={userImage || "/images/default-avatar.svg"}
            alt=""
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover flex-shrink-0"
            style={{
              border: podium ? `2px solid ${podium.ring}` : "1px solid rgba(255,255,255,0.1)",
              boxShadow: podium ? `0 0 10px ${podium.glow}` : undefined,
            }}
            onError={(e) => { const img = e.currentTarget; img.onerror = null; img.src = "/images/default-avatar.svg"; }}
          />
          <div className="min-w-0">
            {userId ? (
              <Link href={`/profile/${userId}`} className="text-white font-semibold hover:underline hover:text-[#FF4FA3] truncate block text-sm sm:text-base">
                {userName || "Anonymous"}
                {isPremium ? <span style={{ display: "inline-block", transform: "translateY(-1px)" }}> 💎</span> : ""}
                {activeFlair && activeFlair !== "none" ? <span style={{ display: "inline-block", transform: "translateY(-1px)" }}> {activeFlair}</span> : ""}
              </Link>
            ) : (
              <span className="text-white font-semibold truncate block text-sm sm:text-base">{userName || "Anonymous"}</span>
            )}
            <p className="text-xs sm:hidden" style={{ color: "#5B6483" }}>{puzzlesSolved} solved</p>
          </div>
        </div>

        {/* Puzzles solved — desktop only, mobile shows it as subtext above */}
        <div className="hidden sm:block shrink-0 text-sm w-20 text-center" style={{ color: "#8891AC" }}>
          {puzzlesSolved} solved
        </div>

        {/* Points */}
        <div className="shrink-0 text-right">
          <span className="text-base sm:text-lg font-bold" style={{ color: "#FFC93C" }}>{points.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

/** Frozen for Pass 14 — mechanics and visual styling are not part of Pass 13. */
function RewardTiers({ tiers, periodLabel }: { tiers: RewardTier[]; periodLabel: string }) {
  if (tiers.length === 0) return null;
  return (
    <div className="pw-surface pw-bevel p-4 sm:p-5 min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#FFC93C" }}>
        🏆 End-of-{periodLabel} Rewards <span style={{ color: "#5B6483" }}>· Top 50</span>
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 sm:flex-wrap no-scrollbar min-w-0">
        {tiers.map((t) => (
          <div
            key={String(t.rank)}
            className="shrink-0 rounded-lg px-3.5 py-2.5 min-w-[104px]"
            style={{
              background: "linear-gradient(160deg, rgba(255,201,60,0.1), rgba(139,61,255,0.06))",
              border: "1px solid rgba(255,201,60,0.25)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "#EEF1FA" }}>
              Rank #{t.rank}
            </p>
            <p className="text-sm font-bold" style={{ color: "#FFC93C" }}>{t.points.toLocaleString()} pts</p>
            <p className="text-xs font-semibold" style={{ color: "#8B3DFF" }}>+{t.xp} XP</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── New for Pass 13 ──────────────────────────────────────────────────────

const ACTION_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border p-6 text-center sm:p-8"
      style={{
        borderColor: "var(--pw-error-text)",
        background: "color-mix(in srgb, var(--pw-error-text) 8%, var(--pw-surface-1))",
      }}
    >
      <h2 className="text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
        We couldn’t load this leaderboard
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold ${ACTION_FOCUS}`}
        style={{ minHeight: 48, background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
      >
        <RefreshCw aria-hidden="true" size={16} />
        <span>Try Again</span>
      </button>
    </div>
  );
}

function RefreshWarning() {
  return (
    <div
      role="status"
      className="rounded-lg border p-3 text-sm"
      style={{
        borderColor: "var(--pw-warning)",
        background: "color-mix(in srgb, var(--pw-warning) 10%, var(--pw-surface-1))",
        color: "var(--pw-text-secondary)",
      }}
    >
      Couldn’t refresh just now — showing the last known rankings.
    </div>
  );
}

function EmptyStatePanel({
  heading,
  copy,
  action,
}: {
  heading: string;
  copy: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-6 text-center sm:p-8"
      style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
    >
      <h2 className="text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>{heading}</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>{copy}</p>
      <div className="mt-4 flex justify-center">{action}</div>
    </div>
  );
}

function BrowsePuzzlesAction() {
  return (
    <Link
      href="/puzzles"
      className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold ${ACTION_FOCUS}`}
      style={{ minHeight: 48, background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
    >
      <Trophy aria-hidden="true" size={16} />
      <span>Browse Puzzles</span>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

type LeaderboardLoadStatus = "loading" | "ready" | "error";
type FetchMode = "foreground" | "background";

export default function LeaderboardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [followingCount, setFollowingCount] = useState(0);

  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>([]);
  const [periodUserRank, setPeriodUserRank] = useState<PeriodEntry | null>(null);
  const [periodEndsAt, setPeriodEndsAt] = useState<string | null>(null);
  const [periodRewardTiers, setPeriodRewardTiers] = useState<RewardTier[]>([]);

  const [loadStatus, setLoadStatus] = useState<LeaderboardLoadStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const requestSeqRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchLeaderboard = useCallback(async (tab: LeaderboardTab, mode: FetchMode = "foreground") => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const seq = ++requestSeqRef.current;

    if (mode === "foreground") setLoadStatus("loading");
    else setRefreshing(true);

    try {
      if (tab === "weekly" || tab === "monthly") {
        const response = await fetch(`/api/leaderboards/period?type=${tab}`, { signal: controller.signal });
        if (!response.ok) throw new Error("request-failed");
        const data = await response.json();
        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        setPeriodEntries(Array.isArray(data.entries) ? data.entries : []);
        setPeriodUserRank(data.userRank ?? null);
        setPeriodEndsAt(typeof data.endsAt === "string" ? data.endsAt : null);
        setPeriodRewardTiers(Array.isArray(data.rewardTiers) ? data.rewardTiers : []);
      } else {
        const url = tab === "following" ? "/api/leaderboards/following" : "/api/leaderboards/global";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("request-failed");
        const data = await response.json();
        if (!mountedRef.current || seq !== requestSeqRef.current) return;
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setUserRank(data.userRank ?? null);
        if (tab === "following") setFollowingCount(typeof data.followingCount === "number" ? data.followingCount : 0);
      }
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      setLoadStatus("ready");
      setRefreshFailed(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || seq !== requestSeqRef.current || !mountedRef.current) return;
      if (mode === "background") setRefreshFailed(true);
      else setLoadStatus("error");
    } finally {
      if (seq === requestSeqRef.current && mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard, status]);

  // Real-time updates: refresh the active tab in the background when any player solves a puzzle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => void fetchLeaderboard(activeTab, "background");
    window.addEventListener("puzzlewarz:puzzle-solved", handler);
    return () => window.removeEventListener("puzzlewarz:puzzle-solved", handler);
  }, [activeTab, fetchLeaderboard]);

  useEffect(() => () => {
    mountedRef.current = false;
    requestSeqRef.current += 1;
    requestAbortRef.current?.abort();
  }, []);

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const isAuthenticated = status === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;

  const isPeriodTab = activeTab === "weekly" || activeTab === "monthly";
  const isBootLoading = status !== "authenticated" || loadStatus === "loading";

  const activeRank = isPeriodTab ? periodUserRank?.rank ?? null : userRank?.rank ?? null;
  const activePoints = isPeriodTab ? periodUserRank?.periodPoints ?? null : userRank?.totalPoints ?? null;
  const activePuzzlesSolved = isPeriodTab ? periodUserRank?.puzzlesSolved ?? null : userRank?.puzzlesSolved ?? null;

  void refreshing;

  return (
    <div className="min-h-screen" style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
      <PageContainer size="content" className="py-8">
        <div className="flex flex-col gap-6">
          <LeaderboardHeader activeTab={activeTab} />
          <LeaderboardTabs activeTab={activeTab} onChange={setActiveTab} loading={loadStatus === "loading"} />

          {isAuthenticated && onboardingUserId && <LeaderboardIntroCard userId={onboardingUserId} />}

          <div
            role="tabpanel"
            id={`leaderboard-panel-${activeTab}`}
            aria-labelledby={`leaderboard-tab-${activeTab}`}
            aria-busy={isBootLoading}
            className="flex flex-col gap-6"
          >
            {isBootLoading ? (
              <LeaderboardLoadingState activeTab={activeTab} />
            ) : loadStatus === "error" ? (
              <ErrorPanel onRetry={() => void fetchLeaderboard(activeTab)} />
            ) : (
              <>
                {isPeriodTab && (
                  <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                    {periodEndsAt && (() => {
                      const urgency = getCountdownUrgency(periodEndsAt);
                      return (
                        <div className="rounded-xl border p-4" style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}>
                          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: URGENCY_COLOR[urgency] }}>
                            Time Remaining
                          </p>
                          <p className="text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>{formatCountdown(periodEndsAt)}</p>
                          {urgency === "critical" && (
                            <p className="text-xs font-bold" style={{ color: "var(--pw-error-text)" }}>Closing soon</p>
                          )}
                          <p className="mt-1 text-xs" style={{ color: "var(--pw-text-muted)" }}>
                            Ends {new Date(periodEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      );
                    })()}
                    <RewardTiers tiers={periodRewardTiers} periodLabel={activeTab === "weekly" ? "Week" : "Month"} />
                  </div>
                )}

                <LeaderboardRankSummary
                  activeTab={activeTab}
                  rank={activeRank}
                  points={activePoints}
                  puzzlesSolved={activePuzzlesSolved}
                  followingCount={followingCount}
                />

                {refreshFailed && <RefreshWarning />}

                {activeTab === "following" && followingCount === 0 && (
                  <EmptyStatePanel
                    heading="Build your comparison group"
                    copy="Follow players from the Global leaderboard or their profile pages to compare your progress here."
                    action={
                      <button
                        type="button"
                        onClick={() => setActiveTab("global")}
                        className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold ${ACTION_FOCUS}`}
                        style={{ minHeight: 48, background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
                      >
                        <UserPlus aria-hidden="true" size={16} />
                        <span>Browse Global Leaderboard</span>
                      </button>
                    }
                  />
                )}

                {isPeriodTab ? (
                  periodEntries.length === 0 ? (
                    <EmptyStatePanel
                      heading={activeTab === "weekly" ? "No weekly activity yet" : "No monthly activity yet"}
                      copy={
                        activeTab === "weekly"
                          ? "Solve a puzzle this week to enter the rankings."
                          : "Solve a puzzle this month to enter the rankings."
                      }
                      action={<BrowsePuzzlesAction />}
                    />
                  ) : (
                    <div className="pw-surface pw-bevel overflow-hidden rounded-xl">
                      {periodEntries.map((entry) => (
                        <LeaderboardRow
                          key={entry.userId}
                          rank={entry.rank}
                          userId={entry.userId}
                          userName={entry.userName}
                          userImage={entry.userImage}
                          isPremium={entry.isPremium}
                          activeFlair={entry.activeFlair}
                          points={entry.periodPoints}
                          puzzlesSolved={entry.puzzlesSolved}
                          isCurrentUser={entry.userId === currentUserId}
                        />
                      ))}
                    </div>
                  )
                ) : activeTab === "global" && entries.length === 0 ? (
                  <EmptyStatePanel
                    heading="No ranked players yet"
                    copy="Solve a puzzle to claim a place on the leaderboard."
                    action={<BrowsePuzzlesAction />}
                  />
                ) : entries.length > 0 ? (
                  <>
                    <div className="pw-surface pw-bevel overflow-hidden rounded-xl">
                      {entries.map((entry) => (
                        <LeaderboardRow
                          key={entry.userId}
                          rank={entry.rank}
                          userId={entry.userId}
                          userName={entry.userName}
                          userImage={entry.userImage}
                          isPremium={entry.isPremium}
                          activeFlair={entry.activeFlair}
                          points={entry.totalPoints}
                          puzzlesSolved={entry.puzzlesSolved}
                          isCurrentUser={entry.userId === currentUserId}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                      <div className="rounded-xl border p-4" style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}>
                        <p className="mb-1 text-sm" style={{ color: "var(--pw-text-muted)" }}>Top Players</p>
                        <p className="text-2xl font-bold" style={{ color: "var(--pw-text-primary)" }}>{entries.length}</p>
                      </div>
                      <div className="rounded-xl border p-4" style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}>
                        <p className="mb-1 text-sm" style={{ color: "var(--pw-text-muted)" }}>Total Points</p>
                        <p className="text-2xl font-bold" style={{ color: "var(--pw-text-primary)" }}>
                          {entries.reduce((sum, e) => sum + e.totalPoints, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border p-4" style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}>
                        <p className="mb-1 text-sm" style={{ color: "var(--pw-text-muted)" }}>Puzzles Solved</p>
                        <p className="text-2xl font-bold" style={{ color: "var(--pw-text-primary)" }}>
                          {entries.reduce((sum, e) => sum + e.puzzlesSolved, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
