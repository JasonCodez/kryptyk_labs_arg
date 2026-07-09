import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { HIDDEN_PUZZLE_TYPES } from "@/lib/featureFlags";

// GET /api/puzzles/report-options — lightweight, public list of currently published puzzles,
// used to populate the picker on the bug report form. No auth required (bugs can show up
// before someone even signs up) and no per-user data — just enough to identify a puzzle.
export async function GET() {
  try {
    const puzzles = await prisma.puzzle.findMany({
      where: {
        isActive: true,
        isWarzExclusive: false,
        puzzleType: { notIn: [...HIDDEN_PUZZLE_TYPES] },
        OR: [
          { puzzleType: { not: "gridlock_file" } },
          { puzzleType: "gridlock_file", schedule: null },
        ],
      },
      select: {
        id: true,
        title: true,
        puzzleType: true,
        category: { select: { name: true } },
      },
      orderBy: { title: "asc" },
      take: 1000,
    });

    const options = puzzles.map((p) => ({
      id: p.id,
      title: p.title,
      puzzleType: p.puzzleType,
      categoryName: p.category?.name ?? null,
    }));

    return NextResponse.json(options);
  } catch (error) {
    console.error("Failed to fetch report puzzle options:", error);
    return NextResponse.json({ error: "Failed to fetch puzzles" }, { status: 500 });
  }
}
