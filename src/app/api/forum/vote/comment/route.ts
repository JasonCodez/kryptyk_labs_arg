import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Vote on a forum comment
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
    const { commentId, voteType } = body;

    if (!commentId || !voteType) {
      return NextResponse.json(
        { error: "commentId and voteType are required" },
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
    const existingVote = await prisma.forumCommentVote.findUnique({
      where: {
        userId_commentId: {
          userId: user.id,
          commentId,
        },
      },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Remove vote if clicking same type
        await prisma.forumCommentVote.delete({
          where: { id: existingVote.id },
        });

        // Decrement the vote count
        if (voteType === "up") {
          await prisma.forumComment.update({
            where: { id: commentId },
            data: { upvotes: { decrement: 1 } },
          });
        } else {
          await prisma.forumComment.update({
            where: { id: commentId },
            data: { downvotes: { decrement: 1 } },
          });
        }
      } else {
        // User already voted with a different type - not allowed to switch
        return NextResponse.json(
          { error: "You have already voted on this comment" },
          { status: 400 }
        );
      }
    } else {
      // Create new vote
      await prisma.forumCommentVote.create({
        data: {
          userId: user.id,
          commentId,
          voteType,
        },
      });

      // Increment the vote count
      if (voteType === "up") {
        await prisma.forumComment.update({
          where: { id: commentId },
          data: { upvotes: { increment: 1 } },
        });
      } else {
        await prisma.forumComment.update({
          where: { id: commentId },
          data: { downvotes: { increment: 1 } },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error voting on comment:", error);
    return NextResponse.json(
      { error: "Failed to vote" },
      { status: 500 }
    );
  }
}
