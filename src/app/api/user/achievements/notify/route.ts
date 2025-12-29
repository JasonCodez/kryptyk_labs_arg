import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { achievementId, achievementTitle, achievementDescription, achievementIcon } = await request.json();

    if (!achievementId) {
      return NextResponse.json(
        { error: "Achievement ID is required" },
        { status: 400 }
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

    // Create notification for achievement unlock
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: "achievement_unlock",
        title: `Achievement Unlocked: ${achievementTitle}`,
        message: achievementDescription,
        relatedId: achievementId,
        icon: achievementIcon,
      },
    });

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Achievement notification error:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
