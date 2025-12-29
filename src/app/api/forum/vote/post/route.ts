import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Vote on a forum post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { postId, voteType } = body;

    if (!postId || !voteType) {
      return NextResponse.json(
        { error: "postId and voteType are required" },
        { status: 400 }
      );
    }

    if (!["up", "down"].includes(voteType)) {
      return NextResponse.json(
        { error: "voteType must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // Check if user already voted
    const existingVote = await prisma.forumPostVote.findUnique({
      where: {
        userId_postId: {
          userId: user.id,
          postId,
        },
      },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Remove vote if clicking same type
        await prisma.forumPostVote.delete({
          where: { id: existingVote.id },
        });

        // Decrement the vote count
        if (voteType === "up") {
          await prisma.forumPost.update({
            where: { id: postId },
            data: { upvotes: { decrement: 1 } },
          });
        } else {
          await prisma.forumPost.update({
            where: { id: postId },
            data: { downvotes: { decrement: 1 } },
          });
        }
      } else {
        // User already voted with a different type - not allowed to switch
        return NextResponse.json(
          { error: "You have already voted on this post" },
          { status: 400 }
        );
      }
    } else {
      // Create new vote
      await prisma.forumPostVote.create({
        data: {
          userId: user.id,
          postId,
          voteType,
        },
      });

      // Increment the vote count
      if (voteType === "up") {
        await prisma.forumPost.update({
          where: { id: postId },
          data: { upvotes: { increment: 1 } },
        });
      } else {
        await prisma.forumPost.update({
          where: { id: postId },
          data: { downvotes: { increment: 1 } },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error voting on post:", error);
    return NextResponse.json(
      { error: "Failed to vote" },
      { status: 500 }
    );
  }
}
