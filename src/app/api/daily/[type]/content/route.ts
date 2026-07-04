import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";

const DAILY_TYPES = ["sudoku", "crossword", "word_search", "jigsaw"] as const;
type DailyType = (typeof DAILY_TYPES)[number];

/**
 * GET /api/daily/[type]/content
 * Resolves today's puzzle for one of the 4 non-word daily puzzle types. Auth required —
 * unlike the word puzzle, these types have no guest-play path, so no content or solution
 * should reach an anonymous client.
 *
 * - sudoku: returns the grid + solution directly (SudokuGrid validates client-side,
 *   same trust model as the existing non-daily sudoku flow).
 * - crossword / word_search: just resolves puzzleId — those components fetch their own
 *   content from the existing /api/puzzles/[id]/... routes, unmodified.
 * - jigsaw: resolves puzzleId plus the image/grid config JigsawPuzzleCanvas needs as props.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!DAILY_TYPES.includes(type as DailyType)) {
    return NextResponse.json({ error: "Unknown daily puzzle type" }, { status: 400 });
  }

  const currentUser = await requireAuthenticatedUser();
  if (currentUser instanceof NextResponse) return currentUser;

  const dayNumber = getTodayDayNumber();

  const slot = await prisma.dailyPuzzleSlot.findUnique({
    where: { puzzleType_dayNumber: { puzzleType: type, dayNumber } },
    select: { puzzleId: true },
  });

  if (!slot) {
    return NextResponse.json({ available: false, dayNumber });
  }

  if (type === "sudoku") {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: slot.puzzleId },
      select: {
        id: true,
        sudoku: { select: { puzzleGrid: true, solutionGrid: true, difficulty: true } },
      },
    });
    if (!puzzle?.sudoku) {
      return NextResponse.json({ available: false, dayNumber });
    }
    return NextResponse.json({
      available: true,
      dayNumber,
      puzzleId: puzzle.id,
      puzzleGrid: puzzle.sudoku.puzzleGrid,
      solutionGrid: puzzle.sudoku.solutionGrid,
      difficulty: puzzle.sudoku.difficulty,
    });
  }

  if (type === "jigsaw") {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: slot.puzzleId },
      select: {
        id: true,
        jigsaw: { select: { imageUrl: true, gridRows: true, gridCols: true, snapTolerance: true, rotationEnabled: true } },
      },
    });
    if (!puzzle?.jigsaw) {
      return NextResponse.json({ available: false, dayNumber });
    }
    return NextResponse.json({
      available: true,
      dayNumber,
      puzzleId: puzzle.id,
      imageUrl: puzzle.jigsaw.imageUrl,
      gridRows: puzzle.jigsaw.gridRows,
      gridCols: puzzle.jigsaw.gridCols,
      snapTolerance: puzzle.jigsaw.snapTolerance,
      rotationEnabled: puzzle.jigsaw.rotationEnabled,
    });
  }

  // crossword / word_search: components fetch their own content by puzzleId.
  return NextResponse.json({ available: true, dayNumber, puzzleId: slot.puzzleId });
}
