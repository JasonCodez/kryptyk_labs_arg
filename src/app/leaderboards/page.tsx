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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#FDE74C' }} className="text-lg">Loading leaderboard...</div>
      </div>
    );
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank.toString();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-orange-400";
    return "text-slate-400";
  };

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      <div className="px-4 sm:px-8 pt-28 pb-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: '#2a3a3b', borderColor: '#3891A6' }}
            >
              ← Back to Dashboard
            </Link>

            <Link
              href="/leaderboards/teams"
              className="px-4 py-2 text-white rounded-lg font-semibold transition-all whitespace-nowrap"
              style={{ backgroundColor: '#3891A6' }}
            >
              Team Leaderboards
            </Link>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🏆 All-Time Leaderboard</h1>
            <p style={{ color: '#DDDBF1' }}>
              Top players solving puzzles and earning points
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(
              [
                { id: "global",   label: "🌍 Global"  },
                { id: "weekly",   label: "📅 Weekly"  },
                { id: "monthly",  label: "🗓️ Monthly" },
                { id: "following",label: "👥 Following"},
              ] as { id: Tab; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="px-5 py-2 rounded-lg font-semibold text-sm transition-all"
                style={{
                  backgroundColor: activeTab === id ? '#3891A6' : 'rgba(56,145,166,0.12)',
                  color: activeTab === id ? '#fff' : '#3891A6',
                  border: '1px solid rgba(56,145,166,0.4)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        {/* Following empty state */}
        {activeTab === "following" && !loading && followingCount === 0 && (
          <div className="mb-6 rounded-lg p-6 text-center border" style={{ backgroundColor: 'rgba(56,145,166,0.08)', borderColor: 'rgba(56,145,166,0.3)' }}>
            <p className="text-2xl mb-2">👥</p>
            <p className="text-white font-semibold mb-1">You&apos;re not following anyone yet</p>
            <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>Follow players from the Global leaderboard or their profile pages to see them here.</p>
            <button
              onClick={() => setActiveTab("global")}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#3891A6', color: '#fff' }}
            >
              Browse Global Leaderboard
            </button>
          </div>
        )}

        {/* ── Period (weekly / monthly) view ─────────────────────────────── */}
        {(activeTab === "weekly" || activeTab === "monthly") && (
          <>
            {/* Countdown + reward info */}
            <div className="mb-6 flex flex-wrap gap-4">
              {periodEndsAt && (
                <div className="flex-1 min-w-[200px] rounded-lg p-4 border" style={{ backgroundColor: 'rgba(56,145,166,0.1)', borderColor: '#3891A6' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#3891A6' }}>⏳ TIME REMAINING</p>
                  <p className="text-xl font-bold text-white">{formatCountdown(periodEndsAt)}</p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Ends {new Date(periodEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
              {periodRewardTiers.length > 0 && (
                <div className="flex-1 min-w-[260px] rounded-lg p-4 border" style={{ backgroundColor: 'rgba(253,231,76,0.06)', borderColor: 'rgba(253,231,76,0.3)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#FDE74C' }}>🏆 END-OF-{activeTab === "weekly" ? "WEEK" : "MONTH"} REWARDS (TOP 50)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {periodRewardTiers.map((t) => (
                      <div key={String(t.rank)} className="flex justify-between text-xs">
                        <span style={{ color: '#d1d5db' }}>#{t.rank}</span>
                        <span style={{ color: '#FDE74C' }}>{t.points.toLocaleString()} pts</span>
                        <span style={{ color: '#a78bfa' }}>+{t.xp} XP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Your period rank */}
            {periodUserRank && (
              <div className="mb-8 rounded-lg p-4 sm:p-6 border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: '#DDDBF1' }}>YOUR RANK THIS {activeTab === "weekly" ? "WEEK" : "MONTH"}</p>
                    <p className="text-3xl font-bold text-white">#{periodUserRank.rank}</p>
                    {periodUserRank.rank <= 50 && (
                      <p className="text-xs mt-1" style={{ color: '#4ade80' }}>✓ You&apos;re in the reward zone!</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-bold" style={{ color: '#FDE74C' }}>{periodUserRank.periodPoints}</p>
                    <p className="text-sm" style={{ color: '#DDDBF1' }}>{periodUserRank.puzzlesSolved} puzzles solved</p>
                  </div>
                </div>
              </div>
            )}

            {/* Period table */}
            <div className="bg-slate-800/50 rounded-lg overflow-hidden border" style={{ borderColor: '#3891A6' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b" style={{ borderColor: '#3891A6' }}>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>RANK</th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>PLAYER</th>
                      <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>PUZZLES</th>
                      <th className="px-3 sm:px-6 py-4 text-right text-xs font-semibold" style={{ color: '#3891A6' }}>PTS THIS {activeTab === "weekly" ? "WEEK" : "MONTH"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodEntries.map((entry) => (
                      <tr
                        key={entry.userId}
                        className="hover:bg-slate-700/30 transition-colors"
                        style={{
                          borderBottom: '1px solid rgba(56, 145, 166, 0.2)',
                          backgroundColor: entry.userId === (session?.user as any)?.id ? 'rgba(56, 145, 166, 0.15)' : 'transparent',
                        }}
                      >
                        <td className={`px-3 sm:px-6 py-3 font-bold ${getRankColor(entry.rank)}`}>
                          <span className="text-lg">{getMedalEmoji(entry.rank)}</span>
                          {entry.rank <= 50 && entry.rank > 3 && (
                            <span className="ml-1 text-xs" style={{ color: '#FDE74C' }}>🎁</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={entry.userImage || '/images/default-avatar.svg'}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              onError={(e) => { const img = e.currentTarget; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
                            />
                            <Link href={`/profile/${entry.userId}`} className="text-white font-semibold hover:underline hover:text-[#3891A6]">
                              {entry.userName || "Anonymous"}{entry.isPremium ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> 💎</span> : ""}{entry.activeFlair && entry.activeFlair !== "none" ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> {entry.activeFlair}</span> : ""}
                            </Link>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 text-slate-300">{entry.puzzlesSolved}</td>
                        <td className="px-3 sm:px-6 py-3 text-right">
                          <span className="text-lg font-bold" style={{ color: '#FDE74C' }}>{entry.periodPoints}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {periodEntries.length === 0 && (
                <div className="p-8 text-center text-slate-400">No activity yet this {activeTab === "weekly" ? "week" : "month"}. Solve a puzzle to appear here!</div>
              )}
            </div>
          </>
        )}

        {/* ── Global / Following view ─────────────────────────────────────── */}
        {(activeTab === "global" || activeTab === "following") && (
          <>
            {/* Your Rank Card */}
            {userRank && (
              <div className="mb-8 rounded-lg p-4 sm:p-6 border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: '#DDDBF1' }}>{activeTab === "following" ? "YOUR RANK (AMONG FOLLOWING)" : "YOUR RANK"}</p>
                    <p className="text-3xl font-bold text-white">
                      #{userRank.rank}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-bold" style={{ color: '#FDE74C' }}>
                      {userRank.totalPoints}
                    </p>
                    <p className="text-sm" style={{ color: '#DDDBF1' }}>
                      {userRank.puzzlesSolved} puzzles solved
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard Table */}
            <div className="bg-slate-800/50 rounded-lg overflow-hidden border" style={{ borderColor: '#3891A6' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b" style={{ borderColor: '#3891A6' }}>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                        RANK
                      </th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                        PLAYER
                      </th>
                      <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                        PUZZLES
                      </th>
                      <th className="px-3 sm:px-6 py-4 text-right text-xs font-semibold" style={{ color: '#3891A6' }}>
                        POINTS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.userId}
                        className={`hover:bg-slate-700/30 transition-colors`}
                        style={{
                          borderBottom: `1px solid rgba(56, 145, 166, 0.2)`,
                          backgroundColor: entry.userId === (session?.user as any)?.id ? 'rgba(56, 145, 166, 0.15)' : 'transparent'
                        }}
                      >
                        <td className={`px-3 sm:px-6 py-3 font-bold ${getRankColor(entry.rank)}`}>
                          <span className="text-lg">
                            {getMedalEmoji(entry.rank)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={entry.userImage || '/images/default-avatar.svg'}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              onError={(e) => { const img = e.currentTarget; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
                            />
                            {entry.userId ? (
                              <Link
                                href={`/profile/${entry.userId}`}
                                className="text-white font-semibold hover:underline hover:text-[#3891A6]"
                              >
                                {entry.userName || "Anonymous"}{entry.isPremium ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> 💎</span> : ""}{entry.activeFlair && entry.activeFlair !== "none" ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> {entry.activeFlair}</span> : ""}
                              </Link>
                            ) : (
                              <span className="text-white font-semibold">{entry.userName || "Anonymous"}{entry.isPremium ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> 💎</span> : ""}</span>
                            )}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-3 text-slate-300">
                          {entry.puzzlesSolved}
                        </td>
                        <td className="px-3 sm:px-6 py-3 text-right">
                          <span className="text-lg font-bold" style={{ color: '#FDE74C' }}>
                            {entry.totalPoints}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {entries.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No players yet. Be the first to solve a puzzle!
                </div>
              )}
            </div>

            {/* Info Footer */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border" style={{ borderColor: '#3891A6' }}>
                <p className="text-sm mb-2" style={{ color: '#DDDBF1' }}>🥇 Top Players</p>
                <p className="text-2xl font-bold text-white">{entries.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border" style={{ borderColor: '#3891A6' }}>
                <p className="text-sm mb-2" style={{ color: '#DDDBF1' }}>📊 Total Points</p>
                <p className="text-2xl font-bold text-white">
                  {entries.reduce((sum, e) => sum + e.totalPoints, 0)}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border" style={{ borderColor: '#3891A6' }}>
                <p className="text-sm mb-2" style={{ color: '#DDDBF1' }}>🧩 Puzzles Solved</p>
                <p className="text-2xl font-bold text-white">
                  {entries.reduce((sum, e) => sum + e.puzzlesSolved, 0)}
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
