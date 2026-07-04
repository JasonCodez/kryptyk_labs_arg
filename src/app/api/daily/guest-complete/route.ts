import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { enforceRateLimit, getClientAddress, validateSameOrigin } from '@/lib/requestSecurity';
import { computeStreak, getTodayDayNumber, streakReward } from '@/lib/dailyPuzzle';

const GuestCompleteSchema = z.object({
  anonId: z.string().min(8).max(128),
  guesses: z.number().int().min(1).max(6),
});

export async function GET(request: NextRequest) {
  try {
    const anonId = request.nextUrl.searchParams.get('anonId');
    if (!anonId || anonId.length < 8) {
      return NextResponse.json({ completedToday: false });
    }

    const dayNumber = getTodayDayNumber();
    const existing = await prisma.guestDailyWordSolve.findUnique({
      where: { anonId_dayNumber: { anonId, dayNumber } },
      select: { guesses: true, streakDay: true },
    });

    return NextResponse.json({
      completedToday: !!existing,
      todayRecord: existing ? { won: true, guesses: existing.guesses } : null,
    });
  } catch (error) {
    console.error('[daily/guest-complete GET]', error);
    return NextResponse.json({ completedToday: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const body = await request.json();
    const { anonId, guesses } = GuestCompleteSchema.parse(body);

    const rateLimit = await enforceRateLimit({
      key: `daily:guest-complete:${anonId}:${getClientAddress(request)}`,
      limit: 12,
      windowMs: 15 * 60 * 1000,
      message: 'Too many guest daily submissions. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    const dayNumber = getTodayDayNumber();

    const existing = await prisma.guestDailyWordSolve.findUnique({
      where: { anonId_dayNumber: { anonId, dayNumber } },
      select: { rewardXp: true, rewardPoints: true, streakDay: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyRecorded: true,
        reward: {
          xp: existing.rewardXp,
          points: existing.rewardPoints,
          streakDay: existing.streakDay,
        },
      });
    }

    const priorSolves = await prisma.guestDailyWordSolve.findMany({
      where: {
        anonId,
        dayNumber: { lt: dayNumber },
      },
      select: { dayNumber: true },
      orderBy: { dayNumber: 'desc' },
    });

    const streakCount = computeStreak(priorSolves.map((s) => s.dayNumber), dayNumber, true);
    const reward = streakReward(((streakCount - 1) % 7) + 1);

    await prisma.guestDailyWordSolve.create({
      data: {
        anonId,
        dayNumber,
        guesses,
        rewardXp: reward.xp,
        rewardPoints: reward.points,
        streakDay: reward.streakDay,
      },
    });

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid guest completion payload.' }, { status: 400 });
    }

    console.error('[daily/guest-complete]', error);
    return NextResponse.json({ error: 'Failed to save guest daily solve.' }, { status: 500 });
  }
}