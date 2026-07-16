import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getGridlockFileData } from "@/lib/gridlockFile";
import { getParasiteCodeData } from "@/lib/parasiteCode";
import { getVaultPuzzleData } from "@/lib/vault";
import { validateWordSearchPuzzleData } from "@/lib/wordSearchCore";
import { validateCrosswordPuzzleData } from "@/lib/crosswordCore";

const toPositiveInt = (...values: unknown[]): number | undefined => {
  for (const raw of values) {
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : NaN;
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return undefined;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  return user?.role === "admin" ? session : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: puzzleId } = await params;
  const puzzle = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    include: {
      category: { select: { name: true } },
      hints: { orderBy: { order: "asc" } },
      solutions: { take: 1 },
      jigsaw: true,
      sudoku: true,
      schedule: true,
      dailySlots: { select: { dayNumber: true } },
    },
  });

  if (!puzzle) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
  return NextResponse.json(puzzle);
}

// Lightweight toggle for just the isActive flag — the full PUT below requires reconstructing
// the entire type-specific puzzle payload (sudoku grids, gridlock data, etc.), which is
// overkill for flipping a single boolean from the Manage Puzzles table.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: puzzleId } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
  }

  const existing = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });

  const updated = await prisma.puzzle.update({
    where: { id: puzzleId },
    data: { isActive: body.isActive },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ success: true, ...updated });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: puzzleId } = await params;

  const existing = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });

  const body = await req.json();
  const {
    title,
    description,
    content,
    category,
    difficulty,
    correctAnswer,
    pointsReward,
    hints,
    puzzleType,
    sudokuGrid,
    sudokuSolution,
    sudokuDifficulty,
    timeLimitSeconds,
    maxAttempts,
    minTeamSize,
    maxTeamSize,
    isWarzExclusive,
    gridlockReleaseAt,
    debriefReleaseAt,
    dailySlotDayNumber,
    order,
    isBossPuzzle,
  } = body;
  // Reassigned below, so kept separate from the const destructure above.
  let { puzzleData } = body;

  // Normalise snake_case category values coming from the admin dropdown to display names
  const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    word_crack:     'Hidden Word',
    word_search:    'Word Trove',
    anagram_blitz:  'Anagram Blitz',
    crack_safe:     'Crack Safe',
    detective_case: 'Detective Case',
    escape_room:    'Escape Room',
    jim_wyze_case:  'Jim Wyze Case',
    gridlock_file:  'Gridlock File',
    parasite_code:  'Parasite Code',
    crime_rpg:      'Crime RPG',
    code_master:    'Code Master',
    debrief:        'The Debrief',
    cipher_clash:   'Cipher Clash',
  };
  const resolvedCategory = category ? (CATEGORY_DISPLAY_NAMES[category] ?? category) : category;

  // Get or create category
  let categoryRecord = resolvedCategory
    ? await prisma.puzzleCategory.findFirst({ where: { name: resolvedCategory } })
    : null;
  if (!categoryRecord && resolvedCategory) {
    categoryRecord = await prisma.puzzleCategory.create({ data: { name: resolvedCategory } });
  }

  const validDifficulties = ["easy", "medium", "hard", "expert", "extreme"];
  // For sudoku puzzles use sudokuDifficulty as the source of truth for the badge field.
  const safeDifficulty =
    puzzleType === 'sudoku' && sudokuDifficulty && validDifficulties.includes(sudokuDifficulty.toLowerCase())
      ? sudokuDifficulty.toLowerCase()
      : (difficulty && validDifficulties.includes(difficulty) ? difficulty : "medium");

  const isSpecialType = ["sudoku", "jigsaw", "escape_room", "jim_wyze_case", "code_master", "detective_case", "crime_rpg", "gridlock_file", "debrief", "parasite_code", "vault"].includes(puzzleType);

  if (puzzleType === 'gridlock_file') {
    const parsed = getGridlockFileData(puzzleData);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Gridlock File puzzles require puzzleData.gridlockFile with valid grid, correctAnswers, ruleExplanation, and rule metadata' },
        { status: 400 }
      );
    }
  }

  if (puzzleType === 'parasite_code') {
    const parsed = getParasiteCodeData(puzzleData);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Parasite Code puzzles require puzzleData.parasiteCode with case metadata, program, parasiteLineIds, and testInputs' },
        { status: 400 }
      );
    }
  }

  if (puzzleType === 'word_search') {
    const ws = validateWordSearchPuzzleData(puzzleData);
    if (!ws.valid || !ws.normalized) {
      return NextResponse.json(
        { error: ws.error ?? 'Word Trove puzzleData is invalid.' },
        { status: 400 }
      );
    }

    puzzleData = {
      ...(puzzleData as Record<string, unknown>),
      grid: ws.normalized.grid,
      words: ws.normalized.words,
      unplacedWords: [],
    };
  }

  if (puzzleType === 'crossword') {
    const cw = validateCrosswordPuzzleData(puzzleData, {
      requireAnswers: true,
      enforceStyle: false,
    });

    if (!cw.valid || !cw.normalized) {
      return NextResponse.json(
        { error: cw.error ?? 'Crossword puzzleData is invalid.' },
        { status: 400 }
      );
    }

    puzzleData = {
      ...(puzzleData as Record<string, unknown>),
      clues: {
        across: cw.normalized.clues.across.map((clue) => ({
          number: clue.number,
          text: clue.text,
          answer: clue.answer ?? '',
          length: clue.length,
          row: clue.row,
          col: clue.col,
        })),
        down: cw.normalized.clues.down.map((clue) => ({
          number: clue.number,
          text: clue.text,
          answer: clue.answer ?? '',
          length: clue.length,
          row: clue.row,
          col: clue.col,
        })),
      },
      rows: cw.normalized.rows,
      cols: cw.normalized.cols,
      blackSquareRatio: Number(cw.normalized.blackSquareRatio.toFixed(4)),
    };
  }

  const vaultData = puzzleType === 'vault' ? getVaultPuzzleData(puzzleData) : null;
  if (puzzleType === 'vault' && !vaultData) {
    return NextResponse.json(
      { error: 'Vault puzzles require puzzleData.vault with a valid 3x3 configuration.' },
      { status: 400 }
    );
  }

  // Jigsaw grids must be square, from a fixed set of supported sizes — this update path had
  // no validation at all before (silently coerced with fallback defaults), unlike create.
  if (puzzleType === 'jigsaw') {
    const ALLOWED_GRID_SIZES = Array.from({ length: 14 }, (_, i) => i + 2); // 2..15
    const rows = Number(puzzleData?.gridRows);
    const cols = Number(puzzleData?.gridCols);
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows !== cols || !ALLOWED_GRID_SIZES.includes(rows)) {
      return NextResponse.json(
        { error: 'Jigsaw grids must be square. Choose 2×2 through 15×15.' },
        { status: 400 }
      );
    }
  }

  const isEscapeRoomType = puzzleType === 'escape_room';
  const isJimWyzeType = puzzleType === 'jim_wyze_case';
  const escapeMinTeamSize = isEscapeRoomType
    ? (toPositiveInt(minTeamSize, puzzleData?.minTeamSize, puzzleData?.escapeRoomData?.minTeamSize) ?? 1)
    : isJimWyzeType
      ? 1
      : undefined;
  const escapeMaxTeamSize = isEscapeRoomType
    ? toPositiveInt(maxTeamSize, puzzleData?.maxTeamSize, puzzleData?.escapeRoomData?.maxTeamSize)
    : isJimWyzeType
      ? 1
      : undefined;
  const escapeTimeLimitSeconds = (isEscapeRoomType || isJimWyzeType)
    ? toPositiveInt(timeLimitSeconds, puzzleData?.timeLimitSeconds, puzzleData?.escapeRoomData?.timeLimit)
    : undefined;

  await prisma.$transaction(async (tx) => {
    // 1. Update core puzzle fields
    const puzzleUpdateData: Record<string, unknown> = {
      title: title || "Untitled Puzzle",
      description: description || "",
      content: content || "",
      difficulty: safeDifficulty,
      isWarzExclusive: isWarzExclusive === true,
      isBossPuzzle: isBossPuzzle === true,
    };
    if (typeof order === 'number' && Number.isFinite(order)) {
      puzzleUpdateData.order = order;
    }
    if (categoryRecord) {
      puzzleUpdateData.categoryId = categoryRecord.id;
    }
    if (isEscapeRoomType && typeof escapeMinTeamSize === 'number') {
      puzzleUpdateData.isTeamPuzzle = true;
      puzzleUpdateData.minTeamSize = escapeMinTeamSize;
    }
    if (isJimWyzeType) {
      puzzleUpdateData.isTeamPuzzle = false;
      puzzleUpdateData.minTeamSize = 1;
    }
    if (!isSpecialType) {
      puzzleUpdateData.riddleAnswer = correctAnswer;
    }
    if (["escape_room", "jim_wyze_case", "code_master", "detective_case", "crack_safe", "word_crack", "word_search", "anagram_blitz", "arg", "blackout", "crime_rpg", "gridlock_file", "debrief", "parasite_code", "crossword", "cipher_clash"].includes(puzzleType) && puzzleData != null) {
      puzzleUpdateData.data = puzzleData;
    }
    if (puzzleType === 'vault' && vaultData) {
      puzzleUpdateData.data = { vault: vaultData };
      puzzleUpdateData.riddleAnswer = vaultData.finalCode;
    }
    if (puzzleType === 'jigsaw' && puzzleData) {
      const shapeData: Record<string, unknown> = {};
      if (typeof puzzleData.pieceExtFrac       === 'number') shapeData.pieceExtFrac       = puzzleData.pieceExtFrac;
      if (typeof puzzleData.pieceRFrac         === 'number') shapeData.pieceRFrac         = puzzleData.pieceRFrac;
      if (typeof puzzleData.pieceNHalfFrac     === 'number') shapeData.pieceNHalfFrac     = puzzleData.pieceNHalfFrac;
      if (typeof puzzleData.pieceShoulderStart === 'number') shapeData.pieceShoulderStart = puzzleData.pieceShoulderStart;
      if (Object.keys(shapeData).length > 0) puzzleUpdateData.data = shapeData;
    }
    await tx.puzzle.update({
      where: { id: puzzleId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: puzzleUpdateData as any,
    });

    // 2. Replace hints
    await tx.puzzleHint.deleteMany({ where: { puzzleId } });
    const filteredHints = Array.isArray(hints) ? hints.filter((h: unknown) => {
      const text = typeof h === 'string' ? h : (h as Record<string, unknown>)?.text;
      return typeof text === 'string' && text.trim();
    }) : [];
    if (filteredHints.length > 0) {
      await tx.puzzleHint.createMany({
        data: filteredHints.map((h: unknown, order: number) => {
          const text = String(typeof h === 'string' ? h : (h as Record<string, unknown>).text);
          const costPointsRaw = typeof h === 'string' ? 10 : ((h as Record<string, unknown>).costPoints ?? 10);
          const costPoints = typeof costPointsRaw === 'number' ? costPointsRaw : Number(costPointsRaw) || 10;
          return { puzzleId, text, order, costPoints };
        }),
      });
    }

    // 3. Update solution for simple puzzle types
    if (!isSpecialType && correctAnswer) {
      const sol = await tx.puzzleSolution.findFirst({ where: { puzzleId } });
      if (sol) {
        await tx.puzzleSolution.update({
          where: { id: sol.id },
          data: { answer: correctAnswer, points: pointsReward || 100 },
        });
      } else {
        await tx.puzzleSolution.create({
          data: {
            puzzleId,
            answer: correctAnswer,
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        });
      }
    }

    if (puzzleType === 'vault') {
      const sol = await tx.puzzleSolution.findFirst({ where: { puzzleId } });
      if (sol) {
        await tx.puzzleSolution.update({
          where: { id: sol.id },
          data: { answer: '__VAULT__', points: pointsReward || 100 },
        });
      } else {
        await tx.puzzleSolution.create({
          data: {
            puzzleId,
            answer: '__VAULT__',
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        });
      }
    }

    // These types are solved via bespoke UI (not a single text answer) but still complete
    // through the generic attempt_success -> awardSolveRewards() path, which reads points
    // from a placeholder solution row. Keep that row's points in sync on every edit —
    // previously only 'vault' did this, so editing points on these types silently no-opped.
    const syncPlaceholderSolution = async (answer: string) => {
      const sol = await tx.puzzleSolution.findFirst({ where: { puzzleId } });
      if (sol) {
        await tx.puzzleSolution.update({
          where: { id: sol.id },
          data: { answer, points: pointsReward || 100 },
        });
      } else {
        await tx.puzzleSolution.create({
          data: {
            puzzleId,
            answer,
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        });
      }
    };
    if (puzzleType === 'jigsaw') await syncPlaceholderSolution('__JIGSAW__');
    if (puzzleType === 'crime_rpg') await syncPlaceholderSolution('__CRIME_RPG__');
    if (puzzleType === 'code_master') await syncPlaceholderSolution('__CODE_MASTER__');
    if (puzzleType === 'escape_room') await syncPlaceholderSolution('__ESCAPE_ROOM__');
    if (puzzleType === 'sudoku') await syncPlaceholderSolution('__SUDOKU__');
    if (puzzleType === 'detective_case') await syncPlaceholderSolution('__DETECTIVE_CASE__');
    if (puzzleType === 'jim_wyze_case') await syncPlaceholderSolution('__JIM_WYZE_CASE__');
    if (puzzleType === 'crack_safe') await syncPlaceholderSolution('__CRACK_SAFE__');

    // 4. Update sudoku record if applicable
    if (puzzleType === "sudoku" && sudokuGrid && sudokuSolution) {
      await tx.sudokuPuzzle.upsert({
        where: { puzzleId },
        update: {
          puzzleGrid: JSON.stringify(sudokuGrid),
          solutionGrid: JSON.stringify(sudokuSolution),
          difficulty: sudokuDifficulty || "medium",
          timeLimitSeconds: timeLimitSeconds ?? 900,
          maxAttempts: Math.max(1, Math.min(20, Number(maxAttempts) || 5)),
        },
        create: {
          puzzleId,
          puzzleGrid: JSON.stringify(sudokuGrid),
          solutionGrid: JSON.stringify(sudokuSolution),
          difficulty: sudokuDifficulty || "medium",
          timeLimitSeconds: timeLimitSeconds ?? 900,
          maxAttempts: Math.max(1, Math.min(20, Number(maxAttempts) || 5)),
        },
      });
    }

    // 5. Update jigsaw config if applicable
    if (puzzleType === "jigsaw" && puzzleData) {
      await tx.jigsawPuzzle.upsert({
        where: { puzzleId },
        update: {
          gridRows: Number(puzzleData.gridRows) || 4,
          gridCols: Number(puzzleData.gridCols) || 4,
          snapTolerance: Number(puzzleData.snapTolerance) || 12,
          rotationEnabled: false,
        },
        create: {
          puzzleId,
          gridRows: Number(puzzleData.gridRows) || 4,
          gridCols: Number(puzzleData.gridCols) || 4,
          snapTolerance: Number(puzzleData.snapTolerance) || 12,
          rotationEnabled: false,
        },
      });
    }

    // 6. Keep escape-room settings in sync with puzzle settings when editing via admin puzzle maker.
    if (isEscapeRoomType || isJimWyzeType) {
      const resolvedMin = isJimWyzeType ? 1 : (typeof escapeMinTeamSize === 'number' ? escapeMinTeamSize : 1);
      const resolvedMax = isJimWyzeType ? 1 : Math.max(resolvedMin, escapeMaxTeamSize ?? 8);
      await tx.escapeRoomPuzzle.upsert({
        where: { puzzleId },
        update: {
          roomTitle: (puzzleData?.roomTitle || title || "Untitled Puzzle"),
          roomDescription: (puzzleData?.roomDescription || description || ""),
          minTeamSize: resolvedMin,
          maxTeamSize: resolvedMax,
          ...(typeof escapeTimeLimitSeconds === 'number' ? { timeLimitSeconds: escapeTimeLimitSeconds } : {}),
        },
        create: {
          puzzleId,
          roomTitle: (puzzleData?.roomTitle || title || "Untitled Puzzle"),
          roomDescription: (puzzleData?.roomDescription || description || ""),
          minTeamSize: resolvedMin,
          maxTeamSize: resolvedMax,
          ...(typeof escapeTimeLimitSeconds === 'number' ? { timeLimitSeconds: escapeTimeLimitSeconds } : {}),
        },
      });
    }
  });

  // Gridlock files only join the daily rotation when explicitly scheduled.
  if (puzzleType === 'gridlock_file') {
    if (gridlockReleaseAt) {
      const releaseAt = new Date(gridlockReleaseAt);
      await prisma.puzzleSchedule.upsert({
        where: { puzzleId },
        create: { puzzleId, releaseAt, schedulingType: 'scheduled' },
        update: { releaseAt, schedulingType: 'scheduled' },
      });
    } else {
      await prisma.puzzleSchedule.deleteMany({ where: { puzzleId } });
    }
  }
  // Upsert PuzzleSchedule.releaseAt for debrief puzzles
  if (puzzleType === 'debrief') {
    const releaseAt = debriefReleaseAt ? new Date(debriefReleaseAt) : new Date();
    await prisma.puzzleSchedule.upsert({
      where: { puzzleId },
      create: { puzzleId, releaseAt, schedulingType: 'scheduled' },
      update: { releaseAt },
    });
  }

  // Assign/clear this puzzle's daily rotation slot (sudoku/crossword/word_search/jigsaw only).
  // Assigning a slot also flips isActive:false so the puzzle disappears from the normal
  // catalog browser (GET /api/puzzles filters isActive:true) while remaining directly
  // fetchable by ID for the daily-play routes — there's no separate admin toggle for this
  // today, so we drive it automatically rather than requiring a manual step.
  const DAILY_SLOT_TYPES = ["word_crack", "sudoku", "crossword", "word_search", "jigsaw"];
  if (DAILY_SLOT_TYPES.includes(puzzleType)) {
    const dayNum = toPositiveInt(dailySlotDayNumber);
    if (dayNum) {
      await prisma.dailyPuzzleSlot.upsert({
        where: { puzzleType_dayNumber: { puzzleType, dayNumber: dayNum } },
        create: { puzzleType, dayNumber: dayNum, puzzleId },
        update: { puzzleId },
      });
      await prisma.puzzle.update({ where: { id: puzzleId }, data: { isActive: false } });
    } else {
      await prisma.dailyPuzzleSlot.deleteMany({ where: { puzzleId, puzzleType } });
    }
  }

  const updated = await prisma.puzzle.findUnique({
    where: { id: puzzleId },
    select: { id: true, title: true, puzzleType: true, difficulty: true, isActive: true, createdAt: true, category: { select: { name: true } } },
  });
  return NextResponse.json({ success: true, puzzle: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id: puzzleId } = await params;

    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { id: true } });
    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    // Delete all related records in dependency order before deleting the puzzle itself.
    // Most child models have onDelete:Cascade so they are cleaned up automatically.
    // We only need to manually handle the two cases that lack cascade:
    //   1. Other puzzles that list this one as their requiredPreviousPuzzle
    //   2. ForumPosts whose optional puzzleId points here (no cascade on that relation)
    await prisma.$transaction(async (tx) => {
      // 1. Clear the dependency reference on any puzzle that requires this one
      await tx.puzzle.updateMany({
        where: { requiredPreviousPuzzleId: puzzleId },
        data: { requiredPreviousPuzzleId: null },
      });

      // 2. Detach forum posts (keep the posts, just unlink them from the puzzle)
      await tx.forumPost.updateMany({
        where: { puzzleId },
        data: { puzzleId: null },
      });

      // 3. Delete the puzzle — all cascading relations are cleaned up automatically by the DB
      await tx.puzzle.delete({ where: { id: puzzleId } });
    });

    return NextResponse.json({ success: true, id: puzzleId });
  } catch (error) {
    console.error("[PUZZLE DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete puzzle" }, { status: 500 });
  }
}
