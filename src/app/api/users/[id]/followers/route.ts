import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeUserImageUrl } from "@/lib/userImage";

const PAGE_SIZE = 30;

interface PublicFollowListUser {
  id: string;
  name: string | null;
  image: string | null;
  isSelf: boolean;
  isFollowing: boolean;
}

interface SafeFollowListIdentity {
  id: string;
  name: string | null;
  image: string | null;
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

function normalizeFollowListIdentity(value: unknown): SafeFollowListIdentity | null {
  if (!isNonArrayObject(value)) {
    return null;
  }

  const follower = value.follower;
  if (!isNonArrayObject(follower)) {
    return null;
  }

  const { id, name, image, isHidden } = follower;

  if (isHidden === true) {
    return null;
  }

  if (!isNonBlankString(id) || !isStringOrNull(name) || !isStringOrNull(image)) {
    return null;
  }

  return { id, name, image };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const cursor = request.nextUrl.searchParams.get("cursor");

    const session = await getServerSession(authOptions);

    const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
    let viewerId: string | null =
      typeof sessionUserId === "string" && sessionUserId.trim()
        ? sessionUserId.trim()
        : null;

    const sessionEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim() : "";

    if (!viewerId && sessionEmail) {
      const viewer = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });
      viewerId = viewer?.id ?? null;
    }

    const rows = await prisma.follow.findMany({
      where: {
        followingId: userId,
        follower: {
          isHidden: false,
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        follower: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);

    const safePageUsers = page
      .map(normalizeFollowListIdentity)
      .filter((user): user is SafeFollowListIdentity => user !== null);

    const visibleUserIds = safePageUsers.map((user) => user.id);

    let viewerFollowingSet = new Set<string>();
    if (viewerId && visibleUserIds.length > 0) {
      const viewerFollows = await prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: visibleUserIds },
        },
        select: { followingId: true },
      });
      viewerFollowingSet = new Set(viewerFollows.map((f) => f.followingId));
    }

    const users: PublicFollowListUser[] = safePageUsers.map((user) => ({
      id: user.id,
      name: user.name,
      image: normalizeUserImageUrl(user.image),
      isSelf: viewerId === user.id,
      isFollowing: viewerFollowingSet.has(user.id),
    }));

    return NextResponse.json({
      users,
      nextCursor: hasMore ? rows[PAGE_SIZE - 1].id : null,
    });
  } catch (error) {
    console.error("Failed to fetch followers:", error);
    return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 });
  }
}
