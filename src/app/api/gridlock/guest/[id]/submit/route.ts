import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getGridlockFileData,
  validateLawDeclaration,
  calcGridlockRank,
} from '@/lib/gridlockFile';
import type { GridCellValue, RuleFamily, RuleAxis } from '@/lib/gridlockFile';
import { validateGridlockSubmission } from '@/lib/gridlockCore';

// POST /api/gridlock/guest/[id]/submit
// Public — no auth required.
// Validates the answer and returns result. No DB writes — state lives in localStorage.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: puzzleId } = await params;

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, puzzleType: true, data: true, xpReward: true },
    });

    if (!puzzle || puzzle.puzzleType !== 'gridlock_file') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fileData = getGridlockFileData(puzzle.data);
    if (!fileData) {
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => null) as {
      answers: GridCellValue[];
      declaredFamily?: RuleFamily;
      declaredAxis?: RuleAxis;
      submissionCount?: number;
      elapsedSeconds?: number;
      anonId?: string;
    } | null;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Malformed JSON submission' }, { status: 400 });
    }

    const { answers, declaredFamily, declaredAxis, submissionCount = 1, elapsedSeconds = 0, anonId } = body;

    const checkedSubmission = validateGridlockSubmission(
      fileData as unknown as Parameters<typeof validateGridlockSubmission>[0],
      { answers },
    );
    if (!checkedSubmission.valid) {
      return NextResponse.json({ error: checkedSubmission.errors[0]?.message ?? 'Invalid Gridlock submission', issues: checkedSubmission.errors }, { status: 400 });
    }
    if (submissionCount > (fileData.maximumAttempts ?? 999)) {
      return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 429 });
    }

    const answerResult = {
      correct: checkedSubmission.correct,
      correctCount: checkedSubmission.correctCount,
      totalMissing: checkedSubmission.requiredCount,
    };

    let lawResult = 'not-declared';
    if (declaredFamily && declaredAxis) {
      lawResult = validateLawDeclaration(fileData, declaredFamily, declaredAxis);
    }

    const rank = calcGridlockRank(submissionCount, 0);

    const partialHint =
      answerResult.totalMissing > 1 && !answerResult.correct
        ? `${answerResult.correctCount} of ${answerResult.totalMissing} values correct.`
        : null;

    if (answerResult.correct) {
      // Await the write so it lands before the response — still non-fatal if it fails
      try {
        await prisma.gridlockSolve.create({
          data: {
            puzzleId,
            anonId: anonId ?? null,
            rank,
            elapsedSeconds,
            submissionCount,
          },
        });
      } catch (e) {
        console.error('[gridlock/guest/submit] standings write failed:', e);
      }
    }

    return NextResponse.json({
      correct: answerResult.correct,
      answerResult,
      lawResult,
      partialHint,
      submissionCount,
      rank,
      xpReward: fileData.rewardSettings?.xp ?? puzzle.xpReward ?? 100,
      pointsReward: fileData.rewardSettings?.points ?? 100,
      ruleExplanation: answerResult.correct ? fileData.ruleExplanation : undefined,
      retentionUnlock: answerResult.correct ? (fileData.retentionUnlock ?? null) : null,
      arcDay: fileData.arcDay,
      arcNumber: fileData.arcNumber,
      fileTitle: fileData.fileTitle,
      fileNumber: fileData.fileNumber,
    });
  } catch (e) {
    console.error('[gridlock/guest/submit]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
