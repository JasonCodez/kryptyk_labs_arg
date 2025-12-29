import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let preference = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    // Create default preference if it doesn't exist
    if (!preference) {
      preference = await prisma.notificationPreference.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json(preference);
  } catch (error) {
    console.error("Failed to fetch notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    // Validate input
    const validKeys = [
      "emailOnPuzzleRelease",
      "emailOnAchievement",
      "emailOnTeamUpdate",
      "emailOnLeaderboard",
      "emailOnSystem",
      "enableDigest",
      "digestFrequency",
      "emailNotificationsEnabled",
    ];

    const updateData: any = {};
    for (const key of validKeys) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    let preference = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!preference) {
      preference = await prisma.notificationPreference.create({
        data: { userId: user.id, ...updateData },
      });
    } else {
      preference = await prisma.notificationPreference.update({
        where: { userId: user.id },
        data: updateData,
      });
    }

    return NextResponse.json(preference);
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    );
  }
}
