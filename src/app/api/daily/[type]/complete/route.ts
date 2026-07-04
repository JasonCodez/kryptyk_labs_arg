import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { awardSeasonXp } from "@/lib/seasonXp";
import { computeStreak, getTodayDayNumber, streakReward } from "@/lib/dailyPuzzle";

const DAILY_TYPES = ["sudoku", "crossword", "word_search", "jigsaw"] as const;
type DailyType = (typeof DAILY_TYPES)[number];

/**
 * POST /api/daily/[type]/complete
 * Records that the current user completed today's daily [type] puzzle. Mirrors
 * /api/daily/complete (the word-puzzle route) but against the generic
 * DailyPuzzleRecord model, keyed by (userId, puzzleType, dayNumber) so each of these
 * 4 types tracks its own independent streak. Unlike the word puzzle, these types have
 * no "lost" state in the daily flow — this route is only ever called on success.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    if (!DAILY_TYPES.includes(type as DailyType)) {
      return NextResponse.json({ error: "Unknown daily puzzle type" }, { status: 400 });
    }

    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    let metadata: Record<string, unknown> | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.metadata === "object" && body.metadata !== null) {
        metadata = body.metadata;
      }
    } catch {
      // no body is fine — completion doesn't require one
    }

    const dayNumber = getTodayDayNumber();

    // Check if already recorded today
    const existing = await prisma.dailyPuzzleRecord.findUnique({
      where: { userId_puzzleType_dayNumber: { userId: currentUser.id, puzzleType: type, dayNumber } },
    });
    if (existing) {
      return NextResponse.json({ message: "Already recorded", shieldUsed: existing.shieldUsed });
    }

    // Check streak: look at most recent record before today
    const lastRecord = await prisma.dailyPuzzleRecord.findFirst({
      where: { userId: currentUser.id, puzzleType: type, dayNumber: { lt: dayNumber } },
      orderBy: { dayNumber: "desc" },
    });

    let shieldUsed = false;
    if (lastRecord) {
      const gap = dayNumber - lastRecord.dayNumber;
      // gap === 1 → consecutive (no shield needed)
      // gap === 2 → missed exactly 1 day → use a shield if available
      if (gap === 2) {
        const user = await prisma.user.findUnique({
          where: { id: currentUser.id },
          select: { streakShields: true },
        });
        if (user && user.streakShields > 0) {
          const gapDay = lastRecord.dayNumber + 1;
          await prisma.$transaction([
            prisma.user.update({
              where: { id: currentUser.id },
              data: { streakShields: { decrement: 1 } },
            }),
            prisma.dailyPuzzleRecord.create({
              data: {
                userId: currentUser.id,
                puzzleType: type,
                dayNumber: gapDay,
                won: false,
                skipped: true,
                shieldUsed: true,
              },
            }),
          ]);
          shieldUsed = true;
        }
      }
    }

    // Record today's completion
    await prisma.dailyPuzzleRecord.create({
      data: {
        userId: currentUser.id,
        puzzleType: type,
        dayNumber,
        won: true,
        shieldUsed: false,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });

    // Compute streak from records (including the one we just created)
    const records = await prisma.dailyPuzzleRecord.findMany({
      where: { userId: currentUser.id, puzzleType: type },
      orderBy: { dayNumber: "desc" },
    });
    const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, true);

    // Streak wraps after 7 — use ((streak-1) % 7) + 1 so day 8 = day 1
    const streakDay = ((streak - 1) % 7) + 1;
    const reward = streakReward(streakDay);

    try {
      // Award points
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { totalPoints: { increment: reward.points } },
      });
      const existingLb = await prisma.globalLeaderboard.findFirst({ where: { userId: currentUser.id } });
      if (existingLb) {
        await prisma.globalLeaderboard.update({
          where: { id: existingLb.id },
          data: { totalPoints: { increment: reward.points } },
        });
      } else {
        await prisma.globalLeaderboard.create({ data: { userId: currentUser.id, totalPoints: reward.points } });
      }

      // Award XP + level recalculation
      const freshUser = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { xp: true },
      });
      const newXp = (freshUser?.xp ?? 0) + reward.xp;
      const { level, title } = calcLevel(newXp);
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { xp: newXp, level, xpTitle: title },
      });

      // Season pass XP
      await awardSeasonXp(currentUser.id, reward.xp);
    } catch (err) {
      console.error(`[DAILY ${type} COMPLETE] Failed to award streak rewards:`, err);
    }

    return NextResponse.json({ success: true, shieldUsed, reward });
  } catch (err) {
    console.error("[DAILY TYPE COMPLETE]", err);
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 });
  }
}

/**
 * GET /api/daily/[type]/complete
 * Returns whether the user has already completed today's [type] puzzle + their streak
 * for that type specifically (independent from the other 4 daily puzzle streaks).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    if (!DAILY_TYPES.includes(type as DailyType)) {
      return NextResponse.json({ error: "Unknown daily puzzle type" }, { status: 400 });
    }

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const dayNumber = getTodayDayNumber();

    const todayRecord = await prisma.dailyPuzzleRecord.findUnique({
      where: { userId_puzzleType_dayNumber: { userId: currentUser.id, puzzleType: type, dayNumber } },
    });

    const records = await prisma.dailyPuzzleRecord.findMany({
      where: { userId: currentUser.id, puzzleType: type },
      orderBy: { dayNumber: "desc" },
    });

    const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, !!todayRecord);

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { streakShields: true, skipTokens: true },
    });

    // Compute next reward: what the user earns if they complete today (or what they earned)
    const nextStreakDay = todayRecord
      ? ((streak - 1) % 7) + 1
      : (streak % 7) + 1;
    const nextReward = streakReward(nextStreakDay);

    return NextResponse.json({
      completedToday: !!todayRecord,
      todayRecord,
      streak,
      streakDay: nextStreakDay,
      nextReward,
      streakShields: user?.streakShields ?? 0,
      skipTokens: user?.skipTokens ?? 0,
    });
  } catch (err) {
    console.error("[DAILY TYPE GET]", err);
    return NextResponse.json({ error: "Failed to get daily status" }, { status: 500 });
  }
}
