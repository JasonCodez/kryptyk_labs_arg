"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  totalPoints: number;
  totalPuzzlesSolved: number;
  memberCount: number;
  rank: number;
}

export default function TeamLeaderboards() {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [userTeamRank, setUserTeamRank] = useState<TeamLeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch("/api/leaderboards/teams");
        if (!response.ok) throw new Error("Failed to fetch team leaderboard");
        const data = await response.json();
        setEntries(data.entries);
        setUserTeamRank(data.userTeamRank);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-100 to-yellow-50";
    if (rank === 2) return "bg-gradient-to-r from-gray-100 to-gray-50";
    if (rank === 3) return "bg-gradient-to-r from-orange-100 to-orange-50";
    return "hover:bg-gray-50";
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20" style={{ backgroundColor: '#020202' }}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <p style={{ color: '#FDE74C' }} className="text-lg">Loading team leaderboards...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20" style={{ backgroundColor: '#020202' }}>
        <div className="container mx-auto px-4">
          <div className="border rounded-lg p-4 text-white" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Header with Logo */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/leaderboards" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Team Leaderboards</h1>
          <p style={{ color: '#DDDBF1' }}>See how teams rank by points earned</p>
        </div>

        {/* Global Rankings Table */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg overflow-hidden mb-8 border" style={{ borderColor: '#3891A6' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b" style={{ borderColor: '#3891A6' }}>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#3891A6' }}>
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#3891A6' }}>
                    Team Name
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ color: '#3891A6' }}>
                    Members
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ color: '#3891A6' }}>
                    Puzzles Solved
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ color: '#3891A6' }}>
                    Total Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.teamId}
                    className={`transition-colors ${getRankColor(entry.rank)}`}
                    style={{ borderBottom: `1px solid rgba(56, 145, 166, 0.2)` }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {getMedalEmoji(entry.rank) || `#${entry.rank}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/teams/${entry.teamId}`}
                        className="font-semibold text-white transition-colors hover:opacity-80"
                        style={{ color: '#DDDBF1' }}
                      >
                        {entry.teamName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: '#DDDBF1' }}>
                      {entry.memberCount}
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: '#DDDBF1' }}>
                      {entry.totalPuzzlesSolved}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold" style={{ color: '#FDE74C' }}>
                        {entry.totalPoints} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User's Team Rank Card */}
        {userTeamRank && (
          <div className="backdrop-blur rounded-lg p-6 border" style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Your Team's Rank</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm" style={{ color: '#DDDBF1' }}>Team</p>
                <p className="text-xl font-bold text-white">{userTeamRank.teamName}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#DDDBF1' }}>Rank</p>
                <p className="text-3xl font-bold" style={{ color: '#3891A6' }}>
                  #{userTeamRank.rank}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#DDDBF1' }}>Points</p>
                <p className="text-2xl font-bold" style={{ color: '#FDE74C' }}>
                  {userTeamRank.totalPoints}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#DDDBF1' }}>Puzzles Solved</p>
                <p className="text-2xl font-bold" style={{ color: '#AB9F9D' }}>
                  {userTeamRank.totalPuzzlesSolved}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboards Link */}
        <div className="mt-8 text-center">
          <Link
            href="/leaderboards"
            className="transition-colors hover:opacity-80"
            style={{ color: '#3891A6' }}
          >
            ← Back to Global Leaderboards
          </Link>
        </div>
      </div>
    </div>
  );
}
