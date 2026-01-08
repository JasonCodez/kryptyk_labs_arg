import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    return NextResponse.json(puzzle);
  } catch (error) {
    console.error("Error fetching puzzle:", error);
    return NextResponse.json(
      { error: "Failed to fetch puzzle" },
      { status: 500 }
    );
  }
}
