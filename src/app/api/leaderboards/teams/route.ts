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

    // Get all teams with their members and stats
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Calculate team rankings
    const entries = await Promise.all(
      teams.map(async (team) => {
        // Get team members
        const members = await prisma.teamMember.findMany({
          where: { teamId: team.id },
          select: { userId: true },
        });

        // Get progress for all team members
        const allProgress = await prisma.userPuzzleProgress.findMany({
          where: {
            userId: { in: members.map((m) => m.userId) },
            solved: true,
          },
          select: { pointsEarned: true },
        });

        return {
          teamId: team.id,
          teamName: team.name,
          totalPoints: allProgress.reduce((sum: number, p) => sum + p.pointsEarned, 0),
          totalPuzzlesSolved: allProgress.length,
          memberCount: members.length,
          rank: 0,
        };
      })
    );

    // Sort and rank
    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Find user's team rank
    const userTeams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            user: { email: session.user.email },
          },
        },
      },
      select: { id: true },
    });

    let userTeamRank = null;
    if (userTeams.length > 0) {
      userTeamRank = entries.find((e) => e.teamId === userTeams[0].id) || null;
    }

    return NextResponse.json({
      entries,
      userTeamRank,
    });
  } catch (error) {
    console.error("Error fetching team leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch team leaderboard" },
      { status: 500 }
    );
  }
}
