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
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user stats
    const stats = await prisma.userPuzzleProgress.aggregate({
      where: { userId: user.id, solved: true },
      _sum: { pointsEarned: true },
      _count: true,
    });

    // Get user's rank
    const rank = await prisma.userPuzzleProgress.groupBy({
      by: ["userId"],
      where: { solved: true },
      _sum: { pointsEarned: true },
      orderBy: { _sum: { pointsEarned: "desc" } },
    });

    const userRank = rank.findIndex((r: { userId: string }) => r.userId === user.id) + 1;

    return NextResponse.json({
      ...user,
      totalPuzzlesSolved: stats._count,
      totalPoints: stats._sum.pointsEarned || 0,
      rank: userRank > 0 ? userRank : null,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    // Get updated stats
    const stats = await prisma.userPuzzleProgress.aggregate({
      where: { userId: user.id, solved: true },
      _sum: { pointsEarned: true },
      _count: true,
    });

    // Get updated rank
    const rank = await prisma.userPuzzleProgress.groupBy({
      by: ["userId"],
      where: { solved: true },
      _sum: { pointsEarned: true },
      orderBy: { _sum: { pointsEarned: "desc" } },
    });

    const userRank = rank.findIndex((r: { userId: string }) => r.userId === user.id) + 1;

    return NextResponse.json({
      ...user,
      totalPuzzlesSolved: stats._count,
      totalPoints: stats._sum.pointsEarned || 0,
      rank: userRank > 0 ? userRank : null,
    });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
