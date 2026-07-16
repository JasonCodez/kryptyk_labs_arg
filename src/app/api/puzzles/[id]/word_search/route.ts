import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { awardSeasonXp } from "@/lib/seasonXp";
import { getXpMultiplier } from "@/lib/getXpMultiplier";
import {
  findWordInGrid,
  normalizeWord,
  normalizeWordList,
  normalizeWordSearchGrid,
  validateWordSelection,
} from "@/lib/wordSearchCore";

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
      select: {
        data: true,
        puzzleType: true,
      },
    });

    if (!puzzle || puzzle.puzzleType !== "word_search") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const wsData = (puzzle.data ?? {}) as Record<string, unknown>;
    const grid = normalizeWordSearchGrid(wsData.grid);
    const puzzleWords = normalizeWordList(wsData.words);
    const placeableWords = puzzleWords.filter((w) => !!findWordInGrid(w, grid));

    if (grid.length === 0 || placeableWords.length === 0) {
      return NextResponse.json({ error: "Puzzle data is invalid" }, { status: 400 });
    }

    const foundSubmissions = await prisma.puzzleSubmission.findMany({
      where: {
        puzzleId,
        userId: currentUser.id,
        isCorrect: true,
        answer: { in: placeableWords },
      },
      select: { answer: true },
      distinct: ["answer"],
    });

    const foundWords = normalizeWordList(foundSubmissions.map((s) => s.answer));
    const foundCount = foundWords.length;

    return NextResponse.json({
      foundWords,
      foundCount,
      total: placeableWords.length,
      allFound: foundCount >= placeableWords.length,
    });
  } catch (err) {
    console.error("[word_search][GET] Error:", err);
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
    const { word, cells, allFoundWords, warzMode, dailyMode } = body as {
      word: string;
      cells: { row: number; col: number }[];
      allFoundWords: string[];
      warzMode?: boolean;
      dailyMode?: boolean;
    };

    if (!word || typeof word !== "string") {
      return NextResponse.json({ error: "No word provided" }, { status: 400 });
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: {
        data: true,
        puzzleType: true,
        xpReward: true,
        solutions: { select: { points: true }, take: 1 },
      },
    });

    if (!puzzle || puzzle.puzzleType !== "word_search") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const wsData = (puzzle.data ?? {}) as Record<string, unknown>;
    const grid = normalizeWordSearchGrid(wsData.grid);
    const puzzleWords = normalizeWordList(wsData.words);
    const placeableWords = puzzleWords.filter((w) => !!findWordInGrid(w, grid));

    if (grid.length === 0 || placeableWords.length === 0) {
      return NextResponse.json({ error: "Puzzle data is invalid" }, { status: 400 });
    }

    const cleanWord = normalizeWord(word);

    // Validate the word is in the puzzle's word list
    if (!placeableWords.includes(cleanWord)) {
      return NextResponse.json({ valid: false, error: "Word not in puzzle" });
    }

    const selection = validateWordSelection(cleanWord, grid, cells);
    if (!selection.valid) {
      return NextResponse.json({ valid: false, error: selection.error ?? "Invalid selection" });
    }

    const clientFoundSet = new Set(
      normalizeWordList(allFoundWords).filter((w) => placeableWords.includes(w))
    );
    clientFoundSet.add(cleanWord);

    let foundCount = clientFoundSet.size;
    let allFound = foundCount >= placeableWords.length;

    // Persist progress. Skipped for warzMode (short synchronous head-to-head round) and
    // dailyMode (the daily-rotation flow owns its own completion/reward bookkeeping via
    // DailyPuzzleRecord, awarded once by /api/daily/word_search/complete) — for both,
    // allFound/foundCount fall back to the client-reported tally above.
    if (!warzMode && !dailyMode) try {
      const now = new Date();

      let progress = await prisma.userPuzzleProgress.findUnique({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
      });

      if (!progress) {
        progress = await prisma.userPuzzleProgress.create({
          data: { userId: currentUser.id, puzzleId },
        });
      }

      const alreadyFound = await prisma.puzzleSubmission.findFirst({
        where: {
          puzzleId,
          userId: currentUser.id,
          isCorrect: true,
          answer: cleanWord,
        },
        select: { id: true },
      });

      if (!alreadyFound) {
        await prisma.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: currentUser.id,
            answer: cleanWord,
            isCorrect: true,
            feedback: "word_search_found",
          },
        });
      }

      const foundSubmissions = await prisma.puzzleSubmission.findMany({
        where: {
          puzzleId,
          userId: currentUser.id,
          isCorrect: true,
          answer: { in: placeableWords },
        },
        select: { answer: true },
        distinct: ["answer"],
      });

      foundCount = foundSubmissions.length;
      allFound = foundCount >= placeableWords.length;

      if (!progress.solved) {
        const completionPct = (foundCount / placeableWords.length) * 100;
        const progressUpdate: Record<string, unknown> = {
          lastAttemptAt: now,
          completionPercentage: completionPct,
        };

        if (!alreadyFound) {
          progressUpdate.attempts = { increment: 1 };
        }

        if (allFound) {
          progressUpdate.solved = true;
          progressUpdate.solvedAt = now;
          progressUpdate.successfulAttempts = { increment: 1 };
        }

        // Claim completion with a conditional write. Concurrent final-word requests
        // may both validate, but only one is allowed to own points/XP/reward writes.
        const updateResult = await prisma.userPuzzleProgress.updateMany({
          where: { id: progress.id, solved: false },
          data: progressUpdate,
        });

        if (allFound && updateResult.count === 1) {
          const awardPoints = puzzle.solutions?.[0]?.points ?? 100;

          await prisma.userPuzzleProgress.update({
            where: { id: progress.id },
            data: { pointsEarned: { increment: awardPoints } },
          });

          await prisma.user.update({
            where: { id: currentUser.id },
            data: { totalPoints: { increment: awardPoints } },
          });

          const existing = await prisma.globalLeaderboard.findFirst({
            where: { userId: currentUser.id },
          });
          if (existing) {
            await prisma.globalLeaderboard.update({
              where: { id: existing.id },
              data: { totalPoints: { increment: awardPoints } },
            });
          } else {
            await prisma.globalLeaderboard.create({
              data: { userId: currentUser.id, totalPoints: awardPoints },
            });
          }

          const baseXpWs = puzzle.xpReward ?? 50;
          const xpMultiplierWs = await getXpMultiplier(currentUser.id);
          const xpGain = baseXpWs * xpMultiplierWs;
          const freshUser = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { xp: true },
          });
          const newXp = (freshUser?.xp ?? 0) + xpGain;
          const { level, title } = calcLevel(newXp);
          await prisma.user.update({
            where: { id: currentUser.id },
            data: { xp: newXp, level, xpTitle: title },
          });
          // Season pass XP
          await awardSeasonXp(currentUser.id, xpGain);
        }
      }
    } catch (persistErr) {
      console.error("[word_search] Failed to persist progress:", persistErr);
      // Non-fatal: still return the result to the player
    }

    return NextResponse.json({
      valid: true,
      allFound,
      foundCount,
      total: placeableWords.length,
    });
  } catch (err) {
    console.error("[word_search] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
