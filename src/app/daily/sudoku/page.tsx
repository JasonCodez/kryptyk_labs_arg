"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StreakTimer from "@/components/StreakTimer";
import SudokuGrid from "@/components/puzzle/SudokuGrid";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";

export default function DailySudokuPage() {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const { loading, available, dayNumber, streak, completedToday, nextReward, content, submitCompletion } =
    useDailyPuzzle("sudoku");
  const [solved, setSolved] = useState(false);
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);

  const grid = useMemo(() => {
    if (!content?.puzzleGrid) return null;
    try {
      return JSON.parse(content.puzzleGrid) as number[][];
    } catch {
      return null;
    }
  }, [content?.puzzleGrid]);

  const solution = useMemo(() => {
    if (!content?.solutionGrid) return null;
    try {
      return JSON.parse(content.solutionGrid) as number[][];
    } catch {
      return null;
    }
  }, [content?.solutionGrid]);

  const isDone = completedToday || solved;

  return (
    <div style={{ backgroundColor: "#020202", minHeight: "100vh" }}>
      <Navbar />
      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-3xl mt-6 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "#3891A6" }}>Daily Sudoku</p>
            <span className="text-white text-2xl font-black tracking-[0.18em]">#{dayNumber || "---"}</span>
          </div>
          {streak > 0 && <StreakTimer streak={streak} solvedToday={isDone} size="sm" />}
        </div>

        {!isAuthenticated ? (
          <div className="mt-16 text-center">
            <p className="text-white font-bold mb-3">Sign in to play the daily sudoku</p>
            <Link href="/auth/signin" className="px-5 py-2 rounded-lg text-sm font-bold inline-block" style={{ background: "#FDE74C", color: "#020202" }}>
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzle…</span>
          </div>
        ) : !available || !grid || !solution ? (
          <p className="mt-16 text-sm" style={{ color: "#AB9F9D" }}>Today&apos;s sudoku isn&apos;t ready yet — check back soon.</p>
        ) : isDone ? (
          <div className="w-full max-w-sm mt-10 p-6 rounded-xl text-center" style={{ border: "1px solid rgba(56,211,153,0.18)", background: "rgba(56,211,153,0.04)" }}>
            <div className="text-4xl mb-2">✓</div>
            <p className="text-white font-bold mb-1">Solved for today!</p>
            {reward && (
              <p className="text-sm" style={{ color: "#38D399" }}>+{reward.points} pts · +{reward.xp} xp</p>
            )}
            <p className="text-xs mt-3" style={{ color: "#666" }}>Come back tomorrow for a new puzzle.</p>
          </div>
        ) : (
          <div className="w-full max-w-xl">
            {nextReward && (
              <p className="text-xs text-center mb-3" style={{ color: "#DDDBF1" }}>
                Day {nextReward.streakDay} reward: +{nextReward.points} pts · +{nextReward.xp} xp
              </p>
            )}
            <SudokuGrid
              puzzle={grid}
              givens={grid}
              solution={solution}
              validateOnChange
              onValidatedSuccess={async () => {
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
