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

    // Get or create user preferences
    let userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!userPreferences) {
      userPreferences = await prisma.userPreferences.create({
        data: { userId: user.id },
      });
    }

    const settings = {
      // Theme preferences
      themeBrightness: userPreferences.themeBrightness,
      
      // Font preferences
      fontSize: userPreferences.fontSize,
      
      // Spacing mode
      spacingMode: userPreferences.spacingMode,
      
      // Additional UI preferences
      reduceAnimations: userPreferences.reduceAnimations,
      colorContrast: userPreferences.colorContrast,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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

    // Validate and sanitize preferences
    const validSettings = {
      themeBrightness: ["light", "medium", "dark"].includes(body.themeBrightness)
        ? body.themeBrightness
        : "medium",
      fontSize: ["small", "medium", "large", "extra-large"].includes(body.fontSize)
        ? body.fontSize
        : "medium",
      spacingMode: ["compact", "comfortable", "spacious"].includes(body.spacingMode)
        ? body.spacingMode
        : "comfortable",
      reduceAnimations: typeof body.reduceAnimations === "boolean"
        ? body.reduceAnimations
        : false,
      colorContrast: ["normal", "high"].includes(body.colorContrast)
        ? body.colorContrast
        : "normal",
    };

    // Get or create user preferences
    let userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!userPreferences) {
      userPreferences = await prisma.userPreferences.create({
        data: {
          userId: user.id,
          ...validSettings,
        },
      });
    } else {
      userPreferences = await prisma.userPreferences.update({
        where: { userId: user.id },
        data: validSettings,
      });
    }

    return NextResponse.json({
      themeBrightness: userPreferences.themeBrightness,
      fontSize: userPreferences.fontSize,
      spacingMode: userPreferences.spacingMode,
      reduceAnimations: userPreferences.reduceAnimations,
      colorContrast: userPreferences.colorContrast,
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
