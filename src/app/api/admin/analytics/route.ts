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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all analytics data in parallel
    const [
      totalUsers,
      totalPuzzles,
      totalSolves,
      totalAttempts,
      puzzleStats,
      userEngagement,
      difficultyBreakdown,
      categoryStats,
      topSolvers,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.puzzle.count(),
      prisma.userPuzzleProgress.count({ where: { solved: true } }),
      prisma.userPuzzleProgress.count(),
      getPuzzleStats(),
      getUserEngagementStats(),
      getDifficultyBreakdown(),
      getCategoryStats(),
      getTopSolvers(),
      getRecentActivity(),
    ]);

    const solveRate =
      totalAttempts > 0
        ? ((totalSolves / totalAttempts) * 100).toFixed(2)
        : "0";
    const avgAttemptsPerSolve =
      totalSolves > 0 ? (totalAttempts / totalSolves).toFixed(2) : "0";

    return NextResponse.json({
      overview: {
        totalUsers,
        totalPuzzles,
        totalSolves,
        totalAttempts,
        solveRate: parseFloat(solveRate),
        avgAttemptsPerSolve: parseFloat(avgAttemptsPerSolve),
      },
      puzzleStats,
      userEngagement,
      difficultyBreakdown,
      categoryStats,
      topSolvers,
      recentActivity,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

async function getPuzzleStats() {
  const puzzles = await prisma.puzzle.findMany({
    select: {
      id: true,
      title: true,
      difficulty: true,
      userProgress: {
        where: { solved: true },
      },
    },
    orderBy: {
      userProgress: {
        _count: "desc",
      },
    },
    take: 5,
  });

  return puzzles.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    solves: p.userProgress.length,
  }));
}

async function getUserEngagementStats() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      solvedPuzzles: {
        where: { solved: true },
      },
    },
    orderBy: {
      solvedPuzzles: {
        _count: "desc",
      },
    },
    take: 5,
  });

  return users.map((u) => ({
    userId: u.id,
    userName: u.name || u.email || "Unknown",
    puzzlesSolved: u.solvedPuzzles.length,
  }));
}

async function getDifficultyBreakdown() {
  const breakdown = await prisma.puzzle.groupBy({
    by: ["difficulty"],
    _count: true,
  });

  return breakdown.map((b) => ({
    difficulty: b.difficulty,
    count: b._count,
  }));
}

async function getCategoryStats() {
  const stats = await prisma.puzzle.groupBy({
    by: ["categoryId"],
    _count: true,
  });

  const categoryIds = stats
    .map((s) => s.categoryId)
    .filter((id) => id !== null) as string[];
  const categories = await prisma.puzzleCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });

  return stats.map((s) => {
    const category = categories.find((c) => c.id === s.categoryId);
    return {
      categoryId: s.categoryId,
      categoryName: category?.name || "Uncategorized",
      puzzleCount: s._count,
    };
  });
}

async function getTopSolvers() {
  const topSolvers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      solvedPuzzles: {
        where: { solved: true },
      },
    },
    orderBy: {
      solvedPuzzles: {
        _count: "desc",
      },
    },
    take: 10,
  });

  return topSolvers.map((u) => ({
    userId: u.id,
    userName: u.name || u.email,
    userImage: u.image,
    puzzlesSolved: u.solvedPuzzles.length,
  }));
}

async function getRecentActivity() {
  const recentSolves = await prisma.userPuzzleProgress.findMany({
    where: { solved: true },
    select: {
      id: true,
      userId: true,
      puzzleId: true,
      solvedAt: true,
      user: {
        select: { name: true, email: true },
      },
      puzzle: {
        select: { title: true },
      },
    },
    orderBy: { solvedAt: "desc" },
    take: 10,
  });

  return recentSolves.map((s) => ({
    id: s.id,
    userName: s.user.name || s.user.email,
    puzzleTitle: s.puzzle.title,
    solvedAt: s.solvedAt,
  }));
}
