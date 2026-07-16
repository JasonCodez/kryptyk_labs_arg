import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { createNotification } from "@/lib/notification-service";
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

    const [foundSubmissions, progress] = await Promise.all([
      prisma.puzzleSubmission.findMany({
        where: {
          puzzleId,
          userId: currentUser.id,
          isCorrect: true,
          answer: { in: placeableWords },
        },
        select: { answer: true },
        distinct: ["answer"],
      }),
      prisma.userPuzzleProgress.findUnique({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
        select: { solved: true },
      }),
    ]);

    const foundWords = normalizeWordList(foundSubmissions.map((s) => s.answer));
    const foundCount = foundWords.length;

    return NextResponse.json({
      foundWords,
      foundCount,
      total: placeableWords.length,
      submissionsComplete: foundCount >= placeableWords.length,
      allFound: foundCount >= placeableWords.length && Boolean(progress?.solved),
      completionCommitted: Boolean(progress?.solved),
      repairRequired: foundCount >= placeableWords.length && !progress?.solved,
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
    const { action, word, cells, allFoundWords, warzMode, dailyMode } = body as {
      action?: string;
      word?: string;
      cells: { row: number; col: number }[];
      allFoundWords: string[];
      warzMode?: boolean;
      dailyMode?: boolean;
    };

    const reconcileCompletion = action === "reconcile_completion";
    if (action && !reconcileCompletion) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    if (!reconcileCompletion && (!word || typeof word !== "string")) {
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

    const cleanWord = reconcileCompletion ? "" : normalizeWord(word ?? "");

    // Validate the word is in the puzzle's word list
    if (!reconcileCompletion && !placeableWords.includes(cleanWord)) {
      return NextResponse.json({ valid: false, error: "Word not in puzzle" });
    }

    const selection = reconcileCompletion ? { valid: true } : validateWordSelection(cleanWord, grid, cells);
    if (!selection.valid) {
      return NextResponse.json({ valid: false, error: selection.error ?? "Invalid selection" });
    }

    const clientFoundSet = new Set(
      normalizeWordList(allFoundWords ?? []).filter((w) => placeableWords.includes(w))
    );
    if (cleanWord) clientFoundSet.add(cleanWord);

    let foundCount = clientFoundSet.size;
    let allFound = foundCount >= placeableWords.length;
    let persisted = false;
    let completionCommitted = false;
    let seasonNotification: { tier: number } | null = null;

    // Persist progress. Skipped for warzMode (short synchronous head-to-head round) and
    // dailyMode (the daily-rotation flow owns its own completion/reward bookkeeping via
    // DailyPuzzleRecord, awarded once by /api/daily/word_search/complete) — for both,
    // allFound/foundCount fall back to the client-reported tally above.
    if (reconcileCompletion || (!warzMode && !dailyMode)) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const now = new Date();
          const progress = await tx.userPuzzleProgress.upsert({
            where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
            create: { userId: currentUser.id, puzzleId },
            update: {},
          });

          const alreadyFound = reconcileCompletion ? null : await tx.puzzleSubmission.findFirst({
            where: { puzzleId, userId: currentUser.id, isCorrect: true, answer: cleanWord },
            select: { id: true },
          });
          if (!reconcileCompletion && !alreadyFound) {
            await tx.puzzleSubmission.create({
              data: {
                puzzleId,
                userId: currentUser.id,
                answer: cleanWord,
                isCorrect: true,
                feedback: "word_search_found",
              },
            });
          }

          const submissions = await tx.puzzleSubmission.findMany({
            where: {
              puzzleId,
              userId: currentUser.id,
              isCorrect: true,
              answer: { in: placeableWords },
            },
            select: { answer: true },
            distinct: ["answer"],
          });
          const durableFoundCount = normalizeWordList(submissions.map((submission) => submission.answer)).length;
          const durableAllFound = durableFoundCount >= placeableWords.length;

          if (reconcileCompletion && !durableAllFound) {
            return {
              eligible: false,
              foundCount: durableFoundCount,
              allFound: false,
              completionCommitted: Boolean(progress.solved),
              seasonNotification: null,
            };
          }

          let committedSeasonNotification: { tier: number } | null = null;

          if (!progress.solved) {
            const progressUpdate = {
              lastAttemptAt: now,
              completionPercentage: (durableFoundCount / placeableWords.length) * 100,
              ...(!reconcileCompletion && !alreadyFound && { attempts: { increment: 1 } }),
              ...(durableAllFound && {
                solved: true,
                solvedAt: now,
                successfulAttempts: { increment: 1 },
              }),
            };
            const claimed = await tx.userPuzzleProgress.updateMany({
              where: { id: progress.id, solved: false },
              data: progressUpdate,
            });

            if (durableAllFound && claimed.count === 1) {
              const awardPoints = puzzle.solutions?.[0]?.points ?? 100;
              const user = await tx.user.findUnique({
                where: { id: currentUser.id },
                select: { xp: true, xpBoostExpiresAt: true },
              });
              if (!user) throw new Error("Reward recipient was not found");
              const xpMultiplier = user.xpBoostExpiresAt && user.xpBoostExpiresAt.getTime() > now.getTime() ? 2 : 1;
              const xpGain = (puzzle.xpReward ?? 50) * xpMultiplier;
              const newXp = (user.xp ?? 0) + xpGain;
              const { level, title } = calcLevel(newXp);

              await tx.userPuzzleProgress.update({
                where: { id: progress.id },
                data: { pointsEarned: { increment: awardPoints } },
              });
              await tx.user.update({
                where: { id: currentUser.id },
                data: {
                  totalPoints: { increment: awardPoints },
                  xp: newXp,
                  level,
                  xpTitle: title,
                },
              });

              const leaderboard = await tx.globalLeaderboard.findFirst({ where: { userId: currentUser.id } });
              if (leaderboard) {
                await tx.globalLeaderboard.update({
                  where: { id: leaderboard.id },
                  data: { totalPoints: { increment: awardPoints }, puzzlesSolved: { increment: 1 } },
                });
              } else {
                await tx.globalLeaderboard.create({
                  data: { userId: currentUser.id, totalPoints: awardPoints, puzzlesSolved: 1 },
                });
              }

              const seasonPass = await tx.userSeasonPass.findFirst({
                where: {
                  userId: currentUser.id,
                  season: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
                },
                include: { season: { include: { tiers: { orderBy: { tierNumber: "asc" } } } } },
              });
              if (seasonPass) {
                const seasonXp = seasonPass.seasonXp + xpGain;
                let currentTier = 0;
                for (const tier of seasonPass.season.tiers) {
                  if (seasonXp < tier.xpRequired) break;
                  currentTier = tier.tierNumber;
                }
                await tx.userSeasonPass.update({
                  where: { id: seasonPass.id },
                  data: { seasonXp, currentTier },
                });
                const crossed = seasonPass.season.tiers.find((tier) => tier.tierNumber === currentTier);
                if (currentTier > seasonPass.currentTier && !seasonPass.isPremium && crossed?.premRewardType) {
                  committedSeasonNotification = { tier: currentTier };
                }
              }
            }
          }

          const committedProgress = await tx.userPuzzleProgress.findUnique({
            where: { id: progress.id },
            select: { solved: true },
          });
          return {
            eligible: true,
            foundCount: durableFoundCount,
            allFound: durableAllFound,
            completionCommitted: Boolean(committedProgress?.solved),
            seasonNotification: committedSeasonNotification,
          };
        });
        if (!result.eligible) {
          return NextResponse.json({
            valid: false,
            recoverable: true,
            submissionsComplete: false,
            completionCommitted: result.completionCommitted,
            foundCount: result.foundCount,
            total: placeableWords.length,
            error: "All puzzle words must be durably submitted before completion can be reconciled.",
          }, { status: 409 });
        }
        foundCount = result.foundCount;
        allFound = result.allFound;
        completionCommitted = result.completionCommitted;
        seasonNotification = result.seasonNotification;
        persisted = true;
      } catch (persistErr) {
        console.error("[word_search] Failed to persist progress:", persistErr);
        return NextResponse.json(
          {
            valid: false,
            persisted: false,
            completionCommitted: false,
            recoverable: true,
            error: "That word could not be saved. Please try it again.",
          },
          { status: 503 },
        );
      }
    }

    // Reward state is already durable. Notification delivery is deliberately
    // post-commit and non-fatal; only the transaction that claimed completion
    // can report a tier crossing, so concurrent/retried requests cannot emit it twice.
    if (seasonNotification) {
      try {
        const title = `🏅 Tier ${seasonNotification.tier} unlocked!`;
        const notificationKey = `word-search-completion:${puzzleId}:tier:${seasonNotification.tier}`;
        const existing = await prisma.notification.findFirst({
          where: { userId: currentUser.id, type: "system", relatedId: notificationKey },
          select: { id: true },
        });
        if (!existing) {
          await createNotification({
            userId: currentUser.id,
            type: "system",
            title,
            message: `You just hit Season Tier ${seasonNotification.tier}. There's a premium reward waiting — upgrade to Season Pass for $4.99 to claim it.`,
            icon: "🏅",
            relatedId: notificationKey,
          });
        }
      } catch (notificationError) {
        console.error("[word_search] Tier notification failed after completion commit:", notificationError);
      }
    }

    return NextResponse.json({
      valid: true,
      allFound,
      foundCount,
      total: placeableWords.length,
      persisted,
      completionCommitted,
      submissionsComplete: allFound,
    });
  } catch (err) {
    console.error("[word_search] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
