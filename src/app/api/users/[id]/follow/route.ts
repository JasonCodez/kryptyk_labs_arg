import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

function getFollowerDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return "A player";
  }

  const trimmed = value.trim();
  return trimmed || "A player";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const { id } = await params;
    const session = await getServerSession(authOptions);

    const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
    let requesterUserId =
      typeof sessionUserId === "string" && sessionUserId.trim()
        ? sessionUserId.trim()
        : null;

    const sessionEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim() : "";

    if (!requesterUserId && !sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!requesterUserId) {
      const requester = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });

      if (!requester) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      requesterUserId = requester.id;
    }

    const targetUserId = id;

    // Can't follow yourself
    if (requesterUserId === targetUserId) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === "follow") {
      // Create follow relationship
      await prisma.follow.create({
        data: {
          followerId: requesterUserId,
          followingId: targetUserId,
        },
      });

      // Send notification to the followed user
      try {
        const followerDisplayName = getFollowerDisplayName(session?.user?.name);
        const { createNotification } = await import("@/lib/notification-service");
        await createNotification({
          userId: targetUserId,
          type: "system",
          title: "New Follower!",
          message: `${followerDisplayName} started following you!`,
          icon: "👥",
          relatedId: requesterUserId,
        });
      } catch (e) {
        console.error("Failed to send follow notification:", e);
      }

      return NextResponse.json({ message: "Successfully followed user" });
    } else if (action === "unfollow") {
      // Delete follow relationship
      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: requesterUserId,
            followingId: targetUserId,
          },
        },
      });

      return NextResponse.json({ message: "Successfully unfollowed user" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update follow status:", error);
    return NextResponse.json(
      { error: "Failed to update follow status" },
      { status: 500 }
    );
  }
}
