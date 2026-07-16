import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanitizePublicPuzzleData } from "@/lib/publicPuzzleData";
import { HIDDEN_PUZZLE_TYPES, isHiddenPuzzleType } from "@/lib/featureFlags";
import { computeLockedPuzzleIds, isProgressionExemptType } from "@/lib/puzzleProgression";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: puzzleId } = await params;

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        escapeRoom: {
          select: {
            id: true,
            roomTitle: true,
            roomDescription: true,
            timeLimitSeconds: true,
            minTeamSize: true,
            maxTeamSize: true,
          },
        },
        hints: {
          select: {
            id: true,
            text: true,
            order: true,
            costPoints: true,
          },
          orderBy: { order: "asc" },
        },
        media: {
          select: {
            id: true,
            type: true,
            url: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            title: true,
            description: true,
            order: true,
            duration: true,
            width: true,
            height: true,
            thumbnail: true,
          },
          orderBy: { order: "asc" },
        },
        sudoku: {
          select: {
            puzzleGrid: true,
            solutionGrid: true,
            difficulty: true,
          },
        },
        jigsaw: {
          select: {
            imageUrl: true,
            gridRows: true,
            gridCols: true,
            snapTolerance: true,
            rotationEnabled: false,
          },
        },
        solutions: {
          select: { points: true },
          take: 1,
        },
      },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    let requester: { id: string; role: string } | null = null;
    if (session?.user?.email) {
      requester = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true },
      });
    }

    if (isHiddenPuzzleType(puzzle.puzzleType)) {
      if (requester?.role !== "admin") {
        return NextResponse.json(
          { error: "Puzzle not found" },
          { status: 404 }
        );
      }
    }

    // Sequential progression lock — mirrors the library listing's lock computation
    // (src/app/api/puzzles/route.ts) so direct navigation to a locked puzzle's URL
    // is blocked too, not just hidden from the list. Anonymous requests are left
    // alone here (no session to check progress against); auth is enforced elsewhere.
    if (requester && !isProgressionExemptType(puzzle.puzzleType)) {
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
          where: { userId: requester.id, solved: true },
          select: { puzzleId: true },
        }),
      ]);
      const lockState = computeLockedPuzzleIds(
        progressionCatalog,
        new Set(solvedRows.map((r) => r.puzzleId))
      ).get(puzzle.id);
      if (lockState?.locked) {
        return NextResponse.json(
          { error: "locked", unlocksAfterTitle: lockState.unlocksAfter?.title || null },
          { status: 403 }
        );
      }
    }

    // Some Prisma client generations may not include newly added fields
    // (e.g., timeLimitSeconds) in nested select types. Fetch it separately
    // when a sudoku record exists and attach to the payload for the client.
    let outPayload = puzzle as (typeof puzzle & { sudoku?: { timeLimitSeconds?: number | null; maxAttempts?: number | null } });
    if (puzzle?.sudoku) {
      try {
        const extra = await prisma.sudokuPuzzle.findUnique({
          where: { puzzleId: puzzle.id },
          select: ({ timeLimitSeconds: true, maxAttempts: true } as unknown) as Prisma.SudokuPuzzleSelect<any>,
        });
        const extraTl = (extra as any)?.timeLimitSeconds ?? null;
        const extraMax = (extra as any)?.maxAttempts ?? 5;
        outPayload = { ...puzzle, sudoku: { ...puzzle.sudoku, timeLimitSeconds: extraTl, maxAttempts: extraMax } };
      } catch (e) {
        console.warn('[PUZZLE FETCH] Failed to fetch sudoku.extra:', e);
      }
    }

    // Public payload sanitization for secret-bearing puzzle types.
    if ((outPayload as any).data) {
      const safeData = sanitizePublicPuzzleData(
        (outPayload as any).puzzleType,
        (outPayload as any).data
      );
      outPayload = { ...outPayload, data: safeData } as typeof outPayload;
    }

    // Normalize title/description for escape-room puzzles where the metadata is stored on EscapeRoomPuzzle.
    const normalizedTitle = ((outPayload as any)?.title || '').toString().trim() || ((outPayload as any)?.escapeRoom?.roomTitle || '').toString().trim();
    const normalizedDescription = ((outPayload as any)?.description || '').toString().trim() || ((outPayload as any)?.escapeRoom?.roomDescription || '').toString().trim();

    return NextResponse.json({
      ...(outPayload as any),
      title: normalizedTitle,
      description: normalizedDescription,
    });
  } catch (error) {
    console.error("Error fetching puzzle:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzle" },
      { status: 500 }
    );
  }
}
