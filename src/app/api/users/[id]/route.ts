import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeUserImageUrl } from "@/lib/userImage";

import { calcLevel } from "@/lib/levels";

// Map legacy word values to their emoji (for users who equipped before the emoji fix)
const FLAIR_EMOJI: Record<string, string> = {
  crown: "👑",
  fire: "🔥",
  lightning: "⚡",
  warz_legend: "⚔️🏆",
};

function resolveFlair(value: string | null | undefined): string {
  if (!value || value === "none") return "none";
  return FLAIR_EMOJI[value] ?? value;
}

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
        bio: true,
        createdAt: true,
        xp: true,
        level: true,
        xpTitle: true,
        totalPoints: true,
        purchasedPoints: true,
        activeFlair: true,
        activeFrame: true,
        activeTheme: true,
        activeSkin: true,
        isHidden: true,
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

    // Hide stealth admin accounts from public profile lookups
    if ((user as any).isHidden) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user stats.
    // Solve count must come from solved puzzle records so spending points never lowers it.
    const earnedPoints = (user.totalPoints ?? 0) - (user.purchasedPoints ?? 0);
    const solvedPuzzles = await prisma.userPuzzleProgress.count({
      where: { userId, solved: true },
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

    const { level, title, currentXp, nextLevelXp, progress } = calcLevel(user.xp ?? 0);

    // Check if this user has a premium season pass
    const premiumPass = await prisma.userSeasonPass.findFirst({
      where: { userId, isPremium: true },
      select: { userId: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isHidden: _hidden, purchasedPoints: _pp, ...publicUser } = user as typeof user & { isHidden: boolean; purchasedPoints: number | null };

    return NextResponse.json({
      ...publicUser,
      image: normalizeUserImageUrl(publicUser.image),
      activeFlair: resolveFlair(user.activeFlair),
      isPremium: !!premiumPass,
      level,
      xpTitle: title,
      stats: {
        puzzlesSolved: solvedPuzzles,
        totalPoints: earnedPoints,
        achievementsCount: user.achievements.length,
        teamsCount: user.teams.length,
      },
      xpProgress: progress,
      xpToNextLevel: nextLevelXp - currentXp,
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
