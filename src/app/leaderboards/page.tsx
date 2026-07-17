"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  email?: string;
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

type Tab = "global" | "following" | "weekly" | "monthly";

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function getCountdownUrgency(endsAt: string): { color: string; glow: string } {
  const hoursLeft = (new Date(endsAt).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft <= 6) return { color: "#FF5A5A", glow: "rgba(255,90,90,0.5)" };
  if (hoursLeft <= 48) return { color: "#FFC93C", glow: "rgba(255,201,60,0.5)" };
  return { color: "#8B3DFF", glow: "rgba(139,61,255,0.4)" };
}

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
 * than a table so it reflows cleanly at any width instead of hiding columns/scrolling. */
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

export default function LeaderboardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [periodEntries, setPeriodEntries] = useState<PeriodEntry[]>([]);
  const [periodUserRank, setPeriodUserRank] = useState<PeriodEntry | null>(null);
  const [periodEndsAt, setPeriodEndsAt] = useState<string | null>(null);
  const [periodRewardTiers, setPeriodRewardTiers] = useState<RewardTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchLeaderboard(activeTab);
    }

  }, [session?.user?.email, activeTab]);

  const fetchLeaderboard = async (tab: Tab) => {
    setLoading(true);
    setError("");
    try {
      if (tab === "weekly" || tab === "monthly") {
        const res = await fetch(`/api/leaderboards/period?type=${tab}`);
        if (!res.ok) throw new Error("Failed to fetch period leaderboard");
        const data = await res.json();
        setPeriodEntries(data.entries ?? []);
        setPeriodUserRank(data.userRank ?? null);
        setPeriodEndsAt(data.endsAt ?? null);
        setPeriodRewardTiers(data.rewardTiers ?? []);
        return;
      }
      const url = tab === "following" ? "/api/leaderboards/following" : "/api/leaderboards/global";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      setEntries(data.entries);
      setUserRank(data.userRank);
      if (tab === "following") setFollowingCount(data.followingCount ?? 0);
    } catch (err) {
      setError("Failed to load leaderboard");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time updates: re-fetch when any player solves a puzzle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => fetchLeaderboard(activeTab);
    window.addEventListener("puzzlewarz:puzzle-solved", handler);
    return () => window.removeEventListener("puzzlewarz:puzzle-solved", handler);

  }, [activeTab]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#170B26" }}>
        <div style={{ color: "#FFC93C" }} className="text-lg">Loading leaderboard...</div>
      </div>
    );
  }

  const currentUserId = (session?.user as any)?.id;

  return (
    <div
      style={{
        background:
          "radial-gradient(1300px 800px at 15% -10%, rgba(139,61,255,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,60,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(62,217,122,0.09), transparent 60%), #170B26",
      }}
      className="min-h-screen"
    >
      <div className="px-3 sm:px-8 pt-24 sm:pt-28 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
              <Link
                href="/dashboard"
                className="inline-block px-3.5 sm:px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all text-sm font-medium"
                style={{ background: "var(--pw-surface-hi)", border: "1px solid rgba(139,61,255,0.3)" }}
              >
                ← Back to Dashboard
              </Link>

              <Link
                href="/leaderboards/teams"
                className="px-3.5 sm:px-4 py-2 text-sm rounded-lg font-semibold transition-all whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #FF4FA3, #C7157A)",
                  color: "#170B26",
                  boxShadow: "0 0 14px rgba(255,79,163,0.4)",
                }}
              >
                Team Leaderboards
              </Link>
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">🏆 All-Time Leaderboard</h1>
              <p style={{ color: "#EEF1FA" }} className="text-sm sm:text-base">
                Top players solving puzzles and earning points
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
              {(
                [
                  { id: "global", label: "🌍 Global" },
                  { id: "weekly", label: "📅 Weekly" },
                  { id: "monthly", label: "🗓️ Monthly" },
                  { id: "following", label: "👥 Following" },
                ] as { id: Tab; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="shrink-0 px-4 sm:px-5 py-2 rounded-lg font-semibold text-sm transition-all"
                  style={{
                    background: activeTab === id ? "linear-gradient(135deg, #FF4FA3, #C7157A)" : "var(--pw-surface-hi)",
                    color: activeTab === id ? "#170B26" : "#FF4FA3",
                    border: "1px solid rgba(255,79,163,0.35)",
                    boxShadow: activeTab === id ? "0 0 14px rgba(255,79,163,0.4)" : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: "rgba(255,90,90,0.1)", borderColor: "rgba(255,90,90,0.4)" }}>
              {error}
            </div>
          )}

          {/* Following empty state */}
          {activeTab === "following" && !loading && followingCount === 0 && (
            <div className="mb-6 pw-surface pw-bevel p-6 text-center">
              <p className="text-2xl mb-2">👥</p>
              <p className="text-white font-semibold mb-1">You&apos;re not following anyone yet</p>
              <p className="text-sm mb-4" style={{ color: "#8891AC" }}>Follow players from the Global leaderboard or their profile pages to see them here.</p>
              <button
                onClick={() => setActiveTab("global")}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, #FF4FA3, #C7157A)", color: "#170B26" }}
              >
                Browse Global Leaderboard
              </button>
            </div>
          )}

          {/* ── Period (weekly / monthly) view ─────────────────────────────── */}
          {(activeTab === "weekly" || activeTab === "monthly") && (
            <>
              {/* Countdown + reward info */}
              <div className="mb-4 sm:mb-6 grid gap-3 sm:gap-4 sm:grid-cols-[220px_1fr] min-w-0">
                {periodEndsAt && (() => {
                  const urgency = getCountdownUrgency(periodEndsAt);
                  return (
                    <div className="pw-surface pw-bevel p-4" style={{ borderColor: urgency.color + "55" }}>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: urgency.color }}>⏳ Time Remaining</p>
                      <p className="text-xl font-bold text-white" style={{ textShadow: `0 0 16px ${urgency.glow}` }}>{formatCountdown(periodEndsAt)}</p>
                      <p className="text-xs mt-1" style={{ color: "#5B6483" }}>
                        Ends {new Date(periodEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  );
                })()}
                <RewardTiers tiers={periodRewardTiers} periodLabel={activeTab === "weekly" ? "Week" : "Month"} />
              </div>

              {/* Your period rank */}
              {periodUserRank && (
                <div
                  className="mb-6 sm:mb-8 pw-surface pw-bevel p-4 sm:p-6 relative overflow-hidden"
                  style={{
                    borderColor: "rgba(139,61,255,0.4)",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12)",
                  }}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm font-bold uppercase tracking-wide" style={{ color: "#8891AC" }}>
                        Your Rank This {activeTab === "weekly" ? "Week" : "Month"}
                      </p>
                      <p className="text-3xl font-bold text-white">#{periodUserRank.rank}</p>
                      {periodUserRank.rank <= 50 && (
                        <span
                          className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(62,217,122,0.15)", color: "#3ED97A" }}
                        >
                          ✓ In the reward zone
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-4xl sm:text-5xl font-bold" style={{ color: "#FFC93C" }}>{periodUserRank.periodPoints.toLocaleString()}</p>
                      <p className="text-sm" style={{ color: "#EEF1FA" }}>{periodUserRank.puzzlesSolved} puzzles solved</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Period rows */}
              <div className="pw-surface pw-bevel overflow-hidden">
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
                {periodEntries.length === 0 && (
                  <div className="p-8 text-center" style={{ color: "#8891AC" }}>
                    No activity yet this {activeTab === "weekly" ? "week" : "month"}. Solve a puzzle to appear here!
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Global / Following view ─────────────────────────────────────── */}
          {(activeTab === "global" || activeTab === "following") && (
            <>
              {/* Your Rank Card */}
              {userRank && (
                <div
                  className="mb-6 sm:mb-8 pw-surface pw-bevel p-4 sm:p-6 relative overflow-hidden"
                  style={{
                    borderColor: "rgba(139,61,255,0.4)",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12)",
                  }}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs sm:text-sm font-bold uppercase tracking-wide" style={{ color: "#8891AC" }}>
                        {activeTab === "following" ? "Your Rank (Among Following)" : "Your Rank"}
                      </p>
                      <p className="text-3xl font-bold text-white">#{userRank.rank}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl sm:text-5xl font-bold" style={{ color: "#FFC93C" }}>{userRank.totalPoints.toLocaleString()}</p>
                      <p className="text-sm" style={{ color: "#EEF1FA" }}>{userRank.puzzlesSolved} puzzles solved</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard rows */}
              <div className="pw-surface pw-bevel overflow-hidden">
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
                {entries.length === 0 && (
                  <div className="p-8 text-center" style={{ color: "#8891AC" }}>
                    No players yet. Be the first to solve a puzzle!
                  </div>
                )}
              </div>

              {/* Info Footer */}
              <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="pw-surface pw-bevel p-4">
                  <p className="text-sm mb-1" style={{ color: "#8891AC" }}>🥇 Top Players</p>
                  <p className="text-2xl font-bold text-white">{entries.length}</p>
                </div>
                <div className="pw-surface pw-bevel p-4">
                  <p className="text-sm mb-1" style={{ color: "#8891AC" }}>📊 Total Points</p>
                  <p className="text-2xl font-bold text-white">
                    {entries.reduce((sum, e) => sum + e.totalPoints, 0).toLocaleString()}
                  </p>
                </div>
                <div className="pw-surface pw-bevel p-4">
                  <p className="text-sm mb-1" style={{ color: "#8891AC" }}>🧩 Puzzles Solved</p>
                  <p className="text-2xl font-bold text-white">
                    {entries.reduce((sum, e) => sum + e.puzzlesSolved, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
