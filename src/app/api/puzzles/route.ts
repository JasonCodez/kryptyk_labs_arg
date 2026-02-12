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
    // Optional filter for team puzzles
    const isTeam = searchParams.get("isTeam");
    if (isTeam === "true") where.isTeamPuzzle = true;
    
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
        // include team-related metadata when requested by client
        isTeamPuzzle: true,
        minTeamSize: true,
        puzzleType: true,
        escapeRoom: { select: { id: true, roomTitle: true, roomDescription: true } },
        parts: isTeam === "true" ? { select: { id: true } } : false,
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
            sudokuLockedAt: true,
            sudokuLockReason: true,
          },
        },
      },
      orderBy,
      take: limit,
      skip,
    });

    // Escape-room lockout state (per-user): failed escape rooms are no longer accessible.
    let escapeRoomFailedByPuzzleId = new Map<string, { failed: boolean; reason: string | null }>();
    try {
      const escapeRoomEntries = puzzles
        .map((p: any) => ({ puzzleId: p.id as string, escapeRoomId: p.escapeRoom?.id as string | undefined }))
        .filter((x) => !!x.escapeRoomId);
      if (escapeRoomEntries.length > 0) {
        const escapeRoomIds = Array.from(new Set(escapeRoomEntries.map((x) => x.escapeRoomId!)));
        const userFails = await prisma.userEscapeProgress.findMany({
          where: { userId: user.id, escapeRoomId: { in: escapeRoomIds }, failedAt: { not: null } },
          select: { escapeRoomId: true, failedReason: true },
        });
        const byEscapeRoomId = new Map(userFails.map((f) => [f.escapeRoomId, f.failedReason || null]));
        for (const e of escapeRoomEntries) {
          if (!byEscapeRoomId.has(e.escapeRoomId!)) continue;
          const reason = byEscapeRoomId.get(e.escapeRoomId!) ?? null;
          escapeRoomFailedByPuzzleId.set(e.puzzleId, { failed: true, reason });
        }
      }
    } catch {
      escapeRoomFailedByPuzzleId = new Map();
    }

    // Detective-case lockout state (per-user): a single incorrect submission locks the case forever.
    let detectiveCaseFailedByPuzzleId = new Map<string, { failed: boolean; reason: string | null }>();
    try {
      const detectivePuzzleIds = puzzles
        .filter((p: any) => p?.puzzleType === 'detective_case')
        .map((p: any) => p.id as string)
        .filter(Boolean);

      if (detectivePuzzleIds.length > 0) {
        const failures = await prisma.puzzleSubmission.findMany({
          where: { userId: user.id, puzzleId: { in: detectivePuzzleIds }, isCorrect: false },
          select: { puzzleId: true },
        });
        for (const f of failures) {
          detectiveCaseFailedByPuzzleId.set(f.puzzleId, { failed: true, reason: 'incorrect_submission' });
        }
      }
    } catch {
      detectiveCaseFailedByPuzzleId = new Map();
    }

    // Fetch completion and attempt counts separately
    const puzzleStats = await Promise.all(
      puzzles.map(async (p: { id: string }) => {
        const totalAttempts = await prisma.userPuzzleProgress.count({ where: { puzzleId: p.id } });
        const completedCount = await prisma.userPuzzleProgress.count({
          where: { puzzleId: p.id, solved: true },
        });
        return {
          puzzleId: p.id,
          totalAttempts,
          completedCount,
        };
      })
    );

    const statsMap = new Map(puzzleStats.map((s: { puzzleId: string; totalAttempts: number; completedCount: number }) => [s.puzzleId, s]));

    // Map solutions points and completion count to puzzle
    const puzzlesWithPoints = puzzles.map((p: any) => {
      const stats = statsMap.get(p.id);

      const normalizedTitle = (typeof p.title === 'string' ? p.title : '') || (p.escapeRoom?.roomTitle || '');
      const normalizedDescription = (typeof p.description === 'string' ? p.description : '') || (p.escapeRoom?.roomDescription || '');

      const escapeRoomFail = escapeRoomFailedByPuzzleId.get(p.id) || null;
      const detectiveFail = detectiveCaseFailedByPuzzleId.get(p.id) || null;

      return {
        ...p,
        title: normalizedTitle,
        description: normalizedDescription,
        escapeRoomFailed: escapeRoomFail?.failed || false,
        escapeRoomFailedReason: escapeRoomFail?.reason || null,
        detectiveCaseFailed: detectiveFail?.failed || false,
        detectiveCaseFailedReason: detectiveFail?.reason || null,
        pointsReward: p.solutions[0]?.points || 100,
        completionCount: stats?.completedCount || 0,
        attemptCount: stats?.totalAttempts || 0,
      };
    });

    // Filter by status if specified
    let filtered = puzzles;
    if (status === "solved") {
      filtered = puzzles.filter((p: { userProgress: { solved?: boolean }[] }) => p.userProgress.length > 0 && p.userProgress[0].solved);
    } else if (status === "in-progress") {
      filtered = puzzles.filter((p: { userProgress: { solved?: boolean; attempts?: number }[] }) => p.userProgress.length > 0 && !p.userProgress[0].solved && ((p.userProgress[0].attempts ?? 0) > 0));
    } else if (status === "unsolved") {
      filtered = puzzles.filter((p: { userProgress: { solved?: boolean; attempts?: number }[] }) => p.userProgress.length === 0 || (!p.userProgress[0].solved && ((p.userProgress[0].attempts ?? 0) === 0)));
    }

    // Sudoku lockout state (per-user): failed/locked Sudoku puzzles are no longer accessible.
    const visiblePuzzles = puzzlesWithPoints.filter((p: any) => {
      try {
        if (p?.puzzleType !== 'sudoku') return true;
        const up = Array.isArray(p?.userProgress) ? p.userProgress[0] : null;
        if (up?.sudokuLockedAt) return false;
        return true;
      } catch {
        return true;
      }
    });

    return NextResponse.json(visiblePuzzles);
  } catch (error) {
    console.error("Failed to fetch puzzles:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzles" },
      { status: 500 }
    );
  }
}
