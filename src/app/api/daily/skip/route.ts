import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";

/**
 * POST /api/daily/skip
 * Skips today's daily puzzle using a skip token. Preserves the daily streak.
 */
export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const dayNumber = getTodayDayNumber();

    // Check if already recorded today
    const existing = await prisma.dailyWordRecord.findUnique({
      where: { userId_dayNumber: { userId: currentUser.id, dayNumber } },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already completed or skipped today's puzzle" }, { status: 409 });
    }

    // Check skip token balance
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { skipTokens: true },
    });
    if (!user || user.skipTokens < 1) {
      return NextResponse.json({ error: "You have no skip tokens. Purchase one in the Store." }, { status: 400 });
    }

    // Atomically: decrement skip token + record as skipped
    await prisma.$transaction([
      prisma.user.update({
        where: { id: currentUser.id },
        data: { skipTokens: { decrement: 1 } },
      }),
      prisma.dailyWordRecord.create({
        data: {
          userId: currentUser.id,
          dayNumber,
          won: false,
          guesses: 0,
          skipped: true,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DAILY SKIP]", err);
    return NextResponse.json({ error: "Failed to skip puzzle" }, { status: 500 });
  }
}
