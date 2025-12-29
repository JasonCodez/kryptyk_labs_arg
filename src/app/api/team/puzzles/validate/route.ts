import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

    // Verify user is team member
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Not a member of this team" },
        { status: 403 }
      );
    }

    // Get puzzle and its parts
    const puzzle = await prisma.puzzle.findFirst({
      where: { id: puzzleId },
      include: { parts: true },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    // Get team members for this puzzle
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
    });

    // Validation logic
    const validations = {
      isSoloPuzzle: puzzle.parts.length <= 1,
      isTeamPuzzle: puzzle.isTeamPuzzle,
      partCount: puzzle.parts.length,
      teamSize: teamMembers.length,
      minTeamSize: puzzle.minTeamSize,
      canAttempt: false,
      errors: [] as string[],
    };

    // Check constraints
    if (puzzle.parts.length <= 1) {
      // Solo only puzzle
      if (puzzle.isTeamPuzzle) {
        validations.errors.push(
          "This puzzle is incorrectly marked as team puzzle. Single-step puzzles must be solo only."
        );
      }
      validations.isSoloPuzzle = true;
      validations.isTeamPuzzle = false;
    } else {
      // Multi-part puzzle
      if (!puzzle.isTeamPuzzle) {
        validations.errors.push(
          `This puzzle has ${puzzle.parts.length} parts. For team collaboration, it should be marked as a team puzzle.`
        );
      }

      // Check team size constraints
      if (teamMembers.length > puzzle.parts.length) {
        validations.errors.push(
          `Team has ${teamMembers.length} members but puzzle only has ${puzzle.parts.length} parts. Maximum team size for this puzzle is ${puzzle.parts.length} (one member per part). Remove ${teamMembers.length - puzzle.parts.length} members.`
        );
      }

      if (teamMembers.length < puzzle.minTeamSize) {
        validations.errors.push(
          `This puzzle requires at least ${puzzle.minTeamSize} team members. Your team has ${teamMembers.length}. Add ${puzzle.minTeamSize - teamMembers.length} more member(s).`
        );
      }
    }

    // Can attempt if no errors
    validations.canAttempt = validations.errors.length === 0;

    return NextResponse.json(validations);
  } catch (error) {
    console.error("Error validating team puzzle:", error);
    return NextResponse.json(
      { error: "Failed to validate puzzle" },
      { status: 500 }
    );
  }
}
