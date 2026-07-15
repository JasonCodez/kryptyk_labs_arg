"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  Target,
  Trophy,
  Clock,
} from "lucide-react";

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalPuzzles: number;
    totalSolves: number;
    totalAttempts: number;
    solveRate: number;
    avgAttemptsPerSolve: number;
  };
  puzzleStats: Array<{
    id: string;
    title: string;
    difficulty: string;
    solves: number;
  }>;
  userEngagement: Array<{
    userId: string;
    userName: string;
    puzzlesSolved: number;
  }>;
  difficultyBreakdown: Array<{
    difficulty: string;
    count: number;
  }>;
  categoryStats: Array<{
    categoryId: string;
    categoryName: string;
    puzzleCount: number;
  }>;
  topSolvers: Array<{
    userId: string;
    userName: string;
    userImage: string;
    puzzlesSolved: number;
  }>;
  recentActivity: Array<{
    id: string;
    userName: string;
    puzzleTitle: string;
    solvedAt: string;
  }>;
}

interface PuzzleReview {
  id: string;
  rating: number;
  review: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  puzzle: {
    id: string;
    title: string;
    difficulty: string;
  };
}

interface GridlockRecentSolve {
  id: string;
  puzzleId: string;
  puzzleTitle: string;
  rank: string;
  elapsedSeconds: number;
  submissionCount: number;
  solvedAt: string;
  isGuest: boolean;
  userName: string | null;
}

interface GridlockPuzzleSummary {
  puzzleId: string;
  title: string;
  totalSolves: number;
  avgSeconds: number;
  avgAttempts: number;
  rankBreakdown: Record<string, number>;
}

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [reviews, setReviews] = useState<PuzzleReview[]>([]);
  const [gridlockSolves, setGridlockSolves] = useState<GridlockRecentSolve[]>([]);
  const [gridlockSummaries, setGridlockSummaries] = useState<GridlockPuzzleSummary[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      checkAdminAndFetchData();
    }
  }, [status]);

  const checkAdminAndFetchData = async () => {
    try {
      const [analyticsRes, reviewsRes, gridlockRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/reviews"),
        fetch("/api/admin/gridlock-solves"),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
        setIsAdmin(true);
      } else if (analyticsRes.status === 403) {
        redirect("/dashboard");
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData.reviews);
      }

      if (gridlockRes.ok) {
        const gd = await gridlockRes.json();
        setGridlockSolves(gd.recentSolves ?? []);
        setGridlockSummaries(gd.puzzleSummaries ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#020202" }}
      >
        <p style={{ color: "#FDE74C" }}>Loading analytics...</p>
      </div>
    );
  }

  if (!isAdmin || !analytics) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#020202" }}
      >
        <p style={{ color: "#AB9F9D" }}>You don't have permission to view this page</p>
      </div>
    );
  }

  const DIFFICULTY_COLORS: Record<string, string> = {
    EASY: "#10B981",
    MEDIUM: "#F59E0B",
    HARD: "#EF4444",
    EXPERT: "#3891A6",
  };

  return (
    <>
      <main
        className="min-h-screen pb-12"
        style={{ backgroundColor: "#020202" }}
      >
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              📊 Admin Analytics
            </h1>
            <p style={{ color: "#DDDBF1" }}>
              Platform statistics and puzzle engagement metrics
            </p>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5" style={{ color: "#3891A6" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Total Users
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.totalUsers}
              </p>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5" style={{ color: "#FDE74C" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Total Puzzles
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.totalPuzzles}
              </p>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-5 h-5" style={{ color: "#38D399" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Total Solves
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.totalSolves}
              </p>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5" style={{ color: "#FDE74C" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Total Attempts
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.totalAttempts}
              </p>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5" style={{ color: "#38D399" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Solve Rate
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.solveRate.toFixed(1)}%
              </p>
            </div>

            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.1)",
                borderColor: "#3891A6",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5" style={{ color: "#AB9F9D" }} />
                <p style={{ color: "#DDDBF1" }} className="text-sm">
                  Avg Attempts/Solve
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {analytics.overview.avgAttemptsPerSolve}
              </p>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Most Solved Puzzles */}
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.08)",
                borderColor: "#3891A6",
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: "#3891A6" }} />
                Most Solved Puzzles
              </h2>
              <div className="space-y-3">
                {analytics.puzzleStats.map((puzzle, idx) => (
                  <div
                    key={puzzle.id}
                    className="flex items-center justify-between p-3 rounded"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{puzzle.title}</p>
                      <p
                        className="text-xs"
                        style={{ color: "#DDDBF1" }}
                      >
                        Difficulty:{" "}
                        <span
                          style={{
                            color: DIFFICULTY_COLORS[puzzle.difficulty],
                          }}
                        >
                          {puzzle.difficulty}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        {puzzle.solves}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "#DDDBF1" }}
                      >
                        solves
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty Breakdown */}
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.08)",
                borderColor: "#3891A6",
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: "#3891A6" }} />
                Puzzle Difficulty Distribution
              </h2>
              <div className="space-y-3">
                {analytics.difficultyBreakdown.map((difficulty) => (
                  <div key={difficulty.difficulty} className="flex items-center gap-3">
                    <div className="w-24">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: DIFFICULTY_COLORS[difficulty.difficulty],
                        }}
                      >
                        {difficulty.difficulty}
                      </p>
                    </div>
                    <div className="flex-1 bg-slate-700 rounded h-6 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(difficulty.count / analytics.overview.totalPuzzles) * 100}%`,
                          backgroundColor:
                            DIFFICULTY_COLORS[difficulty.difficulty],
                        }}
                      />
                    </div>
                    <p className="text-sm font-bold text-white w-8 text-right">
                      {difficulty.count}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category & Top Solvers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Category Stats */}
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.08)",
                borderColor: "#3891A6",
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" style={{ color: "#FDE74C" }} />
                Puzzles by Category
              </h2>
              <div className="space-y-2">
                {analytics.categoryStats.map((category) => (
                  <div
                    key={category.categoryId}
                    className="flex items-center justify-between p-2 rounded"
                    style={{ backgroundColor: "rgba(253, 231, 76, 0.1)" }}
                  >
                    <p className="text-white">{category.categoryName}</p>
                    <span
                      className="px-3 py-1 rounded text-sm font-semibold"
                      style={{
                        backgroundColor: "rgba(253, 231, 76, 0.2)",
                        color: "#FDE74C",
                      }}
                    >
                      {category.puzzleCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Solvers */}
            <div
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(56, 145, 166, 0.08)",
                borderColor: "#3891A6",
              }}
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" style={{ color: "#38D399" }} />
                Top 10 Solvers
              </h2>
              <div className="space-y-3">
                {analytics.topSolvers.map((solver, idx) => (
                  <div
                    key={solver.userId}
                    className="flex items-center gap-3 p-2 rounded"
                    style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
                  >
                    <span
                      className="text-lg font-bold w-6 text-center"
                      style={{ color: "#FDE74C" }}
                    >
                      #{idx + 1}
                    </span>
                    {solver.userImage && (
                      <img
                        src={solver.userImage}
                        alt={solver.userName}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {solver.userName}
                      </p>
                    </div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "#38D399" }}
                    >
                      {solver.puzzlesSolved} solved
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: "rgba(56, 145, 166, 0.08)",
              borderColor: "#3891A6",
            }}
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: "#AB9F9D" }} />
              Recent Puzzle Solves
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {analytics.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded text-sm"
                  style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
                >
                  <div>
                    <p className="text-white font-medium">
                      {activity.userName}
                    </p>
                    <p style={{ color: "#DDDBF1" }}>
                      solved "{activity.puzzleTitle}"
                    </p>
                  </div>
                  <p style={{ color: "#DDDBF1" }} className="text-xs whitespace-nowrap ml-4">
                    {new Date(activity.solvedAt).toLocaleDateString()} at{" "}
                    {new Date(activity.solvedAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Gridlock File Solves */}
          <div
            className="rounded-lg p-6 border mb-8"
            style={{
              backgroundColor: "rgba(255, 208, 0, 0.05)",
              borderColor: "rgba(255, 208, 0, 0.25)",
            }}
          >
            <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              🔐 Gridlock File Solves
            </h2>

            {/* Per-puzzle summary */}
            {gridlockSummaries.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-mono text-yellow-500/70 tracking-widest uppercase mb-3">Puzzle Summary</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="pb-2 pr-4 text-xs text-gray-500 font-normal">Puzzle</th>
                        <th className="pb-2 pr-4 text-xs text-gray-500 font-normal text-right">Solves</th>
                        <th className="pb-2 pr-4 text-xs text-gray-500 font-normal text-right">Avg Time</th>
                        <th className="pb-2 pr-4 text-xs text-gray-500 font-normal text-right">Avg Attempts</th>
                        <th className="pb-2 text-xs text-gray-500 font-normal">Rank Split</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridlockSummaries.map((s) => (
                        <tr key={s.puzzleId} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white max-w-[180px] truncate">{s.title}</td>
                          <td className="py-2 pr-4 text-yellow-400 text-right font-bold">{s.totalSolves}</td>
                          <td className="py-2 pr-4 text-gray-300 text-right">
                            {s.avgSeconds < 60
                              ? `${Math.round(s.avgSeconds)}s`
                              : `${Math.floor(s.avgSeconds / 60)}m ${Math.round(s.avgSeconds % 60)}s`}
                          </td>
                          <td className="py-2 pr-4 text-gray-300 text-right">{s.avgAttempts.toFixed(1)}</td>
                          <td className="py-2 text-gray-400 text-xs">
                            {(['S','A','B','C','F'] as const)
                              .filter(r => s.rankBreakdown[r])
                              .map(r => `${r}:${s.rankBreakdown[r]}`)
                              .join('  ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent solves feed */}
            <p className="text-xs font-mono text-yellow-500/70 tracking-widest uppercase mb-3">Recent Solves (last 50)</p>
            {gridlockSolves.length === 0 ? (
              <p className="text-center py-6 text-white/55 text-sm font-mono">No solves recorded yet</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {gridlockSolves.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 rounded text-xs font-mono"
                    style={{ backgroundColor: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="font-black w-5 text-center"
                        style={{
                          color: s.rank === 'S' ? '#FFD700' : s.rank === 'A' ? '#7DF9AA' : s.rank === 'B' ? '#60CFFF' : s.rank === 'C' ? '#C0C0C0' : '#9CA3AF',
                        }}
                      >
                        {s.rank}
                      </span>
                      <span className="text-white truncate max-w-[160px]">{s.puzzleTitle}</span>
                      <span className="text-gray-500">
                        {s.isGuest ? '👤 guest' : (s.userName ?? 'user')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-gray-500">
                      <span>{s.submissionCount} attempt{s.submissionCount !== 1 ? 's' : ''}</span>
                      <span>
                        {s.elapsedSeconds < 60
                          ? `${s.elapsedSeconds}s`
                          : `${Math.floor(s.elapsedSeconds / 60)}m ${s.elapsedSeconds % 60}s`}
                      </span>
                      <span>{new Date(s.solvedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Reviews (Admin Only) */}
          <div
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: "rgba(56, 145, 166, 0.08)",
              borderColor: "#3891A6",
            }}
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              💬 User Puzzle Reviews
            </h2>
            {reviews.length === 0 ? (
              <p style={{ color: "#DDDBF1" }} className="text-center py-6">
                No user reviews yet
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 rounded border"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.3)",
                      borderColor: "rgba(253, 231, 76, 0.3)",
                    }}
                  >
                    {/* Review Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-bold">
                          {review.puzzle.title}
                        </p>
                        <p style={{ color: "#DDDBF1" }} className="text-sm">
                          By {review.user.name || review.user.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p style={{ color: "#FDE74C" }} className="font-bold">
                          {"⭐".repeat(review.rating)}
                        </p>
                        <p style={{ color: "#AB9F9D" }} className="text-xs">
                          {review.rating}/5
                        </p>
                      </div>
                    </div>

                    {/* Review Text */}
                    <p
                      className="text-sm mb-2 p-3 rounded"
                      style={{
                        backgroundColor: "rgba(56, 145, 166, 0.05)",
                        color: "#DDDBF1",
                      }}
                    >
                      "{review.review}"
                    </p>

                    {/* Review Meta */}
                    <div className="flex items-center justify-between text-xs">
                      <p style={{ color: "#AB9F9D" }}>
                        Difficulty: <span style={{ color: "#FDE74C" }}>{review.puzzle.difficulty}</span>
                      </p>
                      <p style={{ color: "#AB9F9D" }}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Back to Admin */}
          <div className="mt-8 text-center">
            <Link
              href="/admin/puzzles"
              className="inline-block px-6 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-80"
              style={{
                backgroundColor: "#3891A6",
              }}
            >
              ← Back to Puzzle Management
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
