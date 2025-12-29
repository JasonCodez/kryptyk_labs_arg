import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyAchievementUnlock, notifyLeaderboardChange } from "@/lib/notification-service";
import { z } from "zod";

const SubmitAnswerSchema = z.object({
  puzzleId: z.string().cuid(),
  answer: z.string().min(1).max(1000),
  teamId: z.string().cuid().optional(),
});

type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { puzzleId, answer, teamId } = SubmitAnswerSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get puzzle and solutions
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      include: { solutions: true },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    // Calculate points based on difficulty
    const difficultyPoints: Record<string, number> = {
      easy: 10,
      medium: 25,
      hard: 50,
      extreme: 100,
    };
    const pointsEarned = difficultyPoints[puzzle.difficulty] || 25;

    // Check if answer is correct
    const isCorrect = puzzle.solutions.some((solution: any) => {
      let checkAnswer = answer;
      let checkSolution = solution.answer;

      if (solution.ignoreCase) {
        checkAnswer = checkAnswer.toLowerCase();
        checkSolution = checkSolution.toLowerCase();
      }

      if (solution.ignoreWhitespace) {
        checkAnswer = checkAnswer.replace(/\s+/g, "");
        checkSolution = checkSolution.replace(/\s+/g, "");
      }

      if (solution.isRegex) {
        const regex = new RegExp(checkSolution);
        return regex.test(checkAnswer);
      }

      return checkAnswer === checkSolution;
    });

    // Get current progress to check if this is the first successful attempt
    const currentProgress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: { userId: user.id, puzzleId },
      },
    });

    // Prevent re-solving already completed puzzles
    if (currentProgress?.solved) {
      return NextResponse.json(
        { error: "Puzzle already solved. You cannot solve this puzzle again." },
        { status: 400 }
      );
    }

    // Check if this is the first successful attempt
    const isFirstAttempt = !currentProgress;
    const isFirstSuccessfulAttempt = isFirstAttempt || (!currentProgress.solved && isCorrect);

    const userProgress = await prisma.userPuzzleProgress.upsert({
      where: {
        userId_puzzleId: { userId: user.id, puzzleId },
      },
      update: {
        // Only increment attempts if answer is incorrect
        // If correct and not yet solved, don't increment (it's the successful attempt)
        ...((!isCorrect || currentProgress?.solved) && {
          attempts: { increment: 1 },
        }),
        ...(isCorrect && { solved: true, solvedAt: new Date() }),
        ...(isCorrect && { pointsEarned }),
      },
      create: {
        userId: user.id,
        puzzleId,
        attempts: 1,
        ...(isCorrect && { solved: true, solvedAt: new Date() }),
        pointsEarned: isCorrect ? pointsEarned : 0,
      },
    });

    // Update team progress if teamId provided
    if (teamId && isCorrect) {
      await prisma.teamProgress.upsert({
        where: {
          teamId_puzzleId: { teamId, puzzleId },
        },
        update: {
          attempts: { increment: 1 },
          solved: true,
          solvedAt: new Date(),
          solvedBy: user.id,
          pointsEarned,
        },
        create: {
          teamId,
          puzzleId,
          attempts: 1,
          solved: true,
          solvedAt: new Date(),
          solvedBy: user.id,
          pointsEarned,
        },
      });
    }

    // Record submission
    await prisma.puzzleSubmission.create({
      data: {
        puzzleId,
        userId: user.id,
        answer,
        isCorrect,
      },
    });

    // Track if this is referred user's first puzzle solve
    if (isCorrect) {
      // Check if user was referred and this is their first solved puzzle
      const userReferral = await prisma.userReferral.findFirst({
        where: { refereeId: user.id },
      });

      if (userReferral && !userReferral.refereeFirstPuzzleSolvedAt) {
        // Mark first puzzle solved for this referral
        await prisma.userReferral.update({
          where: { id: userReferral.id },
          data: { refereeFirstPuzzleSolvedAt: new Date() },
        });
      }
    }

    // Check for achievements if puzzle was solved
    if (isCorrect) {
      const achievements = await prisma.achievement.findMany();
      
      for (const achievement of achievements) {
        // Check if user already has this achievement
        const hasAchievement = await prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: { userId: user.id, achievementId: achievement.id },
          },
        });

        if (!hasAchievement) {
          // Simple achievement unlock logic - can be customized based on achievement type
          let shouldUnlock = false;

          // Example: "First Puzzle" achievement
          if (achievement.id === "first-puzzle-id" || achievement.name === "First Puzzle") {
            const solvedCount = await prisma.userPuzzleProgress.count({
              where: { userId: user.id, solved: true },
            });
            shouldUnlock = solvedCount === 1; // First puzzle solved
          }

          if (shouldUnlock) {
            // Award achievement
            await prisma.userAchievement.create({
              data: {
                userId: user.id,
                achievementId: achievement.id,
              },
            });

            // Send notification
            await notifyAchievementUnlock(user.id, {
              achievementId: achievement.id,
              achievementName: achievement.name,
              achievementDescription: achievement.description,
            });
          }
        }
      }
    }

    // Check for leaderboard rank changes if puzzle was solved
    if (isCorrect) {
      // Get all users and calculate current rankings
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      const leaderboard = await Promise.all(
        allUsers.map(async (u) => {
          const progress = await prisma.userPuzzleProgress.findMany({
            where: { userId: u.id, solved: true },
            select: { pointsEarned: true },
          });
          return {
            userId: u.id,
            totalPoints: progress.reduce((sum, p) => sum + p.pointsEarned, 0),
          };
        })
      );

      // Sort by points to determine current rank
      leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
      const currentRank = leaderboard.findIndex((entry) => entry.userId === user.id) + 1;
      const previousRank = currentRank + 1; // Estimate previous rank (was one position lower)

      // Only notify if rank improved significantly (top 100)
      if (currentRank <= 100 && currentRank < previousRank) {
        const userStats = leaderboard.find((entry) => entry.userId === user.id);
        if (userStats) {
          await notifyLeaderboardChange(user.id, {
            leaderboardType: "global",
            currentRank: currentRank,
            previousRank: previousRank,
            points: userStats.totalPoints,
          });
        }
      }
    }

    return NextResponse.json({
      isCorrect,
      pointsEarned: isCorrect ? pointsEarned : 0,
      message: isCorrect
        ? "Correct answer! 🎉"
        : "Incorrect answer. Try again!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Submit answer error:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}
