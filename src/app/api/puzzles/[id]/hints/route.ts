import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET /api/puzzles/[id]/hints - Fetch all hints with history and stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    const puzzle = await prisma.puzzle.findUnique({
      where: { id },
      include: {
        hints: {
          orderBy: { order: "asc" },
          include: {
            history: {
              where: session?.user?.email
                ? {
                    user: { email: session.user.email },
                  }
                : undefined,
              orderBy: { revealedAt: "desc" },
              take: 10, // Get recent usage
            },
          },
        },
      },
    });

    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    // Transform hints to include stats and user's history
    const hintsWithStats = puzzle.hints.map((hint: any) => ({
      ...hint,
      stats: {
        totalUsages: hint.totalUsages,
        timesLeadToSolve: hint.timesLeadToSolve,
        successRate:
          hint.totalUsages > 0
            ? Math.round((hint.timesLeadToSolve / hint.totalUsages) * 100)
            : 0,
        averageTimeToSolve: hint.averageTimeToSolve,
      },
      userHistory: hint.history,
    }));

    return NextResponse.json(hintsWithStats);
  } catch (error) {
    console.error("Failed to fetch hints:", error);
    return NextResponse.json(
      { error: "Failed to fetch hints" },
      { status: 500 }
    );
  }
}

// POST /api/puzzles/[id]/hints/[hintId]/reveal - Reveal a hint and track usage
const RevealHintSchema = z.object({
  hintId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { hintId } = RevealHintSchema.parse(body);

    // Verify hint exists and belongs to puzzle
    const hint = await prisma.puzzleHint.findUnique({
      where: { id: hintId },
      include: {
        puzzle: true,
      },
    });

    if (!hint || hint.puzzle.id !== id) {
      return NextResponse.json({ error: "Hint not found" }, { status: 404 });
    }

    // Check if user has already hit the max uses per user limit
    if (hint.maxUsesPerUser) {
      const userUsageCount = await prisma.hintHistory.count({
        where: {
          hintId,
          userId: user.id,
        },
      });

      if (userUsageCount >= hint.maxUsesPerUser) {
        return NextResponse.json(
          { error: "You have reached the maximum uses for this hint" },
          { status: 400 }
        );
      }
    }

    // Check if team has hit the max uses per team limit
    if (hint.maxUsesPerTeam) {
      // Get user's teams
      const userTeams = await prisma.teamMember.findMany({
        where: { userId: user.id },
        select: { teamId: true },
      });

      const teamIds = userTeams.map((tm: { teamId: string }) => tm.teamId);

      // Count team usage (any team member)
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true },
      });

      const teamMemberIds = teamMembers.map((tm: { userId: string }) => tm.userId);

      const teamUsageCount = await prisma.hintHistory.count({
        where: {
          hintId,
          userId: { in: teamMemberIds },
        },
      });

      if (teamUsageCount >= hint.maxUsesPerTeam) {
        return NextResponse.json(
          { error: "Your team has reached the maximum uses for this hint" },
          { status: 400 }
        );
      }
    }

    // Get user's puzzle progress to check if they've already solved it
    const progress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: {
          userId: user.id,
          puzzleId: id,
        },
      },
    });

    // Create hint usage record
    const hintUsage = await prisma.hintHistory.create({
      data: {
        hintId,
        userId: user.id,
        pointsCost: hint.costPoints,
        leadToSolve: false, // Will be updated when puzzle is solved
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Update hint's total usages count
    await prisma.puzzleHint.update({
      where: { id: hintId },
      data: {
        totalUsages: hint.totalUsages + 1,
      },
    });

    return NextResponse.json(
      {
        hintText: hint.text,
        costPoints: hint.costPoints,
        usageId: hintUsage.id,
        revealedAt: hintUsage.revealedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to reveal hint:", error);
    return NextResponse.json(
      { error: "Failed to reveal hint" },
      { status: 500 }
    );
  }
}
