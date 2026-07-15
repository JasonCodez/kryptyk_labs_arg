import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isHiddenPuzzleType } from "@/lib/featureFlags";

/**
 * GET /api/user/continue-playing
 * The most recent puzzle a signed-in player has started but not finished —
 * the inverse of api/user/puzzles (which only returns archived/solved-or-failed
 * rows). "Failed out" mirrors that route's convention: attempts >= 5 and unsolved.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ puzzle: null });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ puzzle: null });

  const progress = await prisma.userPuzzleProgress.findFirst({
    where: {
      userId: user.id,
      solved: false,
      attempts: { lt: 5 },
      OR: [{ attempts: { gt: 0 } }, { completionPercentage: { gt: 0 } }],
      puzzle: { isActive: true },
    },
    orderBy: [{ lastAttemptAt: "desc" }, { updatedAt: "desc" }],
    include: { puzzle: { include: { category: true } } },
  });

  if (!progress || isHiddenPuzzleType(progress.puzzle.puzzleType)) {
    return NextResponse.json({ puzzle: null });
  }

  return NextResponse.json({
    puzzle: {
      id: progress.puzzle.id,
      title: progress.puzzle.title,
      category: progress.puzzle.category ? { id: progress.puzzle.category.id, name: progress.puzzle.category.name } : null,
      difficulty: progress.puzzle.difficulty,
      completionPercentage: progress.completionPercentage ?? 0,
      attempts: progress.attempts ?? 0,
    },
  });
}
