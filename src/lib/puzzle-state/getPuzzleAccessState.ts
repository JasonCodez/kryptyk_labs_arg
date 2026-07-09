import prisma from "@/lib/prisma";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/puzzleConstants";

export type PuzzleAccessState = {
  // Core state
  isSolved: boolean;

  // Attempt-limit lock (non-Sudoku puzzles: Hidden Word, riddle, etc.)
  isAttemptLocked: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;

  // Sudoku-specific timer lock
  isSudokuLocked: boolean;
  isSudokuExpired: boolean; // timer ran out but DB not yet updated
  sudokuLockReason: string | null;

  // Aggregate: any lock condition blocks the player
  isLocked: boolean;
  lockReason: "max_attempts" | "sudoku_time" | "sudoku_locked" | null;

  // Convenience: player can still make a new attempt
  canAttempt: boolean;
};

type ProgressShape = {
  solved: boolean;
  failedAttempts: number;
  sudokuLockedAt: Date | null;
  sudokuExpiresAt: Date | null;
  sudokuLockReason: string | null;
};

/**
 * Returns the canonical access state for a user/puzzle pair.
 *
 * Pass a pre-fetched `progress` object to avoid an extra DB round-trip in
 * routes that already loaded progress. Omit it and the function fetches it.
 */
export async function getPuzzleAccessState(
  userId: string,
  puzzleId: string,
  prefetchedProgress?: ProgressShape | null,
): Promise<PuzzleAccessState> {
  const progress =
    prefetchedProgress !== undefined
      ? prefetchedProgress
      : await prisma.userPuzzleProgress.findUnique({
          where: { userId_puzzleId: { userId, puzzleId } },
          select: {
            solved: true,
            failedAttempts: true,
            sudokuLockedAt: true,
            sudokuExpiresAt: true,
            sudokuLockReason: true,
          },
        });

  // No row → puzzle never started, fully open
  if (!progress) {
    return {
      isSolved: false,
      isAttemptLocked: false,
      attemptsUsed: 0,
      attemptsRemaining: MAX_PUZZLE_ATTEMPTS,
      isSudokuLocked: false,
      isSudokuExpired: false,
      sudokuLockReason: null,
      isLocked: false,
      lockReason: null,
      canAttempt: true,
    };
  }

  const isSolved = progress.solved;

  // Attempt-limit lock (already-solved puzzles are never locked)
  const attemptsUsed = progress.failedAttempts;
  const isAttemptLocked = !isSolved && attemptsUsed >= MAX_PUZZLE_ATTEMPTS;
  const attemptsRemaining = Math.max(0, MAX_PUZZLE_ATTEMPTS - attemptsUsed);

  // Sudoku timer lock
  const isSudokuLocked = !!progress.sudokuLockedAt;
  const isSudokuExpired =
    !isSudokuLocked &&
    !!progress.sudokuExpiresAt &&
    Date.now() > new Date(progress.sudokuExpiresAt).getTime();

  // Aggregate lock
  let lockReason: PuzzleAccessState["lockReason"] = null;
  if (isAttemptLocked) lockReason = "max_attempts";
  else if (isSudokuLocked) lockReason = "sudoku_locked";
  else if (isSudokuExpired) lockReason = "sudoku_time";

  const isLocked = isAttemptLocked || isSudokuLocked || isSudokuExpired;

  return {
    isSolved,
    isAttemptLocked,
    attemptsUsed,
    attemptsRemaining,
    isSudokuLocked,
    isSudokuExpired,
    sudokuLockReason: progress.sudokuLockReason,
    isLocked,
    lockReason,
    canAttempt: !isLocked && !isSolved,
  };
}
