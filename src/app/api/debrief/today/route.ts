import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTodaysDebriefScenario, getTodaysDebriefQuestionIndices, DebriefScenario } from "@/lib/debrief-content";

export const dynamic = 'force-dynamic';

// GET /api/debrief/today — return today's scenario (without correct answers) + stats
// Priority: 1) Scheduled DB puzzle with releaseAt <= now, 2) Hardcoded daily rotation
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    // Try to load a DB-authored debrief puzzle whose go-live date has passed
    const now = new Date();
    let dbPuzzle = await prisma.puzzle.findFirst({
      where: {
        puzzleType: 'debrief',
        isActive: true,
        schedule: { releaseAt: { lte: now } },
      },
      select: { id: true, data: true },
      orderBy: { schedule: { releaseAt: 'desc' } },
    });
    if (!dbPuzzle) {
      dbPuzzle = await prisma.puzzle.findFirst({
        where: { puzzleType: 'debrief', isActive: true, schedule: null },
        select: { id: true, data: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    let scenario: DebriefScenario;

    if (dbPuzzle?.data) {
      const d = dbPuzzle.data as any;
      if (d?.debrief?.scenario) {
        scenario = d.debrief.scenario as DebriefScenario;
      } else {
        // fallback to hardcoded
        scenario = getTodaysDebriefScenario();
      }
    } else {
      scenario = getTodaysDebriefScenario();
    }

    // Aggregate score distribution for this scenario
    const results = await prisma.witnessResult.groupBy({
      by: ["score"],
      where: { scenarioId: scenario.id },
      _count: { score: true },
    });

    const totalPlays = results.reduce((sum, r) => sum + r._count.score, 0);
    const scoreDist = Array(6).fill(0) as number[];
    for (const r of results) scoreDist[r.score] = r._count.score;

    // Has the current user already completed today's debrief? If so, fetch their persisted
    // result so the client can render the results screen directly instead of allowing a replay.
    const existingResult = userId
      ? await prisma.witnessResult.findFirst({
          where: { scenarioId: scenario.id, userId },
          select: { score: true, breakdown: true },
        })
      : null;
    const completed = !!existingResult;

    // Pick today's 5 questions from the pool (deterministic by day)
    const indices = getTodaysDebriefQuestionIndices(scenario, 5);
    const sanitizedQuestions = indices.map((i) => ({
      question: scenario.questions[i].question,
      options: scenario.questions[i].options,
    }));

    let result: {
      score: number;
      breakdown: { correct: boolean; correctIndex: number }[];
      scoreDist: number[];
      totalPlays: number;
      percentile: number;
      rewards: { points: number; xp: number; granted: boolean };
    } | null = null;

    if (existingResult) {
      const beatCount = scoreDist.slice(0, existingResult.score).reduce((s, c) => s + c, 0);
      const percentile = totalPlays > 1
        ? Math.round((beatCount / (totalPlays - 1)) * 100)
        : 100;
      result = {
        score: existingResult.score,
        breakdown: (existingResult.breakdown as { correct: boolean; correctIndex: number }[] | null) ?? [],
        scoreDist,
        totalPlays,
        percentile,
        rewards: {
          points: existingResult.score * 20,
          xp: existingResult.score * 10,
          granted: false,
        },
      };
    }

    return NextResponse.json({
      scenario: {
        id: scenario.id,
        caseNumber: scenario.caseNumber,
        classification: scenario.classification,
        dateTime: scenario.dateTime,
        report: scenario.report,
        questions: sanitizedQuestions,
      },
      stats: {
        totalPlays,
        scoreDist,
      },
      completed,
      result,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
