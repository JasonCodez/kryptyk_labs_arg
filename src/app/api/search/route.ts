import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { HIDDEN_PUZZLE_TYPES } from "@/lib/featureFlags";

// GET /api/search?q=<query>&type=<puzzleType>&difficulty=<difficulty>&limit=<n>&skip=<n>
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

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const type = searchParams.get("type") ?? "";
    const difficulty = (searchParams.get("difficulty") ?? "").toUpperCase();
    const limit = Math.min(40, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0"));

    if (!q && !type && !difficulty) {
      return NextResponse.json({ puzzles: [], total: 0 });
    }

    const where: Record<string, unknown> = {
      isActive: true,
      isWarzExclusive: false,
      puzzleType: { notIn: [...HIDDEN_PUZZLE_TYPES] },
      AND: [
        {
          OR: [
            { puzzleType: { not: "gridlock_file" } },
            { puzzleType: "gridlock_file", schedule: null },
          ],
        },
      ],
    };

    if (q) {
      (where.AND as Array<Record<string, unknown>>).push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (type) where.puzzleType = type;
    if (difficulty) where.difficulty = difficulty;

    const [puzzles, total] = await Promise.all([
      prisma.puzzle.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          puzzleType: true,
          xpReward: true,
          category: { select: { name: true } },
          _count: { select: { userProgress: true } },
        },
        orderBy: [{ difficulty: "asc" }, { title: "asc" }],
        take: limit,
        skip,
      }),
      prisma.puzzle.count({ where }),
    ]);

    // Look up which of these the current user has solved
    const puzzleIds = puzzles.map((p) => p.id);
    const solvedSet = new Set<string>();
    if (puzzleIds.length > 0) {
      const solved = await prisma.userPuzzleProgress.findMany({
        where: { userId: user.id, puzzleId: { in: puzzleIds }, solved: true },
        select: { puzzleId: true },
      });
      solved.forEach((s) => solvedSet.add(s.puzzleId));
    }

    return NextResponse.json({
      puzzles: puzzles.map((p) => ({
        ...p,
        solved: solvedSet.has(p.id),
        solveCount: p._count.userProgress,
      })),
      total,
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
