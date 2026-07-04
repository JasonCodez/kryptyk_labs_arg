import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { awardSeasonXp } from "@/lib/seasonXp";
import { computeStreak, getTodayDayNumber, streakReward } from "@/lib/dailyPuzzle";

/**
 * POST /api/daily/complete
 * Records that the current user completed today's daily word puzzle.
 * Auto-consumes a streak shield if the streak was broken (gap of exactly 1 day).
 *
 * Body: { won: boolean, guesses: number }
 */
export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const body = await request.json();
    const { won, guesses } = body as { won: boolean; guesses: number };

    if (typeof won !== "boolean" || typeof guesses !== "number") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const dayNumber = getTodayDayNumber();

    // Check if already recorded today
    const existing = await prisma.dailyWordRecord.findUnique({
      where: { userId_dayNumber: { userId: currentUser.id, dayNumber } },
    });
    if (existing) {
      return NextResponse.json({ message: "Already recorded", shieldUsed: existing.shieldUsed });
    }

    // Check streak: look at most recent record before today
    const lastRecord = await prisma.dailyWordRecord.findFirst({
      where: { userId: currentUser.id, dayNumber: { lt: dayNumber } },
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
          // Consume one shield and insert a synthetic "skipped" record for the gap day
          const gapDay = lastRecord.dayNumber + 1;
          await prisma.$transaction([
            prisma.user.update({
              where: { id: currentUser.id },
              data: { streakShields: { decrement: 1 } },
            }),
            prisma.dailyWordRecord.create({
              data: {
                userId: currentUser.id,
                dayNumber: gapDay,
                won: false,
                guesses: 0,
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
    await prisma.dailyWordRecord.create({
      data: {
        userId: currentUser.id,
        dayNumber,
        won,
        guesses,
        shieldUsed: false,
      },
    });

    // ── Award streak-based rewards (only for wins) ──────────────────────
    let reward = null;
    if (won) {
      // Compute streak from records (including the one we just created)
      const records = await prisma.dailyWordRecord.findMany({
        where: { userId: currentUser.id },
        orderBy: { dayNumber: "desc" },
      });
      const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, true);

      // Streak wraps after 7 — use ((streak-1) % 7) + 1 so day 8 = day 1
      const streakDay = ((streak - 1) % 7) + 1;
      reward = streakReward(streakDay);

      try {
        // Award points
        await prisma.user.update({
          where: { id: currentUser.id },
          data: { totalPoints: { increment: reward.points } },
        });
        const existingLb = await prisma.globalLeaderboard.findFirst({ where: { userId: currentUser.id } });
        if (existingLb) {
          // Capture old rank before update for the rank-up notification
          const oldRank = await prisma.globalLeaderboard.count({
            where: { totalPoints: { gt: existingLb.totalPoints } },
          }) + 1;

          await prisma.globalLeaderboard.update({
            where: { id: existingLb.id },
            data: { totalPoints: { increment: reward.points } },
          });

          // Fire rank-up notification if the user climbed ≥3 places (fire-and-forget)
          (async () => {
            try {
              const newPoints = existingLb.totalPoints + reward.points;
              const newRank = await prisma.globalLeaderboard.count({
                where: { totalPoints: { gt: newPoints } },
              }) + 1;
              const passed = oldRank - newRank;
              if (passed >= 3) {
                const { createNotification } = await import("@/lib/notification-service");
                await createNotification({
                  userId: currentUser.id,
                  type: "system",
                  title: `📈 You jumped ${passed} places!`,
                  message: `You're now ranked #${newRank} on the global leaderboard. Keep solving to climb higher!`,
                  icon: "📈",
                  relatedId: "/leaderboard",
                });
              }
            } catch { /* non-fatal */ }
          })();
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
        console.error("[DAILY COMPLETE] Failed to award streak rewards:", err);
      }
    }

    // ── Rival notifications (fire-and-forget) ──────────────────────────
    // Notify followers who have already completed today's puzzle and got a worse result
    // so they feel the competitive sting and come back tomorrow.
    if (won) {
      (async () => {
        try {
          const { createNotification } = await import("@/lib/notification-service");
          // Find users who follow this player
          const myFollowers = await prisma.follow.findMany({
            where: { followingId: currentUser.id },
            select: { followerId: true },
          });
          for (const { followerId } of myFollowers) {
            const followerRecord = await prisma.dailyWordRecord.findUnique({
              where: { userId_dayNumber: { userId: followerId, dayNumber } },
            });
            // Only notify if they've already played today and got a worse (higher) guess count or lost
            if (!followerRecord) continue;
            const isBetter = !followerRecord.won || followerRecord.guesses > guesses;
            if (!isBetter) continue;
            const display = currentUser.name ?? "A player you follow";
            const myScore = `${guesses}/6`;
            const theirScore = followerRecord.won ? `${followerRecord.guesses}/6` : "X/6";
            await createNotification({
              userId: followerId,
              type: "system",
              title: "Your rival just beat your score! ⚔️",
              message: `${display} solved today's Daily in ${myScore}. You got ${theirScore}. Time for revenge tomorrow!`,
              icon: "🔥",
              relatedId: currentUser.id,
            });
          }
        } catch {
          // non-fatal
        }
      })();
    }

    // ── Season pass upgrade nudge ───────────────────────────────────────
    // On the 3rd win, check if user is not premium → include showUpgradeOffer flag
    let showUpgradeOffer = false;
    if (won) {
      try {
        const winCount = await prisma.dailyWordRecord.count({
          where: { userId: currentUser.id, won: true },
        });
        if (winCount === 3) {
          const now = new Date();
          const pass = await prisma.userSeasonPass.findFirst({
            where: {
              userId: currentUser.id,
              isPremium: false,
              season: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
            },
            select: { id: true },
          });
          // Show offer if they have a free pass (or no pass at all = implicit free tier)
          if (pass || !await prisma.userSeasonPass.findFirst({
            where: { userId: currentUser.id, season: { isActive: true, startDate: { lte: now }, endDate: { gte: now } } },
          })) {
            showUpgradeOffer = true;
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ success: true, shieldUsed, reward, showUpgradeOffer });
  } catch (err) {
    console.error("[DAILY COMPLETE]", err);
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 });
  }
}

/**
 * GET /api/daily/complete
 * Returns whether the user has already completed today's puzzle + their daily streak.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const dayNumber = getTodayDayNumber();

    const todayRecord = await prisma.dailyWordRecord.findUnique({
      where: { userId_dayNumber: { userId: currentUser.id, dayNumber } },
    });

    // Compute streak
    const records = await prisma.dailyWordRecord.findMany({
      where: { userId: currentUser.id },
      orderBy: { dayNumber: "desc" },
    });

    const streak = computeStreak(records.map((r) => r.dayNumber), dayNumber, !!todayRecord);

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { streakShields: true, skipTokens: true },
    });

    // Compute next reward: what the user earns if they win today (or what they earned)
    // Streak wraps after 7
    const nextStreakDay = todayRecord
      ? ((streak - 1) % 7) + 1   // already completed — show what they earned
      : ((streak) % 7) + 1;       // not yet — show what they'd earn
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
    console.error("[DAILY GET]", err);
    return NextResponse.json({ error: "Failed to get daily status" }, { status: 500 });
  }
}
