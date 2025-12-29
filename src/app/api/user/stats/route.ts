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

    // Get total puzzles solved
    const solvedCount = await prisma.userPuzzleProgress.count({
      where: { userId: user.id, solved: true },
    });

    // Get total points earned
    const pointsData = await prisma.userPuzzleProgress.aggregate({
      where: { userId: user.id, solved: true },
      _sum: { pointsEarned: true },
    });

    // Get number of teams the user is in
    const teamCount = await prisma.teamMember.count({
      where: { userId: user.id },
    });

    // Get user's global rank
    const allUsers = await prisma.userPuzzleProgress.groupBy({
      by: ["userId"],
      where: { solved: true },
      _sum: { pointsEarned: true },
      orderBy: { _sum: { pointsEarned: "desc" } },
    });

    const userRank = allUsers.findIndex((u) => u.userId === user.id) + 1;

    return NextResponse.json({
      totalPuzzlesSolved: solvedCount,
      totalPoints: pointsData._sum.pointsEarned || 0,
      currentTeams: teamCount,
      rank: userRank > 0 ? userRank : null,
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    );
  }
}
