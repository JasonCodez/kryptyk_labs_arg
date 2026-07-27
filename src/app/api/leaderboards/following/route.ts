import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function normalizeFollowingId(value: unknown): string | null {
  if (!isNonArrayObject(value)) {
    return null;
  }

  const { followingId } = value;
  return isNonBlankString(followingId) ? followingId : null;
}

interface SafeFollowingLeaderboardUser {
  id: string;
  name: string | null;
  image: string | null;
  totalPoints: number;
  purchasedPoints: number;
  activeFlair: string | null;
}

function normalizeLeaderboardUser(
  value: unknown,
  allowedIds: Set<string>
): SafeFollowingLeaderboardUser | null {
  if (!isNonArrayObject(value)) {
    return null;
  }

  const { id, name, image, totalPoints, purchasedPoints, activeFlair, isHidden, isBot } = value;

  if (isHidden === true || isBot === true) {
    return null;
  }

  if (!isNonBlankString(id) || !allowedIds.has(id)) {
    return null;
  }

  if (!isStringOrNull(name) || !isStringOrNull(image)) {
    return null;
  }

  if (typeof totalPoints !== "number" || !Number.isFinite(totalPoints)) {
    return null;
  }

  if (typeof purchasedPoints !== "number" || !Number.isFinite(purchasedPoints)) {
    return null;
  }

  if (!isStringOrNull(activeFlair)) {
    return null;
  }

  return { id, name, image, totalPoints, purchasedPoints, activeFlair };
}

/**
 * GET /api/leaderboards/following
 * Returns a ranked leaderboard of only the users the current user follows,
 * plus the current user themselves, sorted by earned points.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
    let currentUserId: string | null =
      typeof sessionUserId === "string" && sessionUserId.trim()
        ? sessionUserId.trim()
        : null;

    const sessionEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim() : "";

    if (!currentUserId && !sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });

      if (!currentUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      currentUserId = currentUser.id;
    }

    // Get all users this person follows, excluding hidden and bot accounts.
    const follows = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        following: {
          isHidden: false,
          isBot: false,
        },
      },
      select: { followingId: true },
    });

    const followingIds = [
      ...new Set(
        follows
          .map(normalizeFollowingId)
          .filter((id): id is string => id !== null)
      ),
    ];

    // Always include the current user in their own "Following" leaderboard
    const relevantIds = [...new Set([currentUserId, ...followingIds])];

    const users = await prisma.user.findMany({
      where: { id: { in: relevantIds }, isHidden: false, isBot: false },
      select: { id: true, name: true, image: true, totalPoints: true, purchasedPoints: true, activeFlair: true },
    });

    const allowedIds = new Set(relevantIds);
    const safeUsers = users
      .map((user) => normalizeLeaderboardUser(user, allowedIds))
      .filter((user): user is SafeFollowingLeaderboardUser => user !== null);

    const safeUserIds = safeUsers.map((user) => user.id);

    const solvedCounts = safeUserIds.length
      ? await prisma.userPuzzleProgress.groupBy({
          by: ["userId"],
          where: {
            userId: { in: safeUserIds },
            solved: true,
          },
          _count: { _all: true },
        })
      : [];

    const safeUserIdSet = new Set(safeUserIds);
    const solvedCountByUserId = new Map<string, number>();
    for (const row of solvedCounts) {
      if (!isNonArrayObject(row)) continue;
      const { userId, _count } = row as { userId?: unknown; _count?: unknown };
      if (!isNonBlankString(userId) || !safeUserIdSet.has(userId)) continue;
      if (!isNonArrayObject(_count)) continue;
      const all = (_count as { _all?: unknown })._all;
      if (typeof all !== "number" || !Number.isFinite(all) || all < 0 || !Number.isInteger(all)) continue;
      solvedCountByUserId.set(userId, all);
    }

    // Batch-fetch premium season pass holders, limited to safe visible users.
    const premiumPasses = safeUserIds.length
      ? await prisma.userSeasonPass.findMany({
          where: { userId: { in: safeUserIds }, isPremium: true },
          select: { userId: true },
        })
      : [];

    const premiumIds = new Set<string>();
    for (const row of premiumPasses) {
      if (!isNonArrayObject(row)) continue;
      const { userId } = row as { userId?: unknown };
      if (isNonBlankString(userId) && safeUserIdSet.has(userId)) {
        premiumIds.add(userId);
      }
    }

    const entries = safeUsers.map((user) => {
      const earnedPoints = user.totalPoints - user.purchasedPoints;
      const puzzlesSolved = solvedCountByUserId.get(user.id) ?? 0;
      return {
        userId: user.id,
        userName: user.name,
        userImage: user.image,
        activeFlair: resolveFlair(user.activeFlair),
        isPremium: premiumIds.has(user.id),
        puzzlesSolved,
        totalPoints: earnedPoints,
        rank: 0,
        isCurrentUser: user.id === currentUserId,
      };
    });

    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const userRank = entries.find((e) => e.isCurrentUser) ?? null;

    const followingIdSet = new Set(followingIds);
    const visibleFollowingCount = safeUsers.filter(
      (user) => user.id !== currentUserId && followingIdSet.has(user.id)
    ).length;

    return NextResponse.json({ entries, userRank, followingCount: visibleFollowingCount });
  } catch (error) {
    console.error("[leaderboards/following] error:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
