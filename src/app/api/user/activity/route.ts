import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET activity feed for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30");
    const skip = parseInt(searchParams.get("skip") || "0");
    const type = searchParams.get("type"); // Filter by activity type

    const where: any = { userId: user.id };
    if (type) {
      where.type = type;
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.activity.count({ where }),
    ]);

    return NextResponse.json({
      activities,
      total,
      limit,
      skip,
    });
  } catch (error) {
    console.error("Failed to fetch activity feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500 }
    );
  }
}

// POST - Log an activity (internal use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, description, icon, relatedId, relatedType, metadata } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        type,
        title,
        description,
        icon,
        relatedId,
        relatedType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
