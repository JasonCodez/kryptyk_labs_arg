import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

import { calcLevel } from "@/lib/levels";

const MAX_BIO_LENGTH = 280;

// Every field GET and PUT both need to return -- kept in one place so a PUT
// response can never silently drop a field the client relies on (a previous
// version of PUT selected a smaller subset, and since the client replaces its
// whole profile state with whatever PUT returns, saving the profile briefly
// reset cosmetics like the active theme back to default until the next load).
const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  bio: true,
  role: true,
  createdAt: true,
  xp: true,
  level: true,
  xpTitle: true,
  activeTheme: true,
  activeFrame: true,
  activeSkin: true,
  activeCompletionAnimation: true,
  activeFlair: true,
  activeNameColor: true,
  activeTitle: true,
  isFounder: true,
  totalPoints: true,
  purchasedPoints: true,
} as const;

type ProfileUser = {
  id: string;
  xp: number | null;
  level: number | null;
  xpTitle: string | null;
  totalPoints: number | null;
  purchasedPoints: number | null;
  activeCompletionAnimation: string | null;
  [key: string]: unknown;
};

async function buildProfilePayload(user: ProfileUser) {
  // Earned points = total - purchased (consistent with leaderboard)
  const earnedPoints = (user.totalPoints ?? 0) - (user.purchasedPoints ?? 0);
  // Solve count must come from solved puzzle records so spending points never lowers it.
  const solvedCount = await prisma.userPuzzleProgress.count({
    where: { userId: user.id, solved: true },
  });

  // Get user's global rank (based on earned points, excluding purchased)
  const allUsers = await prisma.user.findMany({
    where: { isHidden: false, role: { not: "admin" } },
    select: { id: true, totalPoints: true, purchasedPoints: true },
  });
  const sorted = allUsers
    .map(u => ({ userId: u.id, earned: (u.totalPoints ?? 0) - (u.purchasedPoints ?? 0) }))
    .sort((a, b) => b.earned - a.earned);
  const userRank = sorted.findIndex(u => u.userId === user.id) + 1;

  const followerCount = await prisma.follow.count({
    where: { followingId: user.id },
  });
  const followingCount = await prisma.follow.count({
    where: { followerId: user.id },
  });

  let level = user.level ?? 1;
  let xpTitle = user.xpTitle ?? "Newcomer";
  let xpProgress = 0;
  let xpToNextLevel = 100;
  try {
    const lvl = calcLevel(user.xp ?? 0);
    level = lvl.level;
    xpTitle = lvl.title;
    xpProgress = lvl.progress;
    xpToNextLevel = lvl.nextLevelXp - lvl.currentXp;
  } catch (xpErr) {
    console.error("XP calc error:", xpErr);
  }

  return {
    ...user,
    level,
    xpTitle,
    totalPuzzlesSolved: solvedCount,
    totalPoints: earnedPoints,
    rank: userRank > 0 ? userRank : null,
    xpProgress,
    xpToNextLevel,
    activeCompletionAnimation: user.activeCompletionAnimation ?? "default",
    social: {
      followers: followerCount,
      following: followingCount,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(await buildProfilePayload(user));
  } catch (error) {
    console.error("Profile GET error:", error instanceof Error ? error.message : String(error), error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, bio } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    if (bio !== undefined && typeof bio !== "string") {
      return NextResponse.json({ error: "Invalid bio" }, { status: 400 });
    }
    const trimmedBio = typeof bio === "string" ? bio.trim() : undefined;
    if (trimmedBio !== undefined && trimmedBio.length > MAX_BIO_LENGTH) {
      return NextResponse.json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer` }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true },
    });
    const trimmedName = name.trim();
    const nameChanged = trimmedName !== existingUser?.name;

    // Only re-validate the display name if it's actually changing -- some
    // existing names (e.g. OAuth-provided ones with spaces) predate the
    // stricter format rules below and shouldn't block saving other fields
    // like bio just because the unchanged name wouldn't pass today's rules.
    if (nameChanged) {
      // Validate display name against profanity + reserved words
      const { isAllowedDisplayName } = await import("@/lib/display-name-validator");
      const nameCheck = isAllowedDisplayName(trimmedName);
      if (!nameCheck.ok) {
        return NextResponse.json({ error: nameCheck.reason }, { status: 400 });
      }

      // Check if display name is already taken by another user (case-insensitive)
      const nameTaken = await prisma.user.findFirst({
        where: {
          name: { equals: trimmedName, mode: "insensitive" },
          NOT: { email: session.user.email },
        },
      });
      if (nameTaken) {
        return NextResponse.json({ error: "Display name is already taken" }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: trimmedName,
        ...(trimmedBio !== undefined ? { bio: trimmedBio.length > 0 ? trimmedBio : null } : {}),
      },
      select: PROFILE_SELECT,
    });

    return NextResponse.json(await buildProfilePayload(user));
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
