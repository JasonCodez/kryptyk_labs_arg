import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import {
  type CrosswordNormalizedData,
  normalizeCrosswordAnswer,
  validateCrosswordPuzzleData,
} from "@/lib/crosswordCore";

const CROSSWORD_CLUE_FEEDBACK = "crossword_clue_correct";
const CROSSWORD_PROGRESS_FEEDBACK = "crossword_progress_state";

type Direction = "across" | "down";

function getAllClueKeys(crossword: CrosswordNormalizedData): string[] {
  return [
    ...crossword.clues.across.map((c) => `across:${c.number}`),
    ...crossword.clues.down.map((c) => `down:${c.number}`),
  ];
}

function getCrosswordDimensions(crossword: CrosswordNormalizedData): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;

  for (const clue of crossword.clues.across) {
    rows = Math.max(rows, clue.row + 1);
    cols = Math.max(cols, clue.col + clue.length);
  }

  for (const clue of crossword.clues.down) {
    rows = Math.max(rows, clue.row + clue.length);
    cols = Math.max(cols, clue.col + 1);
  }

  return { rows, cols };
}

function buildWhiteCellMap(crossword: CrosswordNormalizedData, rows: number, cols: number): boolean[][] {
  const whiteCells = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (const clue of crossword.clues.across) {
    for (let offset = 0; offset < clue.length; offset++) {
      whiteCells[clue.row][clue.col + offset] = true;
    }
  }

  for (const clue of crossword.clues.down) {
    for (let offset = 0; offset < clue.length; offset++) {
      whiteCells[clue.row + offset][clue.col] = true;
    }
  }

  return whiteCells;
}

function normalizeLetterRows(input: unknown, rows: number, cols: number, whiteCells: boolean[][]): string[][] | null {
  if (!Array.isArray(input) || input.length !== rows) return null;

  const normalized: string[][] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const rowInput = input[rowIndex];
    const rowValues = typeof rowInput === "string"
      ? rowInput.split("")
      : Array.isArray(rowInput)
        ? rowInput
        : null;

    if (!rowValues || rowValues.length !== cols) return null;

    normalized[rowIndex] = [];
    for (let colIndex = 0; colIndex < cols; colIndex++) {
      const raw = String(rowValues[colIndex] ?? "").trim().toUpperCase();
      normalized[rowIndex][colIndex] = whiteCells[rowIndex]?.[colIndex] && /^[A-Z]$/.test(raw) ? raw : "";
    }
  }

  return normalized;
}

function normalizeCellKeys(input: unknown, rows: number, cols: number, whiteCells: boolean[][]): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    const match = /^(\d+),(\d+)$/.exec(value);
    if (!match) continue;

    const row = Number(match[1]);
    const col = Number(match[2]);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
    if (!whiteCells[row]?.[col]) continue;

    seen.add(`${row},${col}`);
  }

  return [...seen];
}

function normalizeActiveClue(input: unknown, allClueKeys: Set<string>): { direction: Direction; number: number } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { direction?: unknown; number?: unknown };
  const direction = raw.direction;
  const number = raw.number;

  if (direction !== "across" && direction !== "down") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (!allClueKeys.has(`${direction}:${number}`)) return null;

  return { direction, number };
}

function serializeLetterRows(letters: string[][]): string[] {
  return letters.map((row) => row.map((letter) => letter || ".").join(""));
}

function hasSavedState(
  letters: string[][],
  revealedCells: string[],
  activeClue: { direction: Direction; number: number } | null,
  elapsedMs: number,
): boolean {
  return activeClue !== null || revealedCells.length > 0 || letters.some((row) => row.some(Boolean)) || elapsedMs > 0;
}

function parseSavedState(
  rawAnswer: string,
  submittedAt: Date,
  rows: number,
  cols: number,
  whiteCells: boolean[][],
  allClueKeys: Set<string>
): {
  letters: string[][];
  revealedCells: string[];
  activeClue: { direction: Direction; number: number } | null;
  elapsedMs: number;
  savedAt: number;
} | null {
  try {
    const parsed = JSON.parse(rawAnswer) as Record<string, unknown>;
    const letters = normalizeLetterRows(parsed.rows ?? parsed.letters, rows, cols, whiteCells);
    if (!letters) return null;

    const revealedCells = normalizeCellKeys(parsed.revealedCells, rows, cols, whiteCells);
    const activeClue = normalizeActiveClue(parsed.activeClue, allClueKeys);
    const elapsedMs = typeof parsed.elapsedMs === "number" && Number.isFinite(parsed.elapsedMs)
      ? Math.max(0, Math.round(parsed.elapsedMs))
      : 0;
    const savedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
      ? parsed.savedAt
      : submittedAt.getTime();

    return { letters, revealedCells, activeClue, elapsedMs, savedAt };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id: puzzleId } = await context.params;

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { data: true, puzzleType: true },
    });

    if (!puzzle || puzzle.puzzleType !== "crossword") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const crossword = validateCrosswordPuzzleData(puzzle.data, {
      requireAnswers: true,
      enforceStyle: false,
    });

    if (!crossword.valid || !crossword.normalized) {
      return NextResponse.json(
        { error: crossword.error ?? "Crossword puzzle data is invalid." },
        { status: 400 }
      );
    }

    const allClueKeys = getAllClueKeys(crossword.normalized);
    const allClueKeySet = new Set(allClueKeys);
    const solvedSubmissions = await prisma.puzzleSubmission.findMany({
      where: {
        puzzleId,
        userId: currentUser.id,
        isCorrect: true,
        feedback: CROSSWORD_CLUE_FEEDBACK,
        answer: { in: allClueKeys },
      },
      select: { answer: true },
      distinct: ["answer"],
    });

    const solvedClues = solvedSubmissions
      .map((submission) => submission.answer)
      .filter((answer) => allClueKeySet.has(answer));

    const { rows, cols } = getCrosswordDimensions(crossword.normalized);
    const whiteCells = buildWhiteCellMap(crossword.normalized, rows, cols);
    const savedSubmission = await prisma.puzzleSubmission.findFirst({
      where: {
        puzzleId,
        userId: currentUser.id,
        feedback: CROSSWORD_PROGRESS_FEEDBACK,
      },
      select: { answer: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    });
    const savedState = savedSubmission
      ? parseSavedState(savedSubmission.answer, savedSubmission.submittedAt, rows, cols, whiteCells, allClueKeySet)
      : null;

    const totalClues = allClueKeys.length;
    const solvedCount = solvedClues.length;

    // Build a letter grid that includes correct letters for solved clues,
    // so the client can restore them even though clue.answer is stripped.
    let mergedLetters: string[][] | null = savedState?.letters ?? null;
    if (solvedClues.length > 0) {
      const solvedKeySet = new Set(solvedClues);
      const base = mergedLetters
        ? mergedLetters.map((row) => [...row])
        : Array.from({ length: rows }, () => Array(cols).fill(""));

      for (const clue of crossword.normalized!.clues.across) {
        if (!solvedKeySet.has(`across:${clue.number}`)) continue;
        for (let offset = 0; offset < clue.length; offset++) {
          base[clue.row][clue.col + offset] = clue.answer?.[offset] ?? "";
        }
      }
      for (const clue of crossword.normalized!.clues.down) {
        if (!solvedKeySet.has(`down:${clue.number}`)) continue;
        for (let offset = 0; offset < clue.length; offset++) {
          base[clue.row + offset][clue.col] = clue.answer?.[offset] ?? "";
        }
      }

      mergedLetters = base;
    }

    return NextResponse.json({
      solvedClues,
      solvedCount,
      totalClues,
      allSolved: totalClues > 0 && solvedCount >= totalClues,
      letters: mergedLetters,
      revealedCells: savedState?.revealedCells ?? [],
      activeClue: savedState?.activeClue ?? null,
      elapsedMs: savedState?.elapsedMs ?? 0,
      savedAt: savedState?.savedAt ?? null,
    });
  } catch (err) {
    console.error("[crossword][GET] Error:", err);
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

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { data: true, puzzleType: true },
    });

    if (!puzzle || puzzle.puzzleType !== "crossword") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const crossword = validateCrosswordPuzzleData(puzzle.data, {
      requireAnswers: true,
      enforceStyle: false,
    });

    if (!crossword.valid || !crossword.normalized) {
      return NextResponse.json(
        { error: crossword.error ?? "Crossword puzzle data is invalid." },
        { status: 400 }
      );
    }

    const { rows, cols } = getCrosswordDimensions(crossword.normalized);
    const whiteCells = buildWhiteCellMap(crossword.normalized, rows, cols);
    const allClueKeys = getAllClueKeys(crossword.normalized);
    const allClueKeySet = new Set(allClueKeys);

    const letters = normalizeLetterRows((body as Record<string, unknown>)?.letters, rows, cols, whiteCells);
    if (!letters) {
      return NextResponse.json({ error: "Invalid saved letters" }, { status: 400 });
    }

    const revealedCells = normalizeCellKeys((body as Record<string, unknown>)?.revealedCells, rows, cols, whiteCells);
    const activeClue = normalizeActiveClue((body as Record<string, unknown>)?.activeClue, allClueKeySet);
    const elapsedMsRaw = (body as Record<string, unknown>)?.elapsedMs;
    const elapsedMs = typeof elapsedMsRaw === "number" && Number.isFinite(elapsedMsRaw)
      ? Math.max(0, Math.round(elapsedMsRaw))
      : 0;
    const shouldSaveState = hasSavedState(letters, revealedCells, activeClue, elapsedMs);
    const now = new Date();

    const solvedSubmissions = await prisma.puzzleSubmission.findMany({
      where: {
        puzzleId,
        userId: currentUser.id,
        isCorrect: true,
        feedback: CROSSWORD_CLUE_FEEDBACK,
        answer: { in: allClueKeys },
      },
      select: { answer: true },
      distinct: ["answer"],
    });
    const completionPercentage = allClueKeys.length > 0
      ? (solvedSubmissions.length / allClueKeys.length) * 100
      : 0;

    await prisma.$transaction(async (tx) => {
      await tx.userPuzzleProgress.upsert({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
        create: {
          userId: currentUser.id,
          puzzleId,
          completionPercentage,
          lastAttemptAt: now,
        },
        update: {
          completionPercentage,
          lastAttemptAt: now,
        },
      });

      await tx.puzzleSubmission.deleteMany({
        where: {
          puzzleId,
          userId: currentUser.id,
          feedback: CROSSWORD_PROGRESS_FEEDBACK,
        },
      });

      if (shouldSaveState) {
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: currentUser.id,
            answer: JSON.stringify({
              version: 1,
              rows: serializeLetterRows(letters),
              revealedCells,
              activeClue,
              elapsedMs,
              savedAt: now.getTime(),
            }),
            isCorrect: false,
            feedback: CROSSWORD_PROGRESS_FEEDBACK,
          },
        });
      }
    });

    return NextResponse.json({ saved: true, hasState: shouldSaveState, savedAt: now.getTime() });
  } catch (err) {
    console.error("[crossword][PATCH] Error:", err);
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
    const { direction, number, answer } = body as {
      direction: "across" | "down";
      number: number;
      answer: string;
    };

    if (!direction || typeof number !== "number" || !answer || typeof answer !== "string") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (direction !== "across" && direction !== "down") {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { data: true, puzzleType: true },
    });

    if (!puzzle || puzzle.puzzleType !== "crossword") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const crossword = validateCrosswordPuzzleData(puzzle.data, {
      requireAnswers: true,
      enforceStyle: false,
    });

    if (!crossword.valid || !crossword.normalized) {
      return NextResponse.json(
        { error: crossword.error ?? "Crossword puzzle data is invalid." },
        { status: 400 }
      );
    }

    const clues =
      direction === "across"
        ? crossword.normalized.clues.across
        : crossword.normalized.clues.down;

    const clue = clues.find((c) => c.number === number);
    if (!clue) {
      return NextResponse.json({ correct: false, error: "Unknown clue" });
    }

    const submittedAnswer = normalizeCrosswordAnswer(answer);
    const expectedAnswer = clue.answer ?? "";
    const correct = submittedAnswer === expectedAnswer;
    if (!correct) {
      return NextResponse.json({ correct: false });
    }

    const allClueKeys = getAllClueKeys(crossword.normalized);
    const clueKey = `${direction}:${number}`;
    const submissionFeedback = CROSSWORD_CLUE_FEEDBACK;

    const existingCorrectSubmission = await prisma.puzzleSubmission.findFirst({
      where: {
        puzzleId,
        userId: currentUser.id,
        isCorrect: true,
        feedback: submissionFeedback,
        answer: clueKey,
      },
      select: { id: true },
    });

    if (!existingCorrectSubmission) {
      await prisma.puzzleSubmission.create({
        data: {
          puzzleId,
          userId: currentUser.id,
          answer: clueKey,
          isCorrect: true,
          feedback: submissionFeedback,
        },
      });
    }

    const solvedSubmissions = await prisma.puzzleSubmission.findMany({
      where: {
        puzzleId,
        userId: currentUser.id,
        isCorrect: true,
        feedback: submissionFeedback,
        answer: { in: allClueKeys },
      },
      select: { answer: true },
      distinct: ["answer"],
    });

    const solvedCount = solvedSubmissions.length;
    const totalClues = allClueKeys.length;
    const allSolved = totalClues > 0 && solvedCount >= totalClues;
    const completionPct = totalClues > 0 ? (solvedCount / totalClues) * 100 : 0;

    const now = new Date();

    try {
      await prisma.userPuzzleProgress.upsert({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
        create: {
          userId: currentUser.id,
          puzzleId,
          completionPercentage: completionPct,
          lastAttemptAt: now,
        },
        update: {
          completionPercentage: completionPct,
          lastAttemptAt: now,
        },
      });
    } catch (persistErr) {
      console.error("[crossword] Failed to persist progress:", persistErr);
    }

    return NextResponse.json({ correct: true, allSolved, solvedCount, totalClues });
  } catch (err) {
    console.error("[crossword] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
