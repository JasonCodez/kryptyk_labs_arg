import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeStreak, getTodayDayNumber } from "@/lib/dailyPuzzle";

const DAILY_TYPES = ["sudoku", "crossword", "word_search", "jigsaw"] as const;

type DailySummaryEntry = {
  dayNumber: number;
  completedToday: boolean;
  streak: number;
  available: boolean;
};

/**
 * GET /api/daily/summary
 * One aggregate round trip for the /daily hub page — status + streak for all 5 daily
 * puzzle types. Auth is optional here (unlike the per-type content/complete routes):
 * guests can browse the hub, they just see zeroed-out status for the 4 sign-in-required
 * types and get prompted to log in when they try to actually play one.
 */
export async function GET() {
  const dayNumber = getTodayDayNumber();
  const session = await getServerSession(authOptions);

  let userId: string | null = null;
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    userId = user?.id ?? null;
  }

  const wordPromise: Promise<DailySummaryEntry> = (async () => {
    if (!userId) return { dayNumber, completedToday: false, streak: 0, available: true };
    const [todayRecord, records] = await Promise.all([
      prisma.dailyWordRecord.findUnique({ where: { userId_dayNumber: { userId, dayNumber } } }),
      prisma.dailyWordRecord.findMany({ where: { userId }, orderBy: { dayNumber: "desc" }, select: { dayNumber: true } }),
    ]);
    const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, !!todayRecord);
    return { dayNumber, completedToday: !!todayRecord, streak, available: true };
  })();

  const typeEntries = await Promise.all(
    DAILY_TYPES.map(async (type): Promise<[string, DailySummaryEntry]> => {
      const slot = await prisma.dailyPuzzleSlot.findUnique({
        where: { puzzleType_dayNumber: { puzzleType: type, dayNumber } },
        select: { id: true },
      });

      if (!userId) {
        return [type, { dayNumber, completedToday: false, streak: 0, available: !!slot }];
      }

      const [todayRecord, records] = await Promise.all([
        prisma.dailyPuzzleRecord.findUnique({
          where: { userId_puzzleType_dayNumber: { userId, puzzleType: type, dayNumber } },
        }),
        prisma.dailyPuzzleRecord.findMany({
          where: { userId, puzzleType: type },
          orderBy: { dayNumber: "desc" },
          select: { dayNumber: true },
        }),
      ]);
      const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, !!todayRecord);
      return [type, { dayNumber, completedToday: !!todayRecord, streak, available: !!slot }];
    })
  );

  const word = await wordPromise;

  return NextResponse.json({
    word,
    ...Object.fromEntries(typeEntries),
  });
}
