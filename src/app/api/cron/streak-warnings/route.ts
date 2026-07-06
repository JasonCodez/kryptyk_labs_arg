import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail, generateStreakExpiryEmail } from "@/lib/mail";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";

/**
 * GET /api/cron/streak-warnings
 * Called by an external cron job ~20:00 UTC daily.
 * Sends a streak-expiry warning to every user who has an active streak
 * but hasn't yet solved today's Daily Word.
 *
 * Requires header:  x-cron-secret: <CRON_SECRET env var>
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayNumber = getTodayDayNumber();

  // All users with a live streak
  const streaks = await prisma.userStreak.findMany({
    where: { currentStreak: { gt: 0 } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          notificationPreference: {
            select: { emailNotificationsEnabled: true },
          },
        },
      },
    },
  });

  // Users who have already played today
  const todayPlayed = await prisma.dailyWordRecord.findMany({
    where: { dayNumber },
    select: { userId: true },
  });
  const playedUserIds = new Set(todayPlayed.map((r) => r.userId));

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://puzzlewarz.com";
  const playUrl = `${baseUrl}/daily`;
  let sent = 0;
  let skipped = 0;

  for (const s of streaks) {
    const user = s.user;

    if (
      playedUserIds.has(user.id) ||
      !user.email ||
      !user.emailVerified ||
      user.notificationPreference?.emailNotificationsEnabled === false
    ) {
      skipped++;
      continue;
    }

    const html = generateStreakExpiryEmail(
      user.name ?? "there",
      s.currentStreak,
      playUrl,
    );

    const ok = await sendEmail({
      to: user.email,
      subject: `🔥 Your ${s.currentStreak}-day streak expires tonight`,
      html,
    });

    if (ok) sent++;
    else skipped++;
  }

  return NextResponse.json({ sent, skipped, dayNumber });
}
