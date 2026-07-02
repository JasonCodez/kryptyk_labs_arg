import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { awardSeasonXp } from "@/lib/seasonXp";
import { getXpMultiplier } from "@/lib/getXpMultiplier";
import { isSolvedWordScryResult, scoreWordScryGuess } from "@/lib/wordScry";
import { isValidDictionaryWord } from "@/lib/dictionary";
// WordScry uses a stricter 2-game limit independent of the global MAX_PUZZLE_ATTEMPTS.
// First failure: can retry with halved XP/points. Second failure: permanently locked.
const WORD_CRACK_MAX_ATTEMPTS = 2;

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
    const { guess, warzMode } = body as { guess: string; warzMode?: boolean };

    if (!guess || typeof guess !== "string") {
      return NextResponse.json({ error: "No guess provided" }, { status: 400 });
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { data: true, puzzleType: true, xpReward: true, solutions: { select: { points: true }, take: 1 } },
    });

    if (!puzzle || puzzle.puzzleType !== "word_crack") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const wordleData = (puzzle.data ?? {}) as Record<string, unknown>;
    const word = String(wordleData.word ?? "").toUpperCase().trim();

    // Check 2-attempt limit for WordScry (each full failed game = 1 attempt)
    if (!warzMode) {
      const progress = await prisma.userPuzzleProgress.findUnique({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
        select: { solved: true, failedAttempts: true },
      });
      const isLocked = !progress?.solved && (progress?.failedAttempts ?? 0) >= WORD_CRACK_MAX_ATTEMPTS;
      if (isLocked) {
        return NextResponse.json(
          {
            locked: true,
            attemptsUsed: progress?.failedAttempts ?? WORD_CRACK_MAX_ATTEMPTS,
            maxAttempts: WORD_CRACK_MAX_ATTEMPTS,
            revealWord: word,
          },
          { status: 403 }
        );
      }
    }

    if (!word) {
      return NextResponse.json(
        { error: "No word configured for this puzzle" },
        { status: 400 }
      );
    }

    const cleanGuess = guess.toUpperCase().trim();

    if (cleanGuess.length !== word.length) {
      return NextResponse.json(
        { error: `Guess must be ${word.length} letters` },
        { status: 400 }
      );
    }

    // Reject guesses that contain non-alpha characters
    if (!/^[A-Z]+$/.test(cleanGuess)) {
      return NextResponse.json(
        { error: "Guess must contain only letters" },
        { status: 400 }
      );
    }

    // Reject guesses that aren't real words (the answer itself is always allowed,
    // even if it's obscure enough to not be in the dictionary list).
    if (cleanGuess !== word && !isValidDictionaryWord(cleanGuess)) {
      return NextResponse.json(
        { error: "Not a valid word" },
        { status: 400 }
      );
    }

    const result = scoreWordScryGuess(cleanGuess, word);
    const solved = isSolvedWordScryResult(result);

    // ── Persist progress ─────────────────────────────────────────────────
    if (!warzMode) try {
      const now = new Date();

      // Upsert the progress record: increment attempts each guess, mark solved when correct.
      let progress = await prisma.userPuzzleProgress.findUnique({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId } },
      });

      if (!progress) {
        progress = await prisma.userPuzzleProgress.create({
          data: { userId: currentUser.id, puzzleId },
        });
      }

      // Prevent overwriting an already-solved record.
      if (!progress.solved) {
        await prisma.userPuzzleProgress.update({
          where: { id: progress.id },
          data: {
            attempts: { increment: 1 },
            lastAttemptAt: now,
            ...(solved && {
              solved: true,
              solvedAt: now,
              successfulAttempts: { increment: 1 },
            }),
          },
        });

        if (solved) {
          // Halve rewards if the player is on their second (retry) attempt
          const penaltyApplied = (progress.failedAttempts ?? 0) >= 1;
          const basePoints = puzzle.solutions?.[0]?.points ?? 100;
          const baseXp = puzzle.xpReward ?? 50;
          const xpMultiplier = await getXpMultiplier(currentUser.id);
          // Triple-or-Nothing: 3x if this is the first attempt and the token is active
          const wcUser = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { tripleOrNothingActive: true },
          });
          const wcTripleActive = wcUser?.tripleOrNothingActive && (progress.failedAttempts ?? 0) === 0;
          if (wcTripleActive) {
            await prisma.user.update({ where: { id: currentUser.id }, data: { tripleOrNothingActive: false } });
          }
          const tripleMultiplier = wcTripleActive ? 3 : 1;
          const awardPoints = (penaltyApplied ? Math.floor(basePoints / 2) : basePoints) * tripleMultiplier;
          const xpGain = (penaltyApplied ? Math.floor(baseXp / 2) : baseXp) * xpMultiplier * tripleMultiplier;

          await prisma.userPuzzleProgress.update({
            where: { id: progress.id },
            data: { pointsEarned: { increment: awardPoints } },
          });

          // Persist to user (survives puzzle deletion) and leaderboard
          await prisma.user.update({
            where: { id: currentUser.id },
            data: { totalPoints: { increment: awardPoints } },
          });

          const existing = await prisma.globalLeaderboard.findFirst({ where: { userId: currentUser.id } });
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

          // Award XP
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

          return NextResponse.json({
            result,
            solved,
            wordLength: word.length,
            xpGained: xpGain,
            penaltyApplied,
          });
        }
      }
    } catch (persistErr) {
      console.error("[word_crack] Failed to persist progress:", persistErr);
      // Non-fatal: still return the guess result to the player.
    }

    return NextResponse.json({ result, solved, wordLength: word.length });
  } catch (err) {
    console.error("[wordle/guess] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
