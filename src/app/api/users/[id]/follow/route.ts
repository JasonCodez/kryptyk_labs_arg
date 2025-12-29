import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetUserId = id;

    // Can't follow yourself
    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
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
          followerId: currentUser.id,
          followingId: targetUserId,
        },
      });

      return NextResponse.json({ message: "Successfully followed user" });
    } else if (action === "unfollow") {
      // Delete follow relationship
      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
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
