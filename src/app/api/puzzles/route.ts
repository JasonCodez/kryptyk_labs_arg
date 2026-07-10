import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { HIDDEN_PUZZLE_TYPES } from "@/lib/featureFlags";
import { computeLockedPuzzleIds } from "@/lib/puzzleProgression";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/puzzleConstants";

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
    const limit = parseInt(searchParams.get("limit") || "500");
    const skip = parseInt(searchParams.get("skip") || "0");

    const catalogVisibility = {
      OR: [
        { puzzleType: { not: "gridlock_file" } },
        { puzzleType: "gridlock_file", schedule: null },
      ],
    };

    const where: any = {
      isActive: true,
      isWarzExclusive: false,
      puzzleType: { notIn: [...HIDDEN_PUZZLE_TYPES] },
      AND: [catalogVisibility],
    };
    // Optional filter for team puzzles
    const isTeam = searchParams.get("isTeam");
    if (isTeam === "true") where.isTeamPuzzle = true;
    
    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty.toUpperCase();
    
    // Search by title or description
    if (search && search.trim()) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
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
    // Note: "points" sort is applied in-memory after mapping (pointsReward is derived from solutions, not a Puzzle column)
    const orderBy: any = {};
    if (sortBy === "points") {
      orderBy.order = "asc"; // stable secondary sort; primary sort applied below
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
        isBossPuzzle: true,
        escapeRoom: { select: { id: true, roomTitle: true, roomDescription: true } },
        parts: isTeam === "true" ? { select: { id: true } } : false,
        xpReward: true,
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
            totalTimeSpent: true,
            sudokuLockedAt: true,
            sudokuLockReason: true,
          },
        },
      },
      orderBy,
      take: limit,
      skip,
    });

    // Progression locks: computed against the FULL catalog (ignoring this request's
    // category/difficulty/search filters and pagination) so a filtered/paginated view
    // never miscomputes a chapter because an earlier puzzle in the sequence got filtered out.
    let lockStateByPuzzleId = new Map<string, { locked: boolean; unlocksAfter?: { id: string; title: string } }>();
    try {
      const [progressionCatalog, solvedRows] = await Promise.all([
        prisma.puzzle.findMany({
          where: {
            isActive: true,
            isWarzExclusive: false,
            puzzleType: { notIn: [...HIDDEN_PUZZLE_TYPES] },
          },
          select: { id: true, title: true, puzzleType: true, order: true, isBossPuzzle: true, createdAt: true },
        }),
        prisma.userPuzzleProgress.findMany({
          where: { userId: user.id, solved: true },
          select: { puzzleId: true },
        }),
      ]);
      lockStateByPuzzleId = computeLockedPuzzleIds(
        progressionCatalog,
        new Set(solvedRows.map((r) => r.puzzleId))
      );
    } catch {
      lockStateByPuzzleId = new Map();
    }

    // Escape-room per-user failure history (for UI metadata).
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

    // Detective-case lockout state (per-user): mirrors the real 3-attempt limit
    // enforced in /api/puzzles/[id]/detective/submit (which auto-resets once
    // the cap is hit, so a player is never permanently shut out — this used to
    // check for a single incorrect submission, which was stricter than the
    // actual rule and could hide a puzzle the player still had attempts left on).
    let detectiveCaseFailedByPuzzleId = new Map<string, { failed: boolean; reason: string | null }>();
    try {
      const detectivePuzzleIds = puzzles
        .filter((p: any) => p?.puzzleType === 'detective_case')
        .map((p: any) => p.id as string)
        .filter(Boolean);

      if (detectivePuzzleIds.length > 0) {
        const lockedRows = await prisma.userPuzzleProgress.findMany({
          where: { userId: user.id, puzzleId: { in: detectivePuzzleIds }, failedAttempts: { gte: MAX_PUZZLE_ATTEMPTS } },
          select: { puzzleId: true },
        });
        for (const row of lockedRows) {
          detectiveCaseFailedByPuzzleId.set(row.puzzleId, { failed: true, reason: 'attempts_exhausted' });
        }
      }
    } catch {
      detectiveCaseFailedByPuzzleId = new Map();
    }

    // Fetch completion, attempt, and rating counts in parallel (avoids N+1)
    const puzzleIds = puzzles.map((p: { id: string }) => p.id);
    const [attemptGroups, solvedGroups, ratingGroups] = await Promise.all([
      prisma.userPuzzleProgress.groupBy({
        by: ["puzzleId"],
        where: { puzzleId: { in: puzzleIds }, user: { isBot: false } },
        _count: { puzzleId: true },
      }),
      prisma.userPuzzleProgress.groupBy({
        by: ["puzzleId"],
        where: { puzzleId: { in: puzzleIds }, solved: true, user: { isBot: false } },
        _count: { puzzleId: true },
      }),
      prisma.puzzleRating.groupBy({
        by: ["puzzleId"],
        where: { puzzleId: { in: puzzleIds } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    const statsMap = new Map<string, { totalAttempts: number; completedCount: number }>();
    for (const row of attemptGroups) {
      statsMap.set(row.puzzleId, { totalAttempts: row._count.puzzleId, completedCount: 0 });
    }
    for (const row of solvedGroups) {
      const existing = statsMap.get(row.puzzleId);
      if (existing) {
        existing.completedCount = row._count.puzzleId;
      } else {
        statsMap.set(row.puzzleId, { totalAttempts: 0, completedCount: row._count.puzzleId });
      }
    }

    const ratingsMap = new Map<string, { averageRating: number; ratingCount: number }>();
    for (const row of ratingGroups) {
      ratingsMap.set(row.puzzleId, {
        averageRating: row._avg.rating != null ? Math.round(row._avg.rating * 100) / 100 : 0,
        ratingCount: row._count.rating,
      });
    }

    // Map solutions points and completion count to puzzle
    const puzzlesWithPoints = puzzles.map((p: any) => {
      const stats = statsMap.get(p.id);

      const normalizedTitle = (typeof p.title === 'string' ? p.title : '') || (p.escapeRoom?.roomTitle || '');
      const normalizedDescription = (typeof p.description === 'string' ? p.description : '') || (p.escapeRoom?.roomDescription || '');

      const escapeRoomFail = escapeRoomFailedByPuzzleId.get(p.id) || null;
      const detectiveFail = detectiveCaseFailedByPuzzleId.get(p.id) || null;
      const lockState = lockStateByPuzzleId.get(p.id);

      return {
        ...p,
        title: normalizedTitle,
        description: normalizedDescription,
        escapeRoomFailed: escapeRoomFail?.failed || false,
        escapeRoomFailedReason: escapeRoomFail?.reason || null,
        detectiveCaseFailed: detectiveFail?.failed || false,
        detectiveCaseFailedReason: detectiveFail?.reason || null,
        locked: lockState?.locked || false,
        unlocksAfterTitle: lockState?.unlocksAfter?.title || null,
        pointsReward: p.solutions[0]?.points || 100,
        xpReward: p.xpReward ?? 50,
        completionCount: stats?.completedCount || 0,
        attemptCount: stats?.totalAttempts || 0,
        averageRating: ratingsMap.get(p.id)?.averageRating ?? 0,
        ratingCount: ratingsMap.get(p.id)?.ratingCount ?? 0,
      };
    });

    // Apply in-memory sort for "points" (derived field not available as a Prisma column)
    if (sortBy === "points") {
      const dir = sortOrder === "desc" ? -1 : 1;
      puzzlesWithPoints.sort((a: any, b: any) => dir * ((a.pointsReward ?? 0) - (b.pointsReward ?? 0)));
    }

    // Filter by status if specified — applied to puzzlesWithPoints (which has normalized titles etc.)
    let filtered = puzzlesWithPoints;
    if (status === "solved") {
      filtered = puzzlesWithPoints.filter((p: any) => p.userProgress.length > 0 && p.userProgress[0].solved);
    } else if (status === "in-progress") {
      filtered = puzzlesWithPoints.filter((p: any) => p.userProgress.length > 0 && !p.userProgress[0].solved && ((p.userProgress[0].attempts ?? 0) > 0));
    } else if (status === "unsolved") {
      filtered = puzzlesWithPoints.filter((p: any) => p.userProgress.length === 0 || (!p.userProgress[0].solved && ((p.userProgress[0].attempts ?? 0) === 0)));
    }

    // Sudoku lockout state (per-user): failed/locked Sudoku puzzles are no longer accessible.
    const visiblePuzzles = filtered.filter((p: any) => {
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
