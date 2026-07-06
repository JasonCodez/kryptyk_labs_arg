import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeUserImageUrl } from "@/lib/userImage";

const PAGE_SIZE = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const cursor = request.nextUrl.searchParams.get("cursor");

    const session = await getServerSession(authOptions);
    let viewerId: string | null = null;
    if (session?.user?.email) {
      const viewer = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      viewerId = viewer?.id ?? null;
    }

    const rows = await prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        follower: {
          select: { id: true, name: true, image: true, isHidden: true },
        },
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE).filter((row) => !row.follower.isHidden);

    let viewerFollowingSet = new Set<string>();
    if (viewerId && page.length > 0) {
      const viewerFollows = await prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: page.map((row) => row.follower.id) },
        },
        select: { followingId: true },
      });
      viewerFollowingSet = new Set(viewerFollows.map((f) => f.followingId));
    }

    const users = page.map((row) => ({
      id: row.follower.id,
      name: row.follower.name,
      image: normalizeUserImageUrl(row.follower.image),
      isSelf: viewerId === row.follower.id,
      isFollowing: viewerFollowingSet.has(row.follower.id),
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
