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
          // cast the select to Prisma's generated select type to avoid
          // errors when the local generated client is missing newer fields.
          // Some Prisma versions don't export `DefaultArgs` — use a safe
          // double-cast to bypass that mismatch.
          select: ({ timeLimitSeconds: true } as unknown) as Prisma.SudokuPuzzleSelect<any>,
        });
        outPayload = { ...puzzle, sudoku: { ...puzzle.sudoku, timeLimitSeconds: extra?.timeLimitSeconds ?? null } };
      } catch (e) {
        // best-effort: if the extra lookup fails, return the original puzzle
        console.warn('[PUZZLE FETCH] Failed to fetch sudoku.extra:', e);
      }
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
