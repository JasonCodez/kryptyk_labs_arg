import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  aggregateTeamScoreFromMembershipWindow,
  buildMembershipStartByUserId,
  filterProgressByMembershipWindow,
  indexProgressByUserId,
  summarizeProgressRows,
} from "@/lib/team-membership-scoring";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        isPublic: true,
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (!team.isPublic) {
      const session = await getServerSession(authOptions);
      const isMember = !!session?.user?.email
        && team.members.some((m) => m.user.email === session.user?.email);
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const memberIds = team.members.map((m) => m.userId);
    const membershipStartByUserId = buildMembershipStartByUserId(
      team.members.map((member) => ({
        userId: member.userId,
        joinedAt: member.joinedAt,
      }))
    );

    // Only count puzzle solves earned while the member was actively on this team.
    const memberProgress = await prisma.userPuzzleProgress.findMany({
      where: {
        userId: { in: memberIds },
        solved: true,
        solvedAt: { not: null },
      },
      select: {
        userId: true,
        pointsEarned: true,
        solvedAt: true,
        puzzle: {
          select: {
            id: true,
            title: true,
            puzzleType: true,
            difficulty: true,
          },
        },
      },
    });

    const eligibleMemberProgress = filterProgressByMembershipWindow(
      memberProgress,
      membershipStartByUserId
    );
    const eligibleProgressByUserId = indexProgressByUserId(eligibleMemberProgress);

    // Build per-member stats
    const memberStats = team.members.map((m) => {
      const solved = eligibleProgressByUserId.get(m.userId) ?? [];
      const { totalPoints: earnedPoints } = summarizeProgressRows(solved);
      return {
        userId: m.userId,
        name: m.user.name,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt,
        earnedPoints,
        puzzlesSolved: solved.length,
      };
    });

    // Sort by earned points descending for top contributors
    const topContributors = [...memberStats].sort((a, b) => b.earnedPoints - a.earnedPoints);

    // Total team stats
    const { totalPoints: totalEarnedPoints, totalSolved: totalPuzzlesSolved } = summarizeProgressRows(eligibleMemberProgress);
    const avgPointsPerMember = memberIds.length > 0 ? Math.round(totalEarnedPoints / memberIds.length) : 0;

    // Team rank — apply the same membership-window rule to all teams.
    const allTeams = await prisma.team.findMany({
      select: {
        id: true,
        members: {
          select: {
            userId: true,
            joinedAt: true,
          },
        },
      },
    });

    const allUserIds = Array.from(
      new Set(
        allTeams.flatMap((t) => t.members.map((m) => m.userId))
      )
    );

    const allProgress = allUserIds.length
      ? await prisma.userPuzzleProgress.findMany({
          where: {
            userId: { in: allUserIds },
            solved: true,
            solvedAt: { not: null },
          },
          select: {
            userId: true,
            pointsEarned: true,
            solvedAt: true,
          },
        })
      : [];

    const progressByUserId = indexProgressByUserId(allProgress);

    const teamScores = allTeams
      .filter((t) => t.members.length > 0)
      .map((t) => ({
        teamId: t.id,
        totalEarned: aggregateTeamScoreFromMembershipWindow(
          t.members,
          progressByUserId
        ).totalPoints,
      }))
      .sort((a, b) => b.totalEarned - a.totalEarned);

    const rank = teamScores.findIndex((t) => t.teamId === teamId) + 1;
    const totalTeams = teamScores.length;

    // Recent activity — last 20 puzzles solved by team members
    const recentSolves = eligibleMemberProgress
      .filter((p) => p.solvedAt)
      .sort((a, b) => new Date(b.solvedAt!).getTime() - new Date(a.solvedAt!).getTime())
      .slice(0, 20)
      .map((p) => {
        const member = team.members.find((m) => m.userId === p.userId);
        return {
          userName: member?.user.name ?? "Unknown",
          userImage: member?.user.image ?? null,
          puzzleTitle: p.puzzle.title,
          puzzleType: p.puzzle.puzzleType,
          difficulty: p.puzzle.difficulty,
          pointsEarned: p.pointsEarned,
          solvedAt: p.solvedAt,
        };
      });

    return NextResponse.json({
      rank,
      totalTeams,
      totalEarnedPoints,
      totalPuzzlesSolved,
      avgPointsPerMember,
      memberCount: memberIds.length,
      topContributors,
      recentActivity: recentSolves,
    });
  } catch (error) {
    console.error("Error fetching team stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch team stats" },
      { status: 500 }
    );
  }
}
