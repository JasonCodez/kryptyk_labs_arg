import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { validateSameOrigin } from "@/lib/requestSecurity";

import { startSession, endSession } from "@/lib/puzzle-progress/session-actions";
import { startSudokuTimer, lockSudoku, clearSudokuState } from "@/lib/puzzle-progress/sudoku-actions";
import { validateSudokuAttempt } from "@/lib/puzzle-progress/sudoku-attempt-validation";
import { logAttempt, handleAttemptSuccess, recordGameLoss } from "@/lib/puzzle-progress/attempt-actions";
import { MAX_PUZZLE_ATTEMPTS, WORD_CRACK_MAX_ATTEMPTS } from "@/lib/puzzleConstants";

// GET /api/puzzles/[id]/progress - Fetch user's progress for puzzle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }
    const { id } = await params;
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

    const progress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: {
          userId: user.id,
          puzzleId: id,
        },
      },
      include: {
        sessionLogs: {
          orderBy: { sessionStart: "desc" },
          take: 10,
        },
        partProgress: {
          include: {
            part: {
              select: {
                id: true,
                title: true,
                order: true,
                pointsValue: true,
              },
            },
          },
          orderBy: { part: { order: "asc" } },
        },
      },
    });

    if (!progress) {
      // Return default progress if not started
      const now = new Date().toISOString();
      return NextResponse.json(
        {
          id: null,
          userId: user.id,
          puzzleId: id,
          solved: false,
          solvedAt: null,
          attempts: 0,
          failedAttempts: 0,
          successfulAttempts: 0,
          lastAttemptAt: null,
          averageTimePerAttempt: null,
          totalTimeSpent: 0,
          currentSessionStart: null,
          completionPercentage: 0,
          pointsEarned: 0,
          viewedAt: now,
          updatedAt: now,
          sudokuStartedAt: null,
          sudokuExpiresAt: null,
          sudokuLockedAt: null,
          sudokuLockReason: null,
          sessionLogs: [],
          partProgress: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    const requestId = request.headers.get("x-vercel-id") || request.headers.get("x-request-id") || "<no-request-id>";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Failed to fetch progress (Prisma known):", {
        code: error.code,
        meta: error.meta,
        requestId,
      });
    } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      console.error("Failed to fetch progress (Prisma unknown):", { message: error.message, requestId });
    } else {
      console.error("Failed to fetch progress:", { error, requestId });
    }
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

// POST /api/puzzles/[id]/progress - Update progress (start session, log attempt, etc)
const UpdateProgressSchema = z.object({
  action: z.enum(["start_session", "end_session", "log_attempt", "attempt_success", "lock_puzzle", "clear_state", "start_sudoku_timer", "record_game_loss"]),
  // Some callers send null; accept it and normalize later.
  durationSeconds: z.number().nullable().optional(),
  hintUsed: z.boolean().nullable().optional(),
  successful: z.boolean().nullable().optional(),
  // optional grid payload for puzzles like Sudoku
  grid: z.array(z.array(z.number())).optional(),
  // Sudoku timer bootstrapping (migrating older clients that stored a local start)
  clientStartedAtMs: z.number().int().positive().optional(),
  // Optional reason for lock_puzzle
  reason: z.string().max(64).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Ensure the puzzle exists up front so we don't hit foreign key errors later.
    const puzzleRecord = await prisma.puzzle.findUnique({
      where: { id },
      include: { sudoku: true, solutions: true, parts: true },
    });

    if (!puzzleRecord) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const debug = process.env.DEBUG_PROGRESS === '1';

    // Debug logging (opt-in): set DEBUG_PROGRESS=1
    let rawBody: unknown = null;
    try {
      // Parse as text first to sidestep body stream issues on some clients (e.g., curl on Windows)
      const bodyText = await request.text();
      rawBody = bodyText ? JSON.parse(bodyText) : null;
    } catch (e) {
      console.warn('[PROGRESS] failed to parse JSON body', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const bodyRecord = rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : null;
    if (debug) {
      try {
        console.log('[PROGRESS] request received', {
          puzzleId: id,
          userId: user.id,
          action: bodyRecord?.action ?? null,
        });
      } catch (e) {
        console.warn('[PROGRESS] failed reading request headers/body', e);
      }
    }

    if (!bodyRecord || typeof bodyRecord.action === 'undefined') {
      console.warn('[PROGRESS] Missing request body or action');
      return NextResponse.json({ error: 'Missing action in request body' }, { status: 400 });
    }

    const parsed = UpdateProgressSchema.parse(rawBody || {});
    const action = parsed.action;
    const durationSeconds = typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : undefined;
    const hintUsed = typeof parsed.hintUsed === 'boolean' ? parsed.hintUsed : undefined;
    const clientStartedAtMs = typeof parsed.clientStartedAtMs === 'number' ? parsed.clientStartedAtMs : undefined;
    const lockReason = typeof parsed.reason === 'string' ? parsed.reason : undefined;

    // Get or create progress
    let progress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: {
          userId: user.id,
          puzzleId: id,
        },
      },
    });

    if (!progress) {
      progress = await prisma.userPuzzleProgress.create({
        data: {
          userId: user.id,
          puzzleId: id,
        },
      });
    }

    // For record_game_loss, the underlying failedAttempts counter is reset the
    // moment it hits the cap (see recordGameLoss), so the generic re-fetch
    // below would report 0 even on the round that just used up the last
    // attempt. Capture the true count here to override the response with.
    let reportedFailedAttempts: number | undefined;

    switch (action) {
      case "start_session":
        await startSession(progress.id, user.id, id);
        break;

      case "end_session":
        await endSession(progress, durationSeconds, hintUsed);
        break;

      case "log_attempt":
        if (puzzleRecord.puzzleType === "sudoku") {
          const maxAttempts = Math.max(1, Number((puzzleRecord.sudoku as { maxAttempts?: number | null } | null)?.maxAttempts ?? 5));
          const submitted = parsed.grid;
          let solution: number[][] | null = null;
          try {
            solution = puzzleRecord.sudoku?.solutionGrid ? JSON.parse(puzzleRecord.sudoku.solutionGrid) as number[][] : null;
          } catch { /* handled by authoritative validation below */ }
          const rejection = validateSudokuAttempt(progress, maxAttempts, submitted, solution);
          if (rejection) {
            if (rejection.lockReason) await lockSudoku(progress, rejection.lockReason);
            return NextResponse.json({ error: rejection.error }, { status: rejection.status });
          }
          await logAttempt(progress, durationSeconds);
          if (progress.attempts + 1 >= maxAttempts) await lockSudoku(progress, "max_attempts");
          break;
        }
        await logAttempt(progress, durationSeconds);
        break;

      case "attempt_success": {
        const earlyReturn = await handleAttemptSuccess(progress, puzzleRecord, bodyRecord.grid, durationSeconds, user.id);
        if (earlyReturn) return earlyReturn;
        break;
      }

      case "start_sudoku_timer": {
        if (puzzleRecord?.puzzleType !== "sudoku") {
          return NextResponse.json({ error: "Not a Sudoku puzzle" }, { status: 400 });
        }
        const earlyReturn = await startSudokuTimer(progress, puzzleRecord, clientStartedAtMs);
        if (earlyReturn) return earlyReturn;
        break;
      }

      case "lock_puzzle": {
        if (puzzleRecord?.puzzleType === "sudoku") {
          await lockSudoku(progress, lockReason);
        }
        break;
      }

      case "clear_state": {
        if (puzzleRecord?.puzzleType === "sudoku") {
          await clearSudokuState(progress);
        }
        break;
      }

      case "record_game_loss": {
        const maxAttempts = puzzleRecord?.puzzleType === "word_crack" ? WORD_CRACK_MAX_ATTEMPTS : MAX_PUZZLE_ATTEMPTS;
        const trueCount = await recordGameLoss(progress, user.id, maxAttempts);
        if (trueCount !== null) reportedFailedAttempts = trueCount;
        break;
      }
    }

    // Return updated progress
    const updatedProgress = await prisma.userPuzzleProgress.findUnique({
      where: { id: progress.id },
      include: {
        sessionLogs: {
          orderBy: { sessionStart: "desc" },
          take: 5,
        },
        partProgress: true,
      },
    });

    const responseBody =
      updatedProgress && reportedFailedAttempts !== undefined
        ? { ...updatedProgress, failedAttempts: reportedFailedAttempts }
        : updatedProgress;

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to update progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
