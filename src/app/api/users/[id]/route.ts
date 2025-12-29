import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = id;

    // Get user profile with public info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        achievements: {
          include: {
            achievement: {
              select: {
                id: true,
                name: true,
                title: true,
                description: true,
                icon: true,
                category: true,
                rarity: true,
              },
            },
          },
          orderBy: { unlockedAt: "desc" },
        },
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user stats
    const solvedPuzzles = await prisma.userPuzzleProgress.count({
      where: { userId, solved: true },
    });

    const totalPoints = await prisma.userPuzzleProgress.aggregate({
      where: { userId },
      _sum: { pointsEarned: true },
    });

    // Get follower counts
    const followerCount = await prisma.follow.count({
      where: { followingId: userId },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: userId },
    });

    // Check if current user is following this user
    const session = await getServerSession(authOptions);
    let isFollowing = false;
    if (session?.user?.email) {
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (currentUser && currentUser.id !== userId) {
        isFollowing = !!(await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUser.id,
              followingId: userId,
            },
          },
        }));
      }
    }

    return NextResponse.json({
      ...user,
      stats: {
        puzzlesSolved: solvedPuzzles,
        totalPoints: totalPoints._sum.pointsEarned || 0,
        achievementsCount: user.achievements.length,
        teamsCount: user.teams.length,
      },
      social: {
        followers: followerCount,
        following: followingCount,
        isFollowing,
      },
    });
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
