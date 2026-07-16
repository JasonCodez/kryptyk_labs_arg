import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type SudokuProgress = {
  id: string;
  solved: boolean;
  sudokuLockedAt: Date | null;
  sudokuStartedAt: Date | null;
  sudokuExpiresAt: Date | null;
};

export async function startSudokuTimer(
  progress: SudokuProgress,
  puzzleRecord: { sudoku?: { timeLimitSeconds?: number | null } | null },
  clientStartedAtMs: number | undefined,
): Promise<NextResponse | null> {
  if (progress.solved) return null;
  if (progress.sudokuLockedAt) {
    return NextResponse.json({ error: "Sudoku puzzle is locked" }, { status: 403 });
  }

  if (!progress.sudokuStartedAt || !progress.sudokuExpiresAt) {
    const now = new Date();
    const limitSeconds = puzzleRecord.sudoku?.timeLimitSeconds ?? 15 * 60;
    // New clients omit clientStartedAtMs. Keep accepting a bounded legacy value,
    // but never allow local storage to move the authoritative start far into the past.
    const startedAt =
      clientStartedAtMs && Number.isFinite(clientStartedAtMs) && Date.now() - clientStartedAtMs < 5 * 60 * 1000
        ? new Date(Math.min(Date.now(), clientStartedAtMs))
        : now;

    await prisma.userPuzzleProgress.update({
      where: { id: progress.id },
      data: {
        sudokuStartedAt: startedAt,
        sudokuExpiresAt: new Date(startedAt.getTime() + limitSeconds * 1000),
        sudokuLockedAt: null,
        sudokuLockReason: null,
      },
    });
  }

  return null;
}

export async function lockSudoku(
  progress: { id: string; sudokuExpiresAt: Date | null },
  lockReason: string | undefined,
): Promise<void> {
  const now = new Date();
  await prisma.userPuzzleProgress.update({
    where: { id: progress.id },
    data: {
      sudokuLockedAt: now,
      sudokuLockReason: lockReason || "locked",
      sudokuExpiresAt:
        progress.sudokuExpiresAt && progress.sudokuExpiresAt.getTime() < now.getTime()
          ? progress.sudokuExpiresAt
          : now,
    },
  });
}

export async function clearSudokuState(progress: {
  id: string;
  solved: boolean;
  sudokuLockedAt: Date | null;
  sudokuExpiresAt: Date | null;
}): Promise<void> {
  const now = new Date();
  const expired = !!(progress.sudokuExpiresAt && progress.sudokuExpiresAt.getTime() <= now.getTime());
  const canClear = progress.solved || !!progress.sudokuLockedAt || expired;

  if (canClear) {
    await prisma.userPuzzleProgress.update({
      where: { id: progress.id },
      data: {
        ...(progress.solved ? {} : { attempts: 0 }),
        sudokuStartedAt: null,
        sudokuExpiresAt: null,
        sudokuLockedAt: null,
        sudokuLockReason: null,
      },
    });
  }
}
