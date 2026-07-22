"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import JigsawPuzzle, { type JigsawPresentationState, type JigsawPuzzleHandle } from "@/components/puzzle/JigsawPuzzle";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import { PuzzleHeaderActions } from "@/components/app-shell/PuzzleHeader";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";
import { useJigsawImageInfo } from "@/hooks/useJigsawImageInfo";
import DailyCompletionHandoff from "@/components/onboarding/DailyCompletionHandoff";
import DailyPuzzleResult from "@/components/daily/DailyPuzzleResult";

export default function DailyJigsawPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;
  const { loading, available, dayNumber, streak, streakDay, completedToday, nextReward, content, submitCompletion } =
    useDailyPuzzle("jigsaw");
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const [presentation, setPresentation] = useState<JigsawPresentationState | null>(null);
  const puzzleRef = useRef<JigsawPuzzleHandle>(null);
  const [completionStarted, setCompletionStarted] = useState(false);
  const imageInfo = useJigsawImageInfo(content?.imageUrl);

  const isDone = (completedToday && !completionStarted) || solved;
  const elapsed = Math.floor((presentation?.elapsedMs ?? 0) / 1000);
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <PuzzlePlayShell
      backHref="/daily"
      title="Daily Jigsaw"
      subtitle={`#${dayNumber || "---"}${streak > 0 ? ` · ${streak} day streak` : ""}`}
      progress={!isDone && presentation ? `${elapsedLabel} · ${presentation.placedPieces}/${presentation.totalPieces}` : undefined}
      actions={!isDone && content?.imageUrl ? (
        <PuzzleHeaderActions
          onHelp={() => puzzleRef.current?.openInstructions()}
          helpLabel="How to play Jigsaw"
          overflow={[
            <button type="button" key="preview" onClick={() => puzzleRef.current?.openPreview()}>Preview Image</button>,
            <button type="button" key="return" onClick={() => puzzleRef.current?.returnLooseToTray()}>Return Loose Pieces</button>,
            <button type="button" key="reset" onClick={() => puzzleRef.current?.requestReset()}>Reset Puzzle</button>,
            <button type="button" key="fullscreen" onClick={() => puzzleRef.current?.enterFullscreen()}>Fullscreen</button>,
          ]}
        />
      ) : undefined}
      contentMode="fixed"
      contentClassName="pw-jigsaw-shell-content"
    >
      <div className="flex h-full min-h-0 flex-col items-center px-0">
        {!isAuthenticated ? (
          <div className="mt-16 text-center">
            <p className="text-white font-bold mb-3">Sign in to play the daily jigsaw</p>
            <Link href="/auth/signin" className="px-5 py-2 rounded-lg text-sm font-bold inline-block" style={{ background: "#FDE74C", color: "#020202" }}>
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzle…</span>
          </div>
        ) : !available || !content?.imageUrl ? (
          <p className="mt-16 text-sm" style={{ color: "#AB9F9D" }}>Today&apos;s jigsaw isn&apos;t ready yet — check back soon.</p>
        ) : isDone ? (
          <DailyPuzzleResult
            puzzleName="Jigsaw"
            dayNumber={dayNumber}
            streak={streak}
            streakDay={streakDay}
            reward={reward}
            nextReward={nextReward}
          >
            <DailyCompletionHandoff userId={onboardingUserId} completed />
          </DailyPuzzleResult>
        ) : !imageInfo.ready ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-3xl h-full min-h-0">
            <JigsawPuzzle
              ref={puzzleRef}
              puzzleId={content.puzzleId}
              imageUrl={content.imageUrl}
              rows={content.gridRows}
              cols={content.gridCols}
              displayMode="app-shell"
              mode="daily"
              persistenceScope="daily"
              dailyDayNumber={dayNumber}
              rotationEnabled={false}
              onPresentationChange={setPresentation}
              onComplete={async (timeSpentSeconds) => {
                setCompletionStarted(true);
                const result = await submitCompletion({ elapsedSeconds: timeSpentSeconds });
                if (result?.reward) setReward(result.reward);
                return result?.success
                  ? { success: true, pointsAwarded: result.reward?.points ?? 0 }
                  : { success: false, error: result?.error || result?.message || "Daily completion could not be recorded." };
              }}
              onCelebrationComplete={() => setSolved(true)}
            />
          </div>
        )}
      </div>
    </PuzzlePlayShell>
  );
}
