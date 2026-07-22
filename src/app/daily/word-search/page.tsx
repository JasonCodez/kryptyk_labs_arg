"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import WordSearchPuzzle, { type WordSearchPresentationState, type WordSearchPuzzleHandle } from "@/components/puzzle/WordSearchPuzzle";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import { PuzzleHeaderActions } from "@/components/app-shell/PuzzleHeader";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";
import DailyCompletionHandoff from "@/components/onboarding/DailyCompletionHandoff";
import DailyPuzzleResult from "@/components/daily/DailyPuzzleResult";

export default function DailyWordSearchPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;
  const { loading, available, dayNumber, streak, streakDay, nextReward, completedToday, content, submitCompletion } =
    useDailyPuzzle("word_search");
  const [wordSearchData, setWordSearchData] = useState<Record<string, unknown> | null>(null);
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [presentation, setPresentation] = useState<WordSearchPresentationState | null>(null);
  const [hintTokens, setHintTokens] = useState(0);
  const puzzleRef = useRef<WordSearchPuzzleHandle | null>(null);

  useEffect(() => {
    if (!content?.puzzleId) return;
    let cancelled = false;
    fetch(`/api/puzzles/${content.puzzleId}`, { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((puzzle) => { if (!cancelled && puzzle?.data) setWordSearchData(puzzle.data as Record<string, unknown>); });
    return () => { cancelled = true; };
  }, [content?.puzzleId]);

  useEffect(() => {
    if (!content?.puzzleId || !isAuthenticated) return;
    let cancelled = false;
    fetch(`/api/puzzles/${content.puzzleId}/hints`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && Number.isFinite(data?.hintTokens)) setHintTokens(Math.max(0, Number(data.hintTokens))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [content?.puzzleId, isAuthenticated]);

  const isDone = solved || (completedToday && !celebrating);

  return (
    <PuzzlePlayShell
      backHref="/daily"
      title="Daily Word Trove"
      subtitle={`#${dayNumber || "---"}${streak > 0 ? ` · 🔥 ${streak}` : ""}`}
      progress={wordSearchData && !isDone ? <span aria-label={`${presentation?.foundCount ?? 0} of ${presentation?.totalWords ?? 0} words found`}>{presentation?.foundCount ?? 0}/{presentation?.totalWords ?? 0}</span> : undefined}
      actions={wordSearchData && !isDone ? <PuzzleHeaderActions onHelp={() => puzzleRef.current?.openInstructions()} helpLabel="How to play Word Trove" /> : undefined}
      contentMode="fixed"
      contentClassName="pw-word-search-shell-content"
    >
      <div className="flex h-full min-h-0 flex-col items-center">
        {!isAuthenticated ? (
          <div className="mt-16 text-center">
            <p className="mb-3 font-bold text-white">Sign in to play the daily Word Trove</p>
            <Link href="/auth/signin" className="inline-block rounded-lg px-5 py-2 text-sm font-bold" style={{ background: "#FDE74C", color: "#020202" }}>Sign in</Link>
          </div>
        ) : loading ? (
          <div className="mt-20 flex items-center gap-2" style={{ color: "#3891A6" }}><div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /><span className="text-sm">Loading today&apos;s puzzle…</span></div>
        ) : !available || !content?.puzzleId ? (
          <p className="mt-16 text-sm" style={{ color: "#AB9F9D" }}>Today&apos;s Word Trove isn&apos;t ready yet — check back soon.</p>
        ) : isDone ? (
          <DailyPuzzleResult
            puzzleName="Word Trove"
            dayNumber={dayNumber}
            streak={streak}
            streakDay={streakDay}
            reward={reward}
            nextReward={nextReward}
          >
            <DailyCompletionHandoff userId={onboardingUserId} completed />
          </DailyPuzzleResult>
        ) : !wordSearchData ? (
          <div className="mt-20 flex items-center gap-2" style={{ color: "#3891A6" }}><div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /></div>
        ) : (
          <div className="h-full min-h-0 w-full">
            <WordSearchPuzzle
              ref={puzzleRef}
              puzzleId={content.puzzleId}
              wordSearchData={wordSearchData}
              dailyMode
              persistenceScope="daily"
              dailyDayNumber={dayNumber}
              hintTokens={hintTokens}
              onHintUsed={async () => {
                const response = await fetch("/api/user/consume-hint-token", { method: "POST", headers: { "Content-Type": "application/json" } });
                if (!response.ok) return false;
                const data = await response.json();
                if (Number.isFinite(data?.remainingTokens)) setHintTokens(Math.max(0, Number(data.remainingTokens)));
                return true;
              }}
              displayMode="app-shell"
              onPresentationChange={setPresentation}
              onComplete={async () => {
                setCelebrating(true);
                const result = await submitCompletion();
                if (!result?.success) { setCelebrating(false); return { success: false, error: result?.error || "Daily completion could not be recorded." }; }
                if (result.reward) setReward(result.reward);
                return { success: true };
              }}
              onSolved={() => { window.setTimeout(() => { setSolved(true); setCelebrating(false); }, 700); }}
            />
          </div>
        )}
      </div>
    </PuzzlePlayShell>
  );
}
