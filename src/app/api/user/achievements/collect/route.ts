import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { achievementId } = await request.json();

    if (!achievementId) {
      return NextResponse.json(
        { error: "Achievement ID is required" },
        { status: 400 }
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

    // Check if achievement already exists for user
    const existingAchievement = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId: user.id,
          achievementId,
        },
      },
    });

    if (existingAchievement) {
      return NextResponse.json(
        { error: "Achievement already collected" },
        { status: 400 }
      );
    }

    // Get the achievement to verify it exists
    const achievement = await prisma.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    // Validate that the achievement can be unlocked based on condition type
    // Only allow collection for achievements with automatic unlock conditions
    const autoUnlockTypes = ["puzzles_solved", "submission_accuracy", "points_earned", "streak", "custom"];
    if (!autoUnlockTypes.includes(achievement.conditionType)) {
      return NextResponse.json(
        { error: "This achievement cannot be auto-collected" },
        { status: 400 }
      );
    }

    // For submission_accuracy achievements, validate the condition is met
    if (achievement.conditionType === "submission_accuracy") {
      const userPuzzleProgress = await prisma.userPuzzleProgress.findMany({
        where: { userId: user.id },
        select: { solved: true, attempts: true },
      });
      const firstTrySolves = userPuzzleProgress.filter(p => p.solved && p.attempts === 1).length;
      
      if (firstTrySolves < (achievement.conditionValue || 1)) {
        return NextResponse.json(
          { error: "Condition not met for this achievement" },
          { status: 400 }
        );
      }
    }

    // For puzzles_solved achievements, validate the condition is met
    if (achievement.conditionType === "puzzles_solved") {
      const userPuzzleProgress = await prisma.userPuzzleProgress.findMany({
        where: { userId: user.id, solved: true },
      });
      
      if (userPuzzleProgress.length < (achievement.conditionValue || 1)) {
        return NextResponse.json(
          { error: "Condition not met for this achievement" },
          { status: 400 }
        );
      }
    }

    // For points_earned achievements, validate the condition is met
    if (achievement.conditionType === "points_earned") {
      const userPuzzleProgress = await prisma.userPuzzleProgress.findMany({
        where: { userId: user.id },
        select: { pointsEarned: true },
      });
      const totalPoints = userPuzzleProgress.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
      
      if (totalPoints < (achievement.conditionValue || 1)) {
        return NextResponse.json(
          { error: "Condition not met for this achievement" },
          { status: 400 }
        );
      }
    }

    // For streak achievements, validate the condition is met
    if (achievement.conditionType === "streak") {
      const userPuzzleProgress = await prisma.userPuzzleProgress.findMany({
        where: { userId: user.id },
        select: { solved: true, solvedAt: true },
      });

      // Calculate current streak
      let currentStreak = 0;
      if (userPuzzleProgress.some(p => p.solved)) {
        const solvedDates = userPuzzleProgress
          .filter(p => p.solved && p.solvedAt)
          .map(p => new Date(p.solvedAt!).toDateString())
          .sort()
          .reverse();

        const uniqueDates = [...new Set(solvedDates)].map(d => new Date(d));
        
        if (uniqueDates.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          let checkDate = new Date(uniqueDates[0]);
          checkDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((today.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 1) {
            for (let i = 0; i < uniqueDates.length; i++) {
              const current = new Date(uniqueDates[i]);
              current.setHours(0, 0, 0, 0);
              
              if (i === 0) {
                currentStreak = 1;
              } else {
                const previous = new Date(uniqueDates[i - 1]);
                previous.setHours(0, 0, 0, 0);
                
                const diff = Math.floor((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
                if (diff === -1) {
                  currentStreak++;
                } else {
                  break;
                }
              }
            }
          }
        }
      }
      
      if (currentStreak < (achievement.conditionValue || 1)) {
        return NextResponse.json(
          { error: "Condition not met for this achievement" },
          { status: 400 }
        );
      }
    }

    // For custom achievements like Social Butterfly, validate conditions
    if (achievement.conditionType === "custom" && achievement.name === "Social Butterfly") {
      const successfulReferrals = await prisma.userReferral.count({
        where: {
          referrerId: user.id,
          refereeFirstPuzzleSolvedAt: { not: null },
        },
      });

      if (successfulReferrals < (achievement.conditionValue || 1)) {
        return NextResponse.json(
          { error: "Condition not met for this achievement" },
          { status: 400 }
        );
      }
    }

    // Create the user achievement record
    const userAchievement = await prisma.userAchievement.create({
      data: {
        userId: user.id,
        achievementId,
        unlockedAt: new Date(),
      },
      include: { achievement: true },
    });

    return NextResponse.json({
      success: true,
      achievement: userAchievement,
    });
  } catch (error) {
    console.error("Collect achievement error:", error);
    return NextResponse.json(
      { error: "Failed to collect achievement" },
      { status: 500 }
    );
  }
}
