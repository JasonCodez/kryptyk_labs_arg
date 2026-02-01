import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: puzzleId } = await params;

    console.log(`[PUZZLE FETCH] Fetching puzzle: ${puzzleId}`);
    try {
      const ua = request.headers.get('user-agent') || '<none>';
      const accept = request.headers.get('accept') || '<none>';
      const cookiePresent = request.headers.get('cookie') ? 'yes' : 'no';
      console.log(`[PUZZLE FETCH] Req meta: ua="${ua}", accept="${accept}", cookie=${cookiePresent}`);
    } catch (e) {
      console.warn('[PUZZLE FETCH] Failed to read request headers for debug', e);
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
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
            rotationEnabled: true,
          },
        },
      },
    });

    if (!puzzle) {
      console.log(`[PUZZLE FETCH] Puzzle not found: ${puzzleId}`);
      return NextResponse.json(
        { error: "Puzzle not found" },
        { status: 404 }
      );
    }

    console.log(`[PUZZLE FETCH] Puzzle fetched, jigsaw:`, puzzle.jigsaw);

    // Some Prisma client generations may not include newly added fields
    // (e.g., timeLimitSeconds) in nested select types. Fetch it separately
    // when a sudoku record exists and attach to the payload for the client.
    let outPayload = puzzle as (typeof puzzle & { sudoku?: { timeLimitSeconds?: number | null } });
    if (puzzle?.sudoku) {
      try {
        const extra = await prisma.sudokuPuzzle.findUnique({
          where: { puzzleId: puzzle.id },
          select: ({ timeLimitSeconds: true } as unknown) as Prisma.SudokuPuzzleSelect<any>,
        });
        const extraTl = (extra as any)?.timeLimitSeconds ?? null;
        outPayload = { ...puzzle, sudoku: { ...puzzle.sudoku, timeLimitSeconds: extraTl } };
      } catch (e) {
        // best-effort: if the extra lookup fails, return the original puzzle
        console.warn('[PUZZLE FETCH] Failed to fetch sudoku.extra:', e);
      }
    }

    // Debug: log nested sudoku payload (if any) to help diagnose missing Sudoku on client
    try {
      console.log('[PUZZLE FETCH] Out payload sudoku:', JSON.stringify((outPayload as any)?.sudoku));
    } catch (e) {
      console.warn('[PUZZLE FETCH] Failed to stringify sudoku payload for debug:', e);
    }

    return NextResponse.json(outPayload);
  } catch (error) {
    console.error("Error fetching puzzle:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzle" },
      { status: 500 }
    );
  }
}
