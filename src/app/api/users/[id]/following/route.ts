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
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        following: {
          select: { id: true, name: true, image: true, isHidden: true },
        },
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE).filter((row) => !row.following.isHidden);

    let viewerFollowingSet = new Set<string>();
    if (viewerId && page.length > 0) {
      const viewerFollows = await prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: page.map((row) => row.following.id) },
        },
        select: { followingId: true },
      });
      viewerFollowingSet = new Set(viewerFollows.map((f) => f.followingId));
    }

    const users = page.map((row) => ({
      id: row.following.id,
      name: row.following.name,
      image: normalizeUserImageUrl(row.following.image),
      isSelf: viewerId === row.following.id,
      isFollowing: viewerFollowingSet.has(row.following.id),
    }));

    return NextResponse.json({
      users,
      nextCursor: hasMore ? rows[PAGE_SIZE - 1].id : null,
    });
  } catch (error) {
    console.error("Failed to fetch following:", error);
    return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
  }
}
