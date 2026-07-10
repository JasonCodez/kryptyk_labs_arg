import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import {
  type LogicGridNormalizedData,
  validateLogicGridPuzzleData,
} from "@/lib/logicGridCore";

// Autosaved scratch elimination-grid state — a note-taking aid, not the graded answer. Stored as
// a PuzzleSubmission row tagged with this feedback value, same pattern crossword uses for its
// letter-grid autosave.
const LOGIC_GRID_PROGRESS_FEEDBACK = "logic_grid_progress_state";

type CellMark = "check" | "cross";
type CellMarks = Record<string, CellMark>;

/**
 * Builds the set of valid cell keys for a puzzle's grid so incoming scratch state can be
 * filtered to only real cells. Key shape: `catIdA::entryA::catIdB::entryB`, where catIdA is
 * always the category that appears first in `categories` (so primary-vs-other and
 * other-vs-other pairs each have exactly one canonical key per cell).
 */
function buildValidCellKeys(categories: LogicGridNormalizedData["categories"]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const a = categories[i];
      const b = categories[j];
      for (const entryA of a.entries) {
        for (const entryB of b.entries) {
          keys.add(`${a.id}::${entryA}::${b.id}::${entryB}`);
        }
      }
    }
  }
  return keys;
}

function normalizeCellMarks(input: unknown, validKeys: Set<string>): CellMarks {
  if (!input || typeof input !== "object") return {};
  const marks: CellMarks = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!validKeys.has(key)) continue;
    if (value !== "check" && value !== "cross") continue;
    marks[key] = value;
  }
  return marks;
}

async function loadLogicGridPuzzle(puzzleId: string, requireSolution: boolean) {
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    select: { data: true, puzzleType: true },
  });

  if (!puzzle || puzzle.puzzleType !== "logic_grid") {
    return { error: NextResponse.json({ error: "Puzzle not found" }, { status: 404 }) };
  }

  const logicGrid = validateLogicGridPuzzleData(puzzle.data, { requireSolution });
  if (!logicGrid.valid || !logicGrid.normalized) {
    return {
      error: NextResponse.json(
        { error: logicGrid.error ?? "Logic grid puzzle data is invalid." },
        { status: 400 }
      ),
    };
  }

  return { normalized: logicGrid.normalized };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id: puzzleId } = await context.params;
    const loaded = await loadLogicGridPuzzle(puzzleId, false);
    if (loaded.error) return loaded.error;

    const validKeys = buildValidCellKeys(loaded.normalized.categories);

    const savedSubmission = await prisma.puzzleSubmission.findFirst({
      where: {
        puzzleId,
        userId: currentUser.id,
        feedback: LOGIC_GRID_PROGRESS_FEEDBACK,
      },
      select: { answer: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    });

    let cellMarks: CellMarks = {};
    let savedAt: number | null = null;
    if (savedSubmission) {
      try {
        const parsed = JSON.parse(savedSubmission.answer) as { cellMarks?: unknown; savedAt?: unknown };
        cellMarks = normalizeCellMarks(parsed.cellMarks, validKeys);
        savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : savedSubmission.submittedAt.getTime();
      } catch {
        cellMarks = {};
      }
    }

    return NextResponse.json({ cellMarks, savedAt });
  } catch (err) {
    console.error("[logic-grid][GET] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id: puzzleId } = await context.params;
    const body = await request.json();

    const loaded = await loadLogicGridPuzzle(puzzleId, false);
    if (loaded.error) return loaded.error;

    const validKeys = buildValidCellKeys(loaded.normalized.categories);
    const cellMarks = normalizeCellMarks((body as Record<string, unknown>)?.cellMarks, validKeys);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.userPuzzleProgress.upsert({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
        create: { userId: currentUser.id, puzzleId, lastAttemptAt: now },
        update: { lastAttemptAt: now },
      });

      await tx.puzzleSubmission.deleteMany({
        where: { puzzleId, userId: currentUser.id, feedback: LOGIC_GRID_PROGRESS_FEEDBACK },
      });

      if (Object.keys(cellMarks).length > 0) {
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: currentUser.id,
            answer: JSON.stringify({ cellMarks, savedAt: now.getTime() }),
            isCorrect: false,
            feedback: LOGIC_GRID_PROGRESS_FEEDBACK,
          },
        });
      }
    });

    return NextResponse.json({ saved: true, savedAt: now.getTime() });
  } catch (err) {
    console.error("[logic-grid][PATCH] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id: puzzleId } = await context.params;
    const body = await request.json();
    const submitted = (body as Record<string, unknown>)?.answer;

    // Load WITH the real solution — this route is the one place it's safe to have it in memory.
    const loaded = await loadLogicGridPuzzle(puzzleId, true);
    if (loaded.error) return loaded.error;

    const { categories, solution } = loaded.normalized;
    if (!solution) {
      return NextResponse.json({ error: "Logic grid puzzle has no solution configured." }, { status: 400 });
    }

    if (!submitted || typeof submitted !== "object") {
      return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
    }

    const primary = categories[0];
    const others = categories.slice(1);
    const submittedRows = submitted as Record<string, Record<string, unknown>>;

    const mismatchedCategories = new Set<string>();
    let complete = true;

    for (const primaryEntry of primary.entries) {
      const submittedRow = submittedRows[primaryEntry];
      for (const other of others) {
        const expected = solution[primaryEntry][other.id];
        const actual = typeof submittedRow?.[other.id] === "string" ? submittedRow[other.id] : null;
        if (actual == null) {
          complete = false;
          continue;
        }
        if (actual !== expected) {
          mismatchedCategories.add(other.id);
        }
      }
    }

    if (!complete) {
      return NextResponse.json({ error: "Answer is incomplete" }, { status: 400 });
    }

    const correct = mismatchedCategories.size === 0;
    return NextResponse.json({
      correct,
      mismatchedCategories: correct ? [] : [...mismatchedCategories],
    });
  } catch (err) {
    console.error("[logic-grid][POST] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
