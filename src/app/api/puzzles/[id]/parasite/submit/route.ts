import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getParasiteCodeData, validateQuarantine, calcRank, createFallbackParasiteCodeCase } from '@/lib/parasiteCode';
import { recordFailedAttempt, resetFailedAttempts, MAX_PUZZLE_ATTEMPTS } from '@/lib/attemptLimit';
import { getPuzzleAccessState } from '@/lib/puzzle-state/getPuzzleAccessState';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: puzzleId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't let already-solved players re-submit
    const alreadySolved = await prisma.puzzleSubmission.findFirst({
      where: { puzzleId, userId: user.id, isCorrect: true },
      select: { id: true },
    });
    if (alreadySolved) {
      return NextResponse.json({ error: 'Already solved', alreadySolved: true }, { status: 400 });
    }

    // Enforce 3-attempt limit
    const accessState = await getPuzzleAccessState(user.id, puzzleId);
    if (accessState.isAttemptLocked) {
      return NextResponse.json(
        {
          error: 'No attempts remaining',
          locked: true,
          attemptsUsed: accessState.attemptsUsed,
          attemptsRemaining: accessState.attemptsRemaining,
          maxAttempts: MAX_PUZZLE_ATTEMPTS,
        },
        { status: 403 }
      );
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, title: true, puzzleType: true, data: true, xpReward: true },
    });
    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }
    if (puzzle.puzzleType !== 'parasite_code') {
      return NextResponse.json({ error: 'Not a Parasite Code puzzle' }, { status: 400 });
    }

    const parsedCaseData = getParasiteCodeData(puzzle.data);
    const caseData = parsedCaseData ?? createFallbackParasiteCodeCase(puzzle.title);
    if (!parsedCaseData) {
      console.warn(`[parasite/submit] Missing parasite data for puzzle ${puzzleId}; using fallback case.`);
    }

    const body = await req.json();
    const { quarantinedIds } = body as { quarantinedIds: string[] };

    if (!Array.isArray(quarantinedIds)) {
      return NextResponse.json({ error: 'Missing quarantinedIds array' }, { status: 400 });
    }

    // Count existing attempts before this one
    const prevAttempts = await prisma.puzzleSubmission.count({
      where: { puzzleId, userId: user.id },
    });

    const result = validateQuarantine(caseData, quarantinedIds);
    const submissionCount = prevAttempts + 1;
    const rank = calcRank(submissionCount);

    if (result.correct) {
      await prisma.$transaction(async (tx) => {
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: user.id,
            answer: `PARASITE_QUARANTINE:${quarantinedIds.join(',')}`,
            isCorrect: true,
          },
        });

        await tx.userPuzzleProgress.upsert({
          where: { userId_puzzleId: { userId: user.id, puzzleId } },
          create: {
            userId: user.id,
            puzzleId,
            solved: true,
            solvedAt: new Date(),
            attempts: submissionCount,
            successfulAttempts: 1,
            pointsEarned: 100,
            completionPercentage: 100,
          },
          update: {
            solved: true,
            solvedAt: new Date(),
            successfulAttempts: { increment: 1 },
            attempts: { increment: 1 },
            pointsEarned: 100,
            completionPercentage: 100,
          },
        });

        const xp = typeof puzzle.xpReward === 'number' ? puzzle.xpReward : 100;
        await tx.user.update({
          where: { id: user.id },
          data: { xp: { increment: xp }, totalPoints: { increment: 100 } },
        });
      });

      return NextResponse.json({
        correct: true,
        feedback: result.feedback,
        foundCount: result.foundCount,
        totalParasiteCount: result.totalParasiteCount,
        submissionCount,
        rank,
        activationCondition: caseData.activationCondition,
        retentionUnlock: caseData.retentionUnlock ?? null,
        attemptsUsed: accessState.attemptsUsed,
        attemptsRemaining: accessState.attemptsRemaining,
        maxAttempts: MAX_PUZZLE_ATTEMPTS,
        locked: false,
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: user.id,
            answer: `PARASITE_QUARANTINE:${quarantinedIds.join(',')}`,
            isCorrect: false,
            feedback: result.feedback,
          },
        });

        await tx.userPuzzleProgress.upsert({
          where: { userId_puzzleId: { userId: user.id, puzzleId } },
          create: {
            userId: user.id,
            puzzleId,
            solved: false,
            attempts: submissionCount,
            successfulAttempts: 0,
            pointsEarned: 0,
            completionPercentage: 0,
          },
          update: {
            attempts: { increment: 1 },
          },
        });
      });

      const attemptsUsed = await recordFailedAttempt(user.id, puzzleId);
      const attemptsRemaining = Math.max(0, MAX_PUZZLE_ATTEMPTS - attemptsUsed);
      const locked = attemptsRemaining === 0;
      // Reset right away so the player gets a fresh set of attempts next time
      // instead of a permanent lockout; this response still reports the true
      // just-hit count for this round's message.
      if (locked) {
        await resetFailedAttempts(user.id, puzzleId);
      }

      return NextResponse.json({
        correct: false,
        feedback: result.feedback,
        foundCount: result.foundCount,
        totalParasiteCount: result.totalParasiteCount,
        submissionCount,
        rank,
        attemptsUsed,
        attemptsRemaining,
        maxAttempts: MAX_PUZZLE_ATTEMPTS,
        locked,
      });
    }
  } catch (e) {
    console.error('[parasite/submit] Failed:', e);
    return NextResponse.json({ error: 'Failed to submit quarantine' }, { status: 500 });
  }
}
