"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  email: string;
  totalPoints: number;
  puzzlesSolved: number;
  rank: number;
}

export default function LeaderboardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchLeaderboard();
    }
  }, [session?.user?.email]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/leaderboards/global");
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      setEntries(data.entries);
      setUserRank(data.userRank);
    } catch (err) {
      setError("Failed to load leaderboard");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      {/* Header with Logo */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
        </div>
      </nav>
      
      <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-block mb-4 px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: '#2a3a3b', borderColor: '#3891A6' }}
          >
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🏆 Global Leaderboard</h1>
              <p style={{ color: '#DDDBF1' }}>
                Top players solving puzzles and earning points
              </p>
            </div>
            <Link
              href="/leaderboards/teams"
              className="px-4 py-2 text-white rounded-lg font-semibold transition-all whitespace-nowrap"
              style={{ backgroundColor: '#3891A6' }}
            >
              Team Leaderboards
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        {/* Your Rank Card */}
        {userRank && (
          <div className="mb-8 rounded-lg p-6 border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: '#DDDBF1' }}>YOUR RANK</p>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                    RANK
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                    PLAYER
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold" style={{ color: '#3891A6' }}>
                    PUZZLES
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold" style={{ color: '#3891A6' }}>
                    POINTS
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.userId}
                    className={`hover:bg-slate-700/30 transition-colors`}
                    style={{
                      borderBottom: `1px solid rgba(56, 145, 166, 0.2)`,
                      backgroundColor: entry.email === session?.user?.email ? 'rgba(56, 145, 166, 0.15)' : 'transparent'
                    }}
                  >
                    <td className={`px-6 py-4 font-bold ${getRankColor(entry.rank)}`}>
                      <span className="text-lg">
                        {getMedalEmoji(entry.rank)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-semibold">
                          {entry.userName || "Anonymous"}
                        </p>
                        <p className="text-slate-400 text-sm">{entry.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {entry.puzzlesSolved}
                    </td>
                    <td className="px-6 py-4 text-right">
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
      </div>
      </div>
    </div>
  );
}
