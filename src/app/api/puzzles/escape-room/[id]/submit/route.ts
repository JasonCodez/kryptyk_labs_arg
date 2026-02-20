import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEscapeRoomTeamContext } from "@/lib/escapeRoomTeamAuth";
import {
  isContributionGateSatisfied,
  parseContributionGate,
  recordStageContribution,
  summarizeStageContributions,
} from "@/lib/escape-room-contribution";

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const body = await request.json().catch(() => ({}));
    const { stageIndex, answer, teamId } = body as { stageIndex?: number; answer?: string; teamId?: string };

    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, { teamId });
    if (ctx instanceof NextResponse) return ctx;

    if (typeof stageIndex !== 'number') {
      return NextResponse.json({ error: 'stageIndex is required' }, { status: 400 });
    }

    // Load the stage for the given escape room/puzzle
    const stage = await prisma.escapeStage.findFirst({ where: { escapeRoomId: ctx.escapeRoomId, order: stageIndex } });

    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 });

    // Simple answer validation: compare sanitized strings if stage has correctAnswer
    if (stage.correctAnswer && typeof answer === 'string') {
      const ok = stage.correctAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
      if (ok) {
        // Persist solved stage to team progress (best-effort)
        try {
          const progress = await (prisma as any).teamEscapeProgress.findUnique({
            where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
            select: { solvedStages: true, currentStageIndex: true, sceneState: true },
          });

          const teamRows = await prisma.teamMember.findMany({ where: { teamId: ctx.teamId }, select: { userId: true } });
          const teamUserIds = teamRows.map((m) => m.userId).filter(Boolean);

          const stageMeta = safeJsonParse<Record<string, unknown>>(stage.puzzleData, {});
          const currentStage = Math.max(1, Number(progress?.currentStageIndex ?? stage.order));
          const sceneStateWithContribution = recordStageContribution({
            sceneStateRaw: safeJsonParse<Record<string, unknown>>(progress?.sceneState, {}),
            stageIndex: currentStage,
            userId: ctx.userId,
          });
          const contributionGate = parseContributionGate(stageMeta, {
            requiredDistinct: Math.max(1, teamUserIds.length),
            minActionsPerPlayer: 1,
          });
          const contributionSummary = summarizeStageContributions({
            sceneStateRaw: sceneStateWithContribution,
            stageIndex: currentStage,
            teamUserIds,
            gate: contributionGate,
          });
          if (!isContributionGateSatisfied(contributionSummary)) {
            return NextResponse.json(
              {
                error: `All teammates must contribute before advancing. Progress: ${contributionSummary.distinctContributors}/${contributionSummary.requiredDistinct} contributors with at least ${contributionSummary.minActionsPerPlayer} action(s).`,
                contribution: contributionSummary,
              },
              { status: 409 }
            );
          }

          let solvedStages: number[] = [];
          try {
            solvedStages = progress?.solvedStages ? JSON.parse(progress.solvedStages) : [];
            if (!Array.isArray(solvedStages)) solvedStages = [];
          } catch {
            solvedStages = [];
          }

          if (!solvedStages.includes(stage.order)) solvedStages.push(stage.order);
          solvedStages.sort((a, b) => a - b);

          await (prisma as any).teamEscapeProgress.update({
            where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
            data: {
              solvedStages: JSON.stringify(solvedStages),
              currentStageIndex: Math.max(progress?.currentStageIndex ?? 0, stage.order),
              sceneState: JSON.stringify(sceneStateWithContribution),
            },
          });
        } catch (e) {
          // ignore progress write failures
        }

        // Return next stage index (best-effort)
        const next = stage.order + 1;
        return NextResponse.json({ correct: true, message: 'Correct', nextStageIndex: next });
      }
      return NextResponse.json({ correct: false, message: 'Incorrect' });
    }

    return NextResponse.json({ error: 'No answer expected for this stage' }, { status: 400 });
  } catch (e) {
    console.error('Error submitting escape stage answer:', e);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}
