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

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const difficulty = searchParams.get("difficulty");
    const status = searchParams.get("status"); // unsolved, solved, in-progress
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "order"; // order, points, difficulty, releaseDate
    const sortOrder = searchParams.get("sortOrder") || "asc";
    const limit = parseInt(searchParams.get("limit") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");

    const where: any = { isActive: true };
    
    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty.toUpperCase();
    
    // Search by title or description
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get user's email for progress filtering
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build sort object
    const orderBy: any = {};
    if (sortBy === "points") {
      orderBy.pointsReward = sortOrder === "desc" ? "desc" : "asc";
    } else if (sortBy === "difficulty") {
      orderBy.difficulty = sortOrder === "desc" ? "desc" : "asc";
    } else if (sortBy === "releaseDate") {
      orderBy.createdAt = sortOrder === "desc" ? "desc" : "asc";
    } else {
      orderBy.order = "asc";
    }

    const puzzles = await prisma.puzzle.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        rarity: true,
        order: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        solutions: {
          select: {
            points: true,
          },
          take: 1,
        },
        userProgress: {
          where: { userId: user.id },
          select: {
            id: true,
            solved: true,
            attempts: true,
          },
        },
        _count: {
          select: {
            userProgress: {
              where: { solved: true },
            },
          },
        },
      },
      orderBy,
      take: limit,
      skip,
    });

    // Map solutions points and completion count to puzzle
    const puzzlesWithPoints = puzzles.map((p) => ({
      ...p,
      pointsReward: p.solutions[0]?.points || 100,
      completionCount: p._count.userProgress,
    }));

    // Filter by status if specified
    let filtered = puzzles;
    if (status === "solved") {
      filtered = puzzles.filter((p) => p.userProgress.length > 0 && p.userProgress[0].solved);
    } else if (status === "in-progress") {
      filtered = puzzles.filter((p) => p.userProgress.length > 0 && !p.userProgress[0].solved && p.userProgress[0].attempts > 0);
    } else if (status === "unsolved") {
      filtered = puzzles.filter((p) => p.userProgress.length === 0 || (!p.userProgress[0].solved && p.userProgress[0].attempts === 0));
    }

    return NextResponse.json(puzzlesWithPoints);
  } catch (error) {
    console.error("Failed to fetch puzzles:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzles" },
      { status: 500 }
    );
  }
}
