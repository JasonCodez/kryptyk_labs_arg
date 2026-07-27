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

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function serializeFollowListUser(
  value: unknown,
  viewerId: string | null,
  viewerFollowingSet: Set<string>
): PublicFollowListUser | null {
  if (!isNonArrayObject(value)) {
    return null;
  }

  const following = value.following;
  if (!isNonArrayObject(following)) {
    return null;
  }

  const { id, name, image, isHidden } = following;

  if (!isNonBlankString(id) || !isStringOrNull(name) || !isStringOrNull(image)) {
    return null;
  }

  if (isHidden === true) {
    return null;
  }

  return {
    id,
    name,
    image: normalizeUserImageUrl(image),
    isSelf: viewerId === id,
    isFollowing: viewerFollowingSet.has(id),
  };
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
        followerId: userId,
        following: {
          isHidden: false,
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        following: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);

    const visibleUserIds = page
      .map((row) => (isNonArrayObject(row) && isNonArrayObject(row.following) ? row.following.id : null))
      .filter((id): id is string => isNonBlankString(id));

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

    const users = page
      .map((row) => serializeFollowListUser(row, viewerId, viewerFollowingSet))
      .filter((user): user is PublicFollowListUser => user !== null);

    return NextResponse.json({
      users,
      nextCursor: hasMore ? rows[PAGE_SIZE - 1].id : null,
    });
  } catch (error) {
    console.error("Failed to fetch following:", error);
    return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
  }
}
