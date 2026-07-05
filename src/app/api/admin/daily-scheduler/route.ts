import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminUser } from "@/lib/requireAdmin";
import { getTodayDayNumber, getDateForDayNumber } from "@/lib/dailyPuzzle";

const DAILY_SLOT_TYPES = ["word_crack", "sudoku", "crossword", "word_search", "jigsaw"] as const;
type DailySlotType = (typeof DAILY_SLOT_TYPES)[number];

const TYPE_LABELS: Record<DailySlotType, string> = {
  word_crack: "Hidden Word 🟩",
  sudoku: "Sudoku",
  crossword: "Crossword ✏️",
  word_search: "Word Trove 🔍",
  jigsaw: "Jigsaw Puzzle",
};

const WEEK_LENGTH = 7;

/**
 * GET /api/admin/daily-scheduler?startDay=N
 * Returns a 7-day window (default: starting today) x 5 daily-puzzle-type grid: for each
 * type, the catalog of puzzles of that type plus the current slot assignment for each day
 * in the window, so the admin UI can render a picker grid and diff against it on save.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startDayParam = req.nextUrl.searchParams.get("startDay");
  const startDay = Math.max(1, Number(startDayParam) || getTodayDayNumber());

  const days = Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const dayNumber = startDay + i;
    return { dayNumber, date: getDateForDayNumber(dayNumber).toISOString().slice(0, 10) };
  });
  const dayNumbers = days.map((d) => d.dayNumber);

  const [puzzles, slots] = await Promise.all([
    prisma.puzzle.findMany({
      where: { puzzleType: { in: [...DAILY_SLOT_TYPES] } },
      select: { id: true, title: true, puzzleType: true, isActive: true },
      orderBy: { title: "asc" },
    }),
    prisma.dailyPuzzleSlot.findMany({
      where: { puzzleType: { in: [...DAILY_SLOT_TYPES] }, dayNumber: { in: dayNumbers } },
      select: { puzzleType: true, dayNumber: true, puzzleId: true },
    }),
  ]);

  const types = DAILY_SLOT_TYPES.map((puzzleType) => {
    const slotsForType: Record<number, string | null> = {};
    for (const dayNumber of dayNumbers) slotsForType[dayNumber] = null;
    for (const slot of slots) {
      if (slot.puzzleType === puzzleType) slotsForType[slot.dayNumber] = slot.puzzleId;
    }
    return {
      puzzleType,
      label: TYPE_LABELS[puzzleType],
      puzzles: puzzles
        .filter((p) => p.puzzleType === puzzleType)
        .map((p) => ({ id: p.id, title: p.title, isActive: p.isActive })),
      slots: slotsForType,
    };
  });

  return NextResponse.json({ startDay, days, types });
}

type Assignment = { puzzleType: string; dayNumber: number; puzzleId: string | null };

/**
 * POST /api/admin/daily-scheduler
 * Body: { assignments: Assignment[] }
 * Bulk-saves a week's worth of daily-slot assignments in one pass. Assigning a puzzle to a
 * slot flips it isActive:false (hidden from the regular catalog), mirroring the existing
 * single-puzzle-edit-form behavior. Explicitly clearing a cell (puzzleId: null) reactivates
 * whatever puzzle previously held that slot, since the scheduler's "— Unassigned —" option
 * is a deliberate un-schedule action, unlike the edit-form's ambiguous "leave blank".
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const assignments = body?.assignments as Assignment[] | undefined;
  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  for (const a of assignments) {
    if (!DAILY_SLOT_TYPES.includes(a.puzzleType as DailySlotType)) {
      return NextResponse.json({ error: `Invalid puzzleType: ${a.puzzleType}` }, { status: 400 });
    }
    if (!Number.isInteger(a.dayNumber) || a.dayNumber < 1) {
      return NextResponse.json({ error: `Invalid dayNumber: ${a.dayNumber}` }, { status: 400 });
    }
  }

  const puzzleIds = [...new Set(assignments.map((a) => a.puzzleId).filter((id): id is string => !!id))];
  const referencedPuzzles = await prisma.puzzle.findMany({
    where: { id: { in: puzzleIds } },
    select: { id: true, puzzleType: true },
  });
  const puzzleTypeById = new Map(referencedPuzzles.map((p) => [p.id, p.puzzleType]));
  for (const a of assignments) {
    if (a.puzzleId && puzzleTypeById.get(a.puzzleId) !== a.puzzleType) {
      return NextResponse.json(
        { error: `Puzzle ${a.puzzleId} is not a ${a.puzzleType} puzzle` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyPuzzleSlot.findMany({
      where: {
        OR: assignments.map((a) => ({ puzzleType: a.puzzleType, dayNumber: a.dayNumber })),
      },
      select: { puzzleType: true, dayNumber: true, puzzleId: true },
    });
    const existingByKey = new Map(existing.map((s) => [`${s.puzzleType}:${s.dayNumber}`, s.puzzleId]));

    for (const a of assignments) {
      const key = `${a.puzzleType}:${a.dayNumber}`;
      const previousPuzzleId = existingByKey.get(key) ?? null;
      const nextPuzzleId = a.puzzleId ?? null;
      if (previousPuzzleId === nextPuzzleId) continue; // no change

      if (previousPuzzleId) {
        await tx.puzzle.update({ where: { id: previousPuzzleId }, data: { isActive: true } });
      }

      if (nextPuzzleId) {
        await tx.dailyPuzzleSlot.upsert({
          where: { puzzleType_dayNumber: { puzzleType: a.puzzleType, dayNumber: a.dayNumber } },
          create: { puzzleType: a.puzzleType, dayNumber: a.dayNumber, puzzleId: nextPuzzleId },
          update: { puzzleId: nextPuzzleId },
        });
        await tx.puzzle.update({ where: { id: nextPuzzleId }, data: { isActive: false } });
      } else {
        await tx.dailyPuzzleSlot.delete({
          where: { puzzleType_dayNumber: { puzzleType: a.puzzleType, dayNumber: a.dayNumber } },
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}
