import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Check if an answer is correct by comparing against solutions
async function checkAnswer(
  partId: string,
  answer: string
): Promise<{ isCorrect: boolean; pointsEarned: number }> {
  const solutions = await prisma.puzzlePartSolution.findMany({
    where: { partId, isCorrect: true },
  });

  for (const solution of solutions) {
    let userAnswer = answer.trim();
    let correctAnswer = solution.answer.trim();

    if (solution.ignoreCase) {
      userAnswer = userAnswer.toLowerCase();
      correctAnswer = correctAnswer.toLowerCase();
    }

    if (solution.ignoreWhitespace) {
      userAnswer = userAnswer.replace(/\s+/g, "");
      correctAnswer = correctAnswer.replace(/\s+/g, "");
    }

    if (solution.isRegex) {
      try {
        const regex = new RegExp(correctAnswer, "g");
        if (regex.test(userAnswer)) {
          return { isCorrect: true, pointsEarned: solution.points };
        }
      } catch (e) {
        // Regex error, continue
        continue;
      }
    } else if (userAnswer === correctAnswer) {
      return { isCorrect: true, pointsEarned: solution.points };
    }
  }

  return { isCorrect: false, pointsEarned: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    const { teamId, puzzleId, partId, answer } = await req.json();

    if (!teamId || !puzzleId || !partId || !answer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify puzzle exists and is a team puzzle
    const puzzle = await prisma.puzzle.findFirst({
      where: { id: puzzleId, isTeamPuzzle: true },
      include: { parts: true },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found or is not a team puzzle" },
        { status: 404 }
      );
    }

    // Validate puzzle has multiple parts (single-step puzzles are solo only)
    if (puzzle.parts.length <= 1) {
      return NextResponse.json(
        { error: "Single-step puzzles are solo only and cannot be team puzzles" },
        { status: 400 }
      );
    }

    // Verify user is team member and part is assigned to them
    const assignment = await prisma.teamPuzzlePartAssignment.findFirst({
      where: {
        teamId,
        puzzleId,
        partId,
        assignedToUserId: userId,
      },
      include: { part: true, puzzle: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "You are not assigned to this puzzle part" },
        { status: 403 }
      );
    }

    // Check if answer is correct
    const { isCorrect, pointsEarned } = await checkAnswer(partId, answer);

    // Record submission
    const submission = await prisma.teamPuzzlePartSubmission.create({
      data: {
        teamId,
        puzzleId,
        partId,
        submittedByUserId: userId,
        answer,
        isCorrect,
        attempts: 1,
        solvedAt: isCorrect ? new Date() : null,
      },
      include: {
        submittedByUser: { select: { name: true, email: true } },
        part: { select: { title: true, order: true } },
      },
    });

    if (isCorrect) {
      // Check if all parts are solved
      const unsolvedParts = await prisma.teamPuzzlePartSubmission.findMany({
        where: {
          teamId,
          puzzleId,
          isCorrect: false,
        },
        distinct: ["partId"],
      });

      const allPuzzleParts = await prisma.puzzlePart.findMany({
        where: { puzzleId },
      });

      const solvedPartIds = new Set(
        (
          await prisma.teamPuzzlePartSubmission.findMany({
            where: { teamId, puzzleId, isCorrect: true },
            distinct: ["partId"],
          })
        ).map((s: any) => s.partId)
      );

      const allPartsSolved = allPuzzleParts.every((part: any) =>
        solvedPartIds.has(part.id)
      );

      if (allPartsSolved) {
        // Create team puzzle completion
        const totalPoints = allPuzzleParts.reduce(
          (sum: number, part: any) => sum + part.pointsValue,
          0
        );

        await prisma.teamPuzzleCompletion.create({
          data: {
            teamId,
            puzzleId,
            totalPointsEarned: totalPoints,
          },
        });

        // Award achievements and points to all team members
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId },
          select: { userId: true },
        });

        // For each team member, award them:
        // 1. The points
        // 2. Mark as solved in their UserPuzzleProgress
        // 3. Trigger any applicable achievements

        for (const member of teamMembers) {
          // Update or create user puzzle progress
          let userProgress = await prisma.userPuzzleProgress.findFirst({
            where: {
              userId: member.userId,
              puzzleId,
            },
          });

          if (!userProgress) {
            userProgress = await prisma.userPuzzleProgress.create({
              data: {
                userId: member.userId,
                puzzleId,
                solved: true,
                solvedAt: new Date(),
                pointsEarned: totalPoints,
                successfulAttempts: 1,
              },
            });
          } else {
            await prisma.userPuzzleProgress.update({
              where: { id: userProgress.id },
              data: {
                solved: true,
                solvedAt: new Date(),
                pointsEarned: Math.max(
                  userProgress.pointsEarned,
                  totalPoints
                ), // Only award max points once
              },
            });
          }
        }

        return NextResponse.json(
          {
            success: true,
            submission,
            teamPuzzleComplete: true,
            message: "All team members have solved their parts! Puzzle complete!",
          },
          { status: 201 }
        );
      } else {
        return NextResponse.json(
          {
            success: true,
            submission,
            teamPuzzleComplete: false,
            message: "Part solved! Waiting for other team members...",
          },
          { status: 201 }
        );
      }
    } else {
      // Increment attempts for this part
      const existingSubmission = await prisma.teamPuzzlePartSubmission.findFirst(
        {
          where: {
            teamId,
            puzzleId,
            partId,
            submittedByUserId: userId,
          },
          orderBy: { createdAt: "desc" },
        }
      );

      if (existingSubmission) {
        await prisma.teamPuzzlePartSubmission.update({
          where: { id: existingSubmission.id },
          data: {
            attempts: { increment: 1 },
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          submission,
          message: "Incorrect answer. Please try again.",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error submitting team puzzle part:", error);
    return NextResponse.json(
      { error: "Failed to submit puzzle part" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const teamId = searchParams.get("teamId");
    const puzzleId = searchParams.get("puzzleId");

    if (!teamId || !puzzleId) {
      return NextResponse.json(
        { error: "teamId and puzzleId are required" },
        { status: 400 }
      );
    }

    // Get team puzzle status
    const submissions = await prisma.teamPuzzlePartSubmission.findMany({
      where: { teamId, puzzleId },
      include: {
        submittedByUser: { select: { id: true, name: true } },
        part: { select: { id: true, title: true, order: true } },
      },
      orderBy: [{ part: { order: "asc" } }, { createdAt: "desc" }],
    });

    // Get part assignments
    const assignments = await prisma.teamPuzzlePartAssignment.findMany({
      where: { teamId, puzzleId },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        part: { select: { id: true, title: true, order: true } },
      },
      orderBy: { part: { order: "asc" } },
    });

    // Get completion status
    const completion = await prisma.teamPuzzleCompletion.findFirst({
      where: { teamId, puzzleId },
    });

    return NextResponse.json({
      submissions,
      assignments,
      completed: !!completion,
      totalPoints: completion?.totalPointsEarned || 0,
    });
  } catch (error) {
    console.error("Error fetching team puzzle status:", error);
    return NextResponse.json(
      { error: "Failed to fetch team puzzle status" },
      { status: 500 }
    );
  }
}
