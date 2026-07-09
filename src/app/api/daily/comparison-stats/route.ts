import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";
import type { DailyHiddenWordComparisonStats } from "@/lib/dailyHiddenWordShare";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";
import {
  DAILY_HIDDEN_WORD_MAX_GUESSES,
  HIDDEN_WORD_GRADE_ORDER,
  getHiddenWordGrade,
  type HiddenWordGrade,
} from "@/lib/hiddenWord";

type DailySolverRecord = {
  key: string;
  guesses: number;
  finishedAt: Date;
};

function rankDailySolvers(left: DailySolverRecord, right: DailySolverRecord): number {
  if (left.guesses !== right.guesses) return left.guesses - right.guesses;
  if (left.finishedAt.getTime() !== right.finishedAt.getTime()) {
    return left.finishedAt.getTime() - right.finishedAt.getTime();
  }
  return left.key.localeCompare(right.key);
}

function buildComparisonStats(
  solvers: DailySolverRecord[],
  currentSolverKey: string
): DailyHiddenWordComparisonStats | null {
  const ranked = [...solvers].sort(rankDailySolvers);
  const currentIndex = ranked.findIndex((solver) => solver.key === currentSolverKey);
  if (currentIndex === -1) return null;

  const currentSolver = ranked[currentIndex];
  const otherSolvers = ranked.filter((solver) => solver.key !== currentSolverKey);
  const lowerGuessCount = otherSolvers.filter((solver) => solver.guesses < currentSolver.guesses).length;
  const sameGuessCount = otherSolvers.filter((solver) => solver.guesses === currentSolver.guesses).length;
  const higherGuessCount = otherSolvers.filter((solver) => solver.guesses > currentSolver.guesses).length;
  const beatPercent = otherSolvers.length > 0
    ? Math.round((higherGuessCount / otherSolvers.length) * 100)
    : 100;
  const averageGuesses = Math.round((ranked.reduce((sum, solver) => sum + solver.guesses, 0) / ranked.length) * 10) / 10;

  const gradeCounts = Object.fromEntries(HIDDEN_WORD_GRADE_ORDER.map((g) => [g, 0])) as Record<HiddenWordGrade, number>;
  for (const solver of ranked) {
    gradeCounts[getHiddenWordGrade(solver.guesses, DAILY_HIDDEN_WORD_MAX_GUESSES).grade]++;
  }
  const yourGrade = getHiddenWordGrade(currentSolver.guesses, DAILY_HIDDEN_WORD_MAX_GUESSES).grade;

  return {
    rank: currentIndex + 1,
    totalSolvers: ranked.length,
    lowerGuessCount,
    sameGuessCount,
    higherGuessCount,
    beatPercent,
    averageGuesses,
    yourGrade,
    gradeCounts,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const dayNumber = getTodayDayNumber();
    const anonId = request.nextUrl.searchParams.get("anonId")?.trim() ?? "";
    const session = await getServerSession(authOptions);

    let currentSolverKey: string | null = null;

    if (session?.user?.email) {
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (currentUser?.id) {
        const currentRecord = await prisma.dailyWordRecord.findUnique({
          where: { userId_dayNumber: { userId: currentUser.id, dayNumber } },
          select: { won: true },
        });

        if (currentRecord?.won) {
          currentSolverKey = `user:${currentUser.id}`;
        }
      }
    }

    if (!currentSolverKey && anonId) {
      const guestRecord = await prisma.guestDailyWordSolve.findUnique({
        where: { anonId_dayNumber: { anonId, dayNumber } },
        select: { id: true, userId: true },
      });

      if (guestRecord?.id && !guestRecord.userId) {
        currentSolverKey = `guest:${anonId}`;
      }
    }

    if (!currentSolverKey) {
      return NextResponse.json({ available: false, comparison: null });
    }

    const [dailySolvers, guestSolvers] = await Promise.all([
      prisma.dailyWordRecord.findMany({
        where: {
          dayNumber,
          won: true,
          user: { isBot: false },
        },
        select: {
          userId: true,
          guesses: true,
          createdAt: true,
        },
      }),
      prisma.guestDailyWordSolve.findMany({
        where: {
          dayNumber,
          userId: null,
        },
        select: {
          anonId: true,
          guesses: true,
          solvedAt: true,
        },
      }),
    ]);

    const solvers: DailySolverRecord[] = [
      ...dailySolvers.map((solver) => ({
        key: `user:${solver.userId}`,
        guesses: solver.guesses,
        finishedAt: solver.createdAt,
      })),
      ...guestSolvers.map((solver) => ({
        key: `guest:${solver.anonId}`,
        guesses: solver.guesses,
        finishedAt: solver.solvedAt,
      })),
    ];

    const comparison = buildComparisonStats(solvers, currentSolverKey);
    return NextResponse.json({ available: Boolean(comparison), comparison });
  } catch (error) {
    console.error("[DAILY COMPARISON STATS]", error);
    return NextResponse.json({ error: "Failed to fetch daily comparison stats" }, { status: 500 });
  }
}