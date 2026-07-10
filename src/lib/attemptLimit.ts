import prisma from "./prisma";
import { MAX_PUZZLE_ATTEMPTS } from "./puzzleConstants";

export { MAX_PUZZLE_ATTEMPTS };

/**
 * Increment a user's failed attempt count for a puzzle.
 * Returns the new total failedAttempts.
 */
export async function recordFailedAttempt(
  userId: string,
  puzzleId: string
): Promise<number> {
  const result = await prisma.userPuzzleProgress.upsert({
    where: { userId_puzzleId: { userId, puzzleId } },
    create: {
      userId,
      puzzleId,
      failedAttempts: 1,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      failedAttempts: { increment: 1 },
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
    select: { failedAttempts: true },
  });
  return result.failedAttempts;
}

/**
 * Resets a player's failed-attempt count for a puzzle back to zero. Callers
 * should invoke this right after a player's failed-attempt count reaches the
 * type's cap, so the next visit gets a fresh set of attempts instead of a
 * permanent lockout — the caller's own response should still report the true
 * just-hit count so the "you're out of attempts" message for that round is
 * accurate.
 */
export async function resetFailedAttempts(
  userId: string,
  puzzleId: string
): Promise<void> {
  await prisma.userPuzzleProgress.update({
    where: { userId_puzzleId: { userId, puzzleId } },
    data: { failedAttempts: 0 },
  });
}
