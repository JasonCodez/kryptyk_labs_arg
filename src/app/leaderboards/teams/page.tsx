"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  isPublic: boolean;
  bannerColor: string;
  totalPoints: number;
  totalPuzzlesSolved: number;
  memberCount: number;
  rank: number;
}

// Same podium treatment as the player leaderboard (src/app/leaderboards/page.tsx) — kept as a
// local copy rather than a shared import since these two pages don't otherwise share a module.
const RANK_STYLE: Record<number, { color: string; glow: string; ring: string }> = {
  1: { color: "#FFC94A", glow: "rgba(255,201,74,0.5)", ring: "#FFC94A" },
  2: { color: "#EEF1FA", glow: "rgba(236,232,247,0.35)", ring: "#8891AC" },
  3: { color: "#E8934A", glow: "rgba(232,147,74,0.45)", ring: "#E8934A" },
};

function getMedalEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

// Maps each team's chosen banner color to its nearest jewel-tone equivalent.
const BANNER_HEX: Record<string, string> = {
  gold: "#FFC94A",
  crimson: "#FF3B5C",
  neon: "#3D7FFF",
};

/** Flex-based row, mirroring LeaderboardRow on the player leaderboard — teams don't have an
 * avatar image, so the emblem is a colored initial badge keyed off the team's banner color. */
function TeamLeaderboardRow({ entry, isUserTeam }: { entry: TeamLeaderboardEntry; isUserTeam: boolean }) {
  const podium = RANK_STYLE[entry.rank];
  const medal = getMedalEmoji(entry.rank);
  const bannerHex = BANNER_HEX[entry.bannerColor] || "#5B6483";

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 transition-colors"
      style={{
        background: isUserTeam
          ? "linear-gradient(160deg, rgba(178,75,243,0.16), rgba(178,75,243,0.05))"
          : "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
        borderBottom: "1px solid var(--pw-line)",
        borderLeft: podium ? `3px solid ${podium.color}` : isUserTeam ? "3px solid #B24BF3" : "3px solid transparent",
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
        {medal || entry.rank}
      </div>

      {/* Emblem + name */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
          style={{
            background: `radial-gradient(120% 120% at 30% 20%, ${bannerHex}55, var(--pw-surface-hi))`,
            border: podium ? `2px solid ${podium.ring}` : `1px solid ${bannerHex}66`,
            boxShadow: podium ? `0 0 10px ${podium.glow}` : undefined,
            color: bannerHex,
          }}
        >
          {entry.teamName.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          {entry.isPublic ? (
            <Link
              href={`/teams/${entry.teamId}`}
              className="text-white font-semibold hover:underline hover:text-[#3D7FFF] truncate block text-sm sm:text-base"
            >
              {entry.teamName}
            </Link>
          ) : (
            <span className="text-white font-semibold truncate flex items-center gap-1.5 text-sm sm:text-base">
              {entry.teamName}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0"
                style={{ backgroundColor: "rgba(91,100,131,0.25)", color: "#8891AC" }}
              >
                Private
              </span>
            </span>
          )}
          <p className="text-xs sm:hidden" style={{ color: "#5B6483" }}>
            {entry.memberCount} members · {entry.totalPuzzlesSolved} solved
          </p>
        </div>
      </div>

      {/* Members + puzzles — desktop only, mobile shows it as subtext above */}
      <div className="hidden sm:flex flex-col items-end shrink-0 text-sm w-28" style={{ color: "#8891AC" }}>
        <span>{entry.memberCount} members</span>
        <span>{entry.totalPuzzlesSolved} solved</span>
      </div>

      {/* Points */}
      <div className="shrink-0 text-right">
        <span className="text-base sm:text-lg font-bold" style={{ color: "#FFC94A" }}>
          {entry.totalPoints.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default function TeamLeaderboards() {
  const { status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [userTeamRank, setUserTeamRank] = useState<TeamLeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch("/api/leaderboards/teams", { cache: "no-store" });
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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0B0E1A" }}>
        <div style={{ color: "#FFC94A" }} className="text-lg">Loading team leaderboard...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background:
          "radial-gradient(1300px 800px at 15% -10%, rgba(178,75,243,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,74,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(46,217,145,0.09), transparent 60%), #10121F",
      }}
      className="min-h-screen"
    >
      <div className="px-3 sm:px-8 pt-24 sm:pt-28 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
              <Link
                href="/leaderboards"
                className="inline-block px-3.5 sm:px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all text-sm font-medium"
                style={{ background: "var(--pw-surface-hi)", border: "1px solid rgba(178,75,243,0.3)" }}
              >
                ← Back to Leaderboards
              </Link>
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">🏆 Team Leaderboards</h1>
              <p style={{ color: "#EEF1FA" }} className="text-sm sm:text-base">
                See how teams rank by points earned together
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg text-white border" style={{ backgroundColor: "rgba(255,59,92,0.1)", borderColor: "rgba(255,59,92,0.4)" }}>
              {error}
            </div>
          )}

          {/* Your Team's Rank */}
          {userTeamRank && (
            <div className="mb-6 sm:mb-8 pw-surface pw-bevel p-4 sm:p-6" style={{ borderColor: "rgba(178,75,243,0.4)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-wide" style={{ color: "#8891AC" }}>
                    Your Team
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-white truncate max-w-[220px] sm:max-w-none">
                    {userTeamRank.teamName}
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: "#FFC94A" }}>
                    #{userTeamRank.rank}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl sm:text-5xl font-bold" style={{ color: "#FFC94A" }}>
                    {userTeamRank.totalPoints.toLocaleString()}
                  </p>
                  <p className="text-sm" style={{ color: "#EEF1FA" }}>
                    {userTeamRank.totalPuzzlesSolved} puzzles solved · {userTeamRank.memberCount} members
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rankings */}
          <div className="pw-surface pw-bevel overflow-hidden">
            {entries.map((entry) => (
              <TeamLeaderboardRow key={entry.teamId} entry={entry} isUserTeam={entry.teamId === userTeamRank?.teamId} />
            ))}
            {entries.length === 0 && (
              <div className="p-8 sm:p-12 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <p className="font-semibold text-white mb-1">No teams yet</p>
                <p className="text-sm" style={{ color: "#8891AC" }}>
                  Be the first to{" "}
                  <Link href="/teams" className="underline underline-offset-2 hover:opacity-80" style={{ color: "#3D7FFF" }}>
                    create a team
                  </Link>{" "}
                  and claim the top spot!
                </p>
              </div>
            )}
          </div>

          {/* Info Footer */}
          {entries.length > 0 && (
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="pw-surface pw-bevel p-4">
                <p className="text-sm mb-1" style={{ color: "#8891AC" }}>🏆 Ranked Teams</p>
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
                  {entries.reduce((sum, e) => sum + e.totalPuzzlesSolved, 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
