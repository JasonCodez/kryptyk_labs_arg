import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, puzzleId, assignments } = await req.json();

    if (!teamId || !puzzleId || !assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // Verify user is team admin
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        user: { email: session.user.email },
        role: { in: ["admin", "moderator"] },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team admins can assign puzzle parts" },
        { status: 403 }
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

    // Validate team size doesn't exceed number of parts
    // Max team size = number of parts (each member solves one part)
    const maxTeamSize = puzzle.parts.length;
    const uniqueMembers = new Set(assignments.map((a: any) => a.assignedToUserId));
    if (uniqueMembers.size > maxTeamSize) {
      return NextResponse.json(
        { error: `This puzzle has ${maxTeamSize} parts. Maximum ${maxTeamSize} unique team members allowed (one per part). You tried to assign ${uniqueMembers.size} members.` },
        { status: 400 }
      );
    }

    // Verify all team members exist
    const teamMemberIds = assignments.map((a: any) => a.assignedToUserId);
    const members = await prisma.teamMember.findMany({
      where: { teamId, userId: { in: teamMemberIds } },
    });

    if (members.length !== teamMemberIds.length) {
      return NextResponse.json(
        { error: "Some team members not found" },
        { status: 400 }
      );
    }

    // Clear existing assignments for this puzzle
    await prisma.teamPuzzlePartAssignment.deleteMany({
      where: { teamId, puzzleId },
    });

    // Create new assignments
    const createdAssignments = await Promise.all(
      assignments.map((assignment: any) =>
        prisma.teamPuzzlePartAssignment.create({
          data: {
            teamId,
            puzzleId,
            partId: assignment.partId,
            assignedToUserId: assignment.assignedToUserId,
          },
          include: {
            assignedToUser: { select: { id: true, name: true, email: true } },
            part: { select: { id: true, title: true, order: true } },
          },
        })
      )
    );

    return NextResponse.json(
      {
        success: true,
        assignments: createdAssignments,
        message: "Part assignments created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error assigning puzzle parts:", error);
    return NextResponse.json(
      { error: "Failed to assign puzzle parts" },
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
        user: { email: session.user.email },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Not a member of this team" },
        { status: 403 }
      );
    }

    // Get assignments
    const assignments = await prisma.teamPuzzlePartAssignment.findMany({
      where: { teamId, puzzleId },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        part: { select: { id: true, title: true, order: true, content: true } },
      },
      orderBy: { part: { order: "asc" } },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching puzzle assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzle assignments" },
      { status: 500 }
    );
  }
}
