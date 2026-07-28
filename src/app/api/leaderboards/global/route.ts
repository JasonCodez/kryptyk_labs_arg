import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Map legacy word values to their emoji (for users who equipped before the fix)
const FLAIR_EMOJI: Record<string, string> = {
  crown: "👑",
  fire: "🔥",
  lightning: "⚡",
  warz_legend: "⚔️🏆",
};

function resolveFlair(value: string | null | undefined): string {
  if (!value || value === "none") return "none";
  return FLAIR_EMOJI[value] ?? value; // already an emoji → pass through
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

interface SafeGlobalLeaderboardUser {
  id: string;
  name: string | null;
  image: string | null;
  totalPoints: number;
  purchasedPoints: number;
  activeFlair: string | null;
}

function normalizeGlobalLeaderboardUser(value: unknown): SafeGlobalLeaderboardUser | null {
  if (!isNonArrayObject(value)) {
    return null;
  }

  const { id, name, image, totalPoints, purchasedPoints, activeFlair, isHidden, isBot, role } = value;

  if (isHidden === true || isBot === true || role === "admin") {
    return null;
  }

  if (!isNonBlankString(id)) {
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

interface GlobalLeaderboardEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  activeFlair: string;
  isPremium: boolean;
  puzzlesSolved: number;
  totalPoints: number;
  rank: number;
}

export async function GET(request: NextRequest) {
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

    // Get all non-hidden, non-admin, non-bot users
    const users = await prisma.user.findMany({
      where: { isHidden: false, isBot: false, role: { not: "admin" } },
      select: { id: true, name: true, image: true, totalPoints: true, purchasedPoints: true, activeFlair: true },
    });

    const seenUserIds = new Set<string>();
    const safeUsers = users
      .map(normalizeGlobalLeaderboardUser)
      .filter((user): user is SafeGlobalLeaderboardUser => user !== null)
      .filter((user) => {
        if (seenUserIds.has(user.id)) {
          return false;
        }
        seenUserIds.add(user.id);
        return true;
      });

    const safeUserIds = safeUsers.map((user) => user.id);
    const safeUserIdSet = new Set(safeUserIds);

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

    // earnedPoints = totalPoints - purchasedPoints so bought points never affect rank.
    // puzzlesSolved comes from solved progress records so spending points never lowers solve count.
    const entries: GlobalLeaderboardEntry[] = safeUsers.map((user) => {
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
      };
    });

    // Sort by earned points descending
    entries.sort((a, b) => b.totalPoints - a.totalPoints);

    // Re-rank after sorting
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Find the current player's rank from the entire safe ranked list, not just the top 100.
    const userRank = entries.find((entry) => entry.userId === currentUserId) ?? null;

    return NextResponse.json({
      entries: entries.slice(0, 100), // Top 100
      userRank,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
