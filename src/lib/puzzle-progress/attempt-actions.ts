import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { awardSolveRewards } from "./awardSolveRewards";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/puzzleConstants";

type AttemptProgress = {
  id: string;
  attempts: number;
  successfulAttempts: number;
  averageTimePerAttempt: number | null;
  solved: boolean;
  sudokuLockedAt: Date | null;
  sudokuStartedAt: Date | null;
  sudokuExpiresAt: Date | null;
};

type AttemptPuzzleRecord = {
  puzzleType: string;
  sudoku?: { solutionGrid?: string | null; timeLimitSeconds?: number | null } | null;
  solutions?: Array<{ points?: number | null }>;
  parts?: Array<{ pointsValue?: number | null }>;
  xpReward?: number | null;
};

export async function logAttempt(
  progress: { id: string; attempts: number; averageTimePerAttempt: number | null },
  durationSeconds: number | undefined,
): Promise<void> {
  const newAttempts = progress.attempts + 1;
  const newAvgTime =
    progress.averageTimePerAttempt && durationSeconds
      ? (progress.averageTimePerAttempt * progress.attempts + durationSeconds) / newAttempts
      : durationSeconds || 0;

  await prisma.userPuzzleProgress.update({
    where: { id: progress.id },
    data: {
      attempts: newAttempts,
      lastAttemptAt: new Date(),
      averageTimePerAttempt: newAvgTime,
    },
  });

  const sessionLog = await prisma.puzzleSessionLog.findFirst({
    where: { progressId: progress.id, sessionEnd: null },
    orderBy: { sessionStart: "desc" },
  });

  if (sessionLog) {
    await prisma.puzzleSessionLog.update({
      where: { id: sessionLog.id },
      data: { attemptMade: true },
    });
  }
}

export async function handleAttemptSuccess(
  progress: AttemptProgress,
  puzzleRecord: AttemptPuzzleRecord,
  submittedGrid: unknown,
  durationSeconds: number | undefined,
  userId: string,
): Promise<NextResponse | null> {
  const alreadySolved = !!progress.solved;

  // Enforce Sudoku time limit server-side
  if (puzzleRecord.puzzleType === "sudoku") {
    const now = new Date();
    if (progress.sudokuLockedAt) {
      return NextResponse.json({ error: "Sudoku puzzle is locked" }, { status: 403 });
    }
    if (!progress.sudokuStartedAt || !progress.sudokuExpiresAt) {
      return NextResponse.json({ error: "Sudoku timer not started" }, { status: 403 });
    }
    if (now.getTime() > progress.sudokuExpiresAt.getTime()) {
      // Reset (not permanently lock) so the player can start a fresh attempt
      // next time instead of being shut out of the puzzle entirely.
      try {
        await prisma.userPuzzleProgress.update({
          where: { id: progress.id },
          data: {
            sudokuStartedAt: null,
            sudokuExpiresAt: null,
            sudokuLockedAt: null,
            sudokuLockReason: null,
          },
        });
      } catch { /* ignore */ }
      return NextResponse.json({ error: "Time limit exceeded" }, { status: 403 });
    }
  }

  // Validate submitted Sudoku grid against stored solution
  try {
    if (puzzleRecord.puzzleType === "sudoku") {
      if (!Array.isArray(submittedGrid)) {
        console.warn("[PROGRESS] attempt_success missing grid for sudoku");
        return NextResponse.json({ error: "Missing submitted grid for Sudoku validation" }, { status: 400 });
      }

      let storedSolution: unknown = null;
      try {
        storedSolution = puzzleRecord.sudoku?.solutionGrid
          ? JSON.parse(puzzleRecord.sudoku.solutionGrid)
          : null;
      } catch { storedSolution = null; }

      if (!Array.isArray(storedSolution)) {
        console.error("[PROGRESS] server missing sudoku solution for puzzle");
        return NextResponse.json({ error: "Server missing Sudoku solution" }, { status: 500 });
      }

      const gridsMatch = (() => {
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const s = Number((storedSolution as number[][])[r]?.[c] ?? -1);
            const g = Number((submittedGrid as number[][])[r]?.[c] ?? -1);
            if (Number.isNaN(s) || Number.isNaN(g) || s !== g) return false;
          }
        }
        return true;
      })();

      if (!gridsMatch) {
        console.warn("[PROGRESS] submitted sudoku grid does not match solution");
        return NextResponse.json({ error: "Submitted Sudoku solution does not match" }, { status: 400 });
      }
    }
  } catch (e) {
    console.error("[PROGRESS] error validating sudoku grid", e);
    return NextResponse.json({ error: "Failed to validate submitted solution" }, { status: 500 });
  }

  // Update progress row
  const newAttempts = progress.attempts + 1;
  const newAvgTime =
    progress.averageTimePerAttempt && durationSeconds
      ? (progress.averageTimePerAttempt * progress.attempts + durationSeconds) / newAttempts
      : durationSeconds || 0;

  await prisma.userPuzzleProgress.update({
    where: { id: progress.id },
    data: {
      attempts: newAttempts,
      successfulAttempts: progress.successfulAttempts + 1,
      lastAttemptAt: new Date(),
      averageTimePerAttempt: newAvgTime,
      solved: true,
      ...(alreadySolved ? {} : { solvedAt: new Date() }),
    },
  });

  // Mark session log as successful
  const sessionLog = await prisma.puzzleSessionLog.findFirst({
    where: { progressId: progress.id, sessionEnd: null },
    orderBy: { sessionStart: "desc" },
  });

  if (sessionLog) {
    await prisma.puzzleSessionLog.update({
      where: { id: sessionLog.id },
      data: { wasSuccessful: true, attemptMade: true },
    });
  }

  if (!alreadySolved) {
    // Check Triple-or-Nothing token (3× rewards on first attempt)
    let tripleActive = false;
    try {
      const tripleUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { tripleOrNothingActive: true },
      });
      tripleActive = !!(tripleUser?.tripleOrNothingActive && progress.attempts === 0);
      if (tripleActive) {
        await prisma.user.update({ where: { id: userId }, data: { tripleOrNothingActive: false } });
      }
    } catch { /* non-critical */ }

    await awardSolveRewards(userId, progress.id, puzzleRecord, tripleActive);
  }

  return null;
}

/**
 * Records a full failed game/round. Returns the true failed-attempt count at
 * the moment of this loss (before any reset below) so the caller can report
 * an accurate "you're out of attempts" message for this round, even though
 * the underlying counter gets reset once the cap is hit.
 */
export async function recordGameLoss(
  progress: { id: string; solved: boolean },
  userId: string,
  maxAttempts: number = MAX_PUZZLE_ATTEMPTS,
): Promise<number | null> {
  if (progress.solved) return null;

  const updated = await prisma.userPuzzleProgress.update({
    where: { id: progress.id },
    data: { failedAttempts: { increment: 1 }, lastAttemptAt: new Date() },
    select: { failedAttempts: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { tripleOrNothingActive: false },
  });

  // Reset immediately once the cap is hit so the player gets a fresh set of
  // attempts on their next visit instead of a permanent lockout.
  if (updated.failedAttempts >= maxAttempts) {
    await prisma.userPuzzleProgress.update({
      where: { id: progress.id },
      data: { failedAttempts: 0 },
    });
  }

  return updated.failedAttempts;
}
