import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getCrimeCaseData, validateAccusation } from '@/lib/crimeCase';
import { recordFailedAttempt, MAX_PUZZLE_ATTEMPTS } from '@/lib/attemptLimit';
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
        { error: 'No attempts remaining', locked: true, attemptsUsed: accessState.attemptsUsed, maxAttempts: MAX_PUZZLE_ATTEMPTS },
        { status: 403 }
      );
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, puzzleType: true, data: true, xpReward: true, solutions: { select: { points: true }, take: 1 } },
    });
    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }
    if (puzzle.puzzleType !== 'crime_rpg') {
      return NextResponse.json({ error: 'Not a crime RPG puzzle' }, { status: 400 });
    }

    const caseData = getCrimeCaseData(puzzle.data);
    if (!caseData) {
      return NextResponse.json({ error: 'Crime case is not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { suspectId, mechanism, evidenceIds } = body as {
      suspectId: string;
      mechanism: string;
      evidenceIds: string[];
    };

    if (!suspectId || !mechanism || !Array.isArray(evidenceIds)) {
      return NextResponse.json({ error: 'Missing suspectId, mechanism, or evidenceIds' }, { status: 400 });
    }

    const result = validateAccusation(caseData, { suspectId, mechanism, evidenceIds });

    if (result.correct) {
      // Points come from the puzzle's configured solution (set via admin "Points Reward"),
      // matching how every other puzzle type sources its award amount.
      const awardPoints = puzzle.solutions?.[0]?.points ?? 100;

      // ── Mark the puzzle solved ───────────────────────────────────────────
      await prisma.$transaction(async (tx) => {
        // Record the correct submission
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: user.id,
            answer: `CRIME_ACCUSATION:${suspectId}:${mechanism}`,
            isCorrect: true,
          },
        });

        // Upsert progress record as solved
        await tx.userPuzzleProgress.upsert({
          where: { userId_puzzleId: { userId: user.id, puzzleId } },
          create: {
            userId: user.id,
            puzzleId,
            solved: true,
            solvedAt: new Date(),
            attempts: 1,
            successfulAttempts: 1,
            pointsEarned: awardPoints,
            completionPercentage: 100,
          },
          update: {
            solved: true,
            solvedAt: new Date(),
            successfulAttempts: { increment: 1 },
            attempts: { increment: 1 },
            pointsEarned: awardPoints,
            completionPercentage: 100,
          },
        });

        // Award XP to the user
        const xp = typeof puzzle.xpReward === 'number' ? puzzle.xpReward : 100;
        await tx.user.update({
          where: { id: user.id },
          data: { xp: { increment: xp }, totalPoints: { increment: awardPoints } },
        });
      });

      return NextResponse.json({
        correct: true,
        partialScore: result.partialScore,
        retentionUnlock: caseData.retentionUnlock ?? null,
      });
    } else {
      // ── Record the failed attempt ────────────────────────────────────────
      await prisma.$transaction(async (tx) => {
        await tx.puzzleSubmission.create({
          data: {
            puzzleId,
            userId: user.id,
            answer: `CRIME_ACCUSATION:${suspectId}:${mechanism}`,
            isCorrect: false,
            // Store partial score in feedback JSON for state endpoint to return
            feedback: JSON.stringify(result.partialScore),
          },
        });

        await tx.userPuzzleProgress.upsert({
          where: { userId_puzzleId: { userId: user.id, puzzleId } },
          create: {
            userId: user.id,
            puzzleId,
            solved: false,
            attempts: 1,
            completionPercentage: Math.round(
              ((result.partialScore.suspect ? 1 : 0) +
                (result.partialScore.mechanism ? 1 : 0) +
                result.partialScore.evidenceMatches) /
                (2 + result.partialScore.evidenceRequired) *
                100
            ),
          },
          update: {
            attempts: { increment: 1 },
          },
        });
      });

      const newFailedCount = await recordFailedAttempt(user.id, puzzleId);
      const nowLocked = newFailedCount >= MAX_PUZZLE_ATTEMPTS;
      return NextResponse.json({
        correct: false,
        partialScore: result.partialScore,
        attemptsUsed: newFailedCount,
        attemptsRemaining: Math.max(0, MAX_PUZZLE_ATTEMPTS - newFailedCount),
        locked: nowLocked,
      });
    }
  } catch (e) {
    console.error('[crime/submit] Failed:', e);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}
