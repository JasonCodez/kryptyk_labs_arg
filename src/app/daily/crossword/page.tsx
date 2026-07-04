"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StreakTimer from "@/components/StreakTimer";
import CrosswordPuzzle from "@/components/puzzle/CrosswordPuzzle";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";

export default function DailyCrosswordPage() {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const { loading, available, dayNumber, streak, completedToday, nextReward, content, submitCompletion } =
    useDailyPuzzle("crossword");
  const [crosswordData, setCrosswordData] = useState<Record<string, unknown> | null>(null);
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (!content?.puzzleId) return;
    let cancelled = false;
    fetch(`/api/puzzles/${content.puzzleId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((puzzle) => {
        if (!cancelled && puzzle?.data) setCrosswordData(puzzle.data as Record<string, unknown>);
      });
    return () => {
      cancelled = true;
    };
  }, [content?.puzzleId]);

  const isDone = completedToday || solved;

  return (
    <div style={{ backgroundColor: "#020202", minHeight: "100vh" }}>
      <Navbar />
      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-3xl mt-6 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "#3891A6" }}>Daily Crossword</p>
            <span className="text-white text-2xl font-black tracking-[0.18em]">#{dayNumber || "---"}</span>
          </div>
          {streak > 0 && <StreakTimer streak={streak} solvedToday={isDone} size="sm" />}
        </div>

        {!isAuthenticated ? (
          <div className="mt-16 text-center">
            <p className="text-white font-bold mb-3">Sign in to play the daily crossword</p>
            <Link href="/auth/signin" className="px-5 py-2 rounded-lg text-sm font-bold inline-block" style={{ background: "#FDE74C", color: "#020202" }}>
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzle…</span>
          </div>
        ) : !available || !content?.puzzleId ? (
          <p className="mt-16 text-sm" style={{ color: "#AB9F9D" }}>Today&apos;s crossword isn&apos;t ready yet — check back soon.</p>
        ) : isDone ? (
          <div className="w-full max-w-sm mt-10 p-6 rounded-xl text-center" style={{ border: "1px solid rgba(56,211,153,0.18)", background: "rgba(56,211,153,0.04)" }}>
            <div className="text-4xl mb-2">✓</div>
            <p className="text-white font-bold mb-1">Solved for today!</p>
            {reward && (
              <p className="text-sm" style={{ color: "#38D399" }}>+{reward.points} pts · +{reward.xp} xp</p>
            )}
            <p className="text-xs mt-3" style={{ color: "#666" }}>Come back tomorrow for a new puzzle.</p>
          </div>
        ) : !crosswordData ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-4xl">
            {nextReward && (
              <p className="text-xs text-center mb-3" style={{ color: "#DDDBF1" }}>
                Day {nextReward.streakDay} reward: +{nextReward.points} pts · +{nextReward.xp} xp
              </p>
            )}
            <CrosswordPuzzle
              puzzleId={content.puzzleId}
              crosswordData={crosswordData}
              onSolved={async () => {
                setSolved(true);
                const result = await submitCompletion();
                if (result?.reward) setReward(result.reward);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
