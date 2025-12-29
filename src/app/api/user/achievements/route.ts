import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get all achievements
    const allAchievements = await prisma.achievement.findMany({
      orderBy: [
        { rarity: "asc" },
        { category: "asc" },
      ],
    });

    // Get user's puzzle data for progress calculation
    const userPuzzleProgress = await prisma.userPuzzleProgress.findMany({
      where: { userId: user.id },
      select: { solved: true, attempts: true, puzzleId: true, pointsEarned: true, solvedAt: true },
    });

    const puzzlesSolved = userPuzzleProgress.filter(p => p.solved).length;
    const totalAttempts = userPuzzleProgress.reduce((sum, p) => sum + p.attempts, 0);
    const firstTrySolves = userPuzzleProgress.filter(p => p.solved && p.attempts === 1).length;
    const totalPointsEarned = userPuzzleProgress.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);

    // Calculate current streak from solved puzzles
    let currentStreak = 0;
    if (userPuzzleProgress.some(p => p.solved)) {
      const solvedDates = userPuzzleProgress
        .filter(p => p.solved && p.solvedAt)
        .map(p => new Date(p.solvedAt!).toDateString())
        .sort()
        .reverse();

      // Get unique dates and check for consecutive days
      const uniqueDates = [...new Set(solvedDates)].map(d => new Date(d));
      
      if (uniqueDates.length > 0) {
        // Start from most recent date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let checkDate = new Date(uniqueDates[0]);
        checkDate.setHours(0, 0, 0, 0);
        
        // Allow streak to be broken by at most 1 day (solved yesterday or today)
        const daysDiff = Math.floor((today.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 1) {
          currentStreak = 0; // Streak is broken
        } else {
          // Count consecutive days
          for (let i = 0; i < uniqueDates.length; i++) {
            const current = new Date(uniqueDates[i]);
            current.setHours(0, 0, 0, 0);
            
            if (i === 0) {
              currentStreak = 1;
            } else {
              const previous = new Date(uniqueDates[i - 1]);
              previous.setHours(0, 0, 0, 0);
              
              const diff = Math.floor((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
              if (diff === -1) { // Consecutive day (previous = current + 1)
                currentStreak++;
              } else {
                break; // Streak broken
              }
            }
          }
        }
      }
    }

    // Count successful referrals (friends who joined and solved first puzzle)
    const successfulReferrals = await prisma.userReferral.count({
      where: {
        referrerId: user.id,
        refereeFirstPuzzleSolvedAt: { not: null },
      },
    });

    // Get user's achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
    });

    const unlockedIds = new Set(
      userAchievements.map((ua) => ua.achievementId)
    );

    const achievements = allAchievements.map((achievement) => {
      // Calculate progress towards achievement
      let currentProgress = 0;
      let progressPercentage = 0;
      
      if (!unlockedIds.has(achievement.id)) {
        switch (achievement.conditionType) {
          case "puzzles_solved":
            currentProgress = puzzlesSolved;
            progressPercentage = achievement.conditionValue 
              ? Math.min(100, (currentProgress / achievement.conditionValue) * 100)
              : 0;
            break;
          case "submission_accuracy":
            // Calculate first-try accuracy (puzzles solved on first attempt)
            currentProgress = firstTrySolves;
            progressPercentage = achievement.conditionValue
              ? Math.min(100, (currentProgress / achievement.conditionValue) * 100)
              : 0;
            break;
          case "points_earned":
            currentProgress = totalPointsEarned;
            progressPercentage = achievement.conditionValue
              ? Math.min(100, (currentProgress / achievement.conditionValue) * 100)
              : 0;
            break;
          case "streak":
            currentProgress = currentStreak;
            progressPercentage = achievement.conditionValue
              ? Math.min(100, (currentProgress / achievement.conditionValue) * 100)
              : 0;
            break;
          case "custom":
            // Handle custom achievements like Social Butterfly (referrals)
            if (achievement.name === "Social Butterfly") {
              currentProgress = successfulReferrals;
              progressPercentage = achievement.conditionValue
                ? Math.min(100, (currentProgress / achievement.conditionValue) * 100)
                : 0;
            } else {
              currentProgress = 0;
              progressPercentage = 0;
            }
            break;
          case "team_size":
          case "puzzle_category":
          case "time_based":
          default:
            // These require more complex calculation or manual unlock
            currentProgress = 0;
            progressPercentage = 0;
            break;
        }
      }

      return {
        ...achievement,
        unlocked: unlockedIds.has(achievement.id),
        unlockedAt: userAchievements.find(
          (ua) => ua.achievementId === achievement.id
        )?.unlockedAt,
        currentProgress,
        progressPercentage: unlockedIds.has(achievement.id) ? 100 : progressPercentage,
      };
    });

    // Count by rarity - total and unlocked
    const rarityCount = {
      common: allAchievements.filter((a) => a.rarity === "common").length,
      uncommon: allAchievements.filter(
        (a) => a.rarity === "uncommon"
      ).length,
      rare: allAchievements.filter((a) => a.rarity === "rare")
        .length,
      epic: allAchievements.filter((a) => a.rarity === "epic")
        .length,
      legendary: allAchievements.filter(
        (a) => a.rarity === "legendary"
      ).length,
    };

    const rarityUnlockedCount = {
      common: achievements.filter(
        (a) => a.rarity === "common" && a.unlocked
      ).length,
      uncommon: achievements.filter(
        (a) => a.rarity === "uncommon" && a.unlocked
      ).length,
      rare: achievements.filter((a) => a.rarity === "rare" && a.unlocked)
        .length,
      epic: achievements.filter((a) => a.rarity === "epic" && a.unlocked)
        .length,
      legendary: achievements.filter(
        (a) => a.rarity === "legendary" && a.unlocked
      ).length,
    };

    return NextResponse.json({
      achievements,
      totalUnlocked: userAchievements.length,
      totalAvailable: allAchievements.length,
      rarityCount,
      rarityUnlockedCount,
    });
  } catch (error) {
    console.error("Achievements GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}
