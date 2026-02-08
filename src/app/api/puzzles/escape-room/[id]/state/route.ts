import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEscapeRoomTeamContext } from "@/lib/escapeRoomTeamAuth";
import { getLobbyLeaderId } from "@/lib/teamLobbyStore";

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    // State should be readable even if the run has failed/completed so the UI can show the end screen.
    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, { requireNotFinished: false });
    if (ctx instanceof NextResponse) return ctx;

    const [progress, escapeRoom] = await Promise.all([
      (prisma as any).teamEscapeProgress.findUnique({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        select: {
          inventory: true,
          sceneState: true,
          solvedStages: true,
          currentStageIndex: true,
          roles: true,
          briefingAcks: true,
          inventoryLocks: true,
          runStartedAt: true,
          runExpiresAt: true,
          failedAt: true,
          failedReason: true,
          completedAt: true,
        },
      }),
      prisma.escapeRoomPuzzle.findUnique({ where: { id: ctx.escapeRoomId }, select: { timeLimitSeconds: true } }),
    ]);

    const lobbyLeaderId = getLobbyLeaderId(ctx.teamId, puzzleId);
    const isLeader = !!lobbyLeaderId && lobbyLeaderId === ctx.userId;

    const markUsersFailed = async (failedAt: Date, failedReason: string) => {
      try {
        const members = await prisma.teamMember.findMany({ where: { teamId: ctx.teamId }, select: { userId: true } });
        const userIds = members.map((m) => m.userId).filter(Boolean);
        await Promise.all(
          userIds.map((userId) =>
            prisma.userEscapeProgress.upsert({
              where: { userId_escapeRoomId: { userId, escapeRoomId: ctx.escapeRoomId } },
              create: {
                userId,
                escapeRoomId: ctx.escapeRoomId,
                failedAt,
                failedReason,
              },
              update: {
                failedAt,
                failedReason,
              },
            })
          )
        );
      } catch {
        // non-fatal
      }
    };

    // If the run timer is expired and the run hasn't been marked failed/completed yet, mark it failed.
    try {
      if (
        progress?.runStartedAt &&
        progress?.runExpiresAt &&
        !progress?.failedAt &&
        !progress?.completedAt &&
        new Date(progress.runExpiresAt).getTime() <= Date.now()
      ) {
        const failAt = new Date();
        const updated = await (prisma as any).teamEscapeProgress.update({
          where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
          data: { failedAt: failAt, failedReason: "Time expired" },
          select: { failedAt: true, failedReason: true },
        });
        if (progress) {
          progress.failedAt = updated.failedAt;
          progress.failedReason = updated.failedReason;
        }

        // Lock out all team members for this escape room.
        await markUsersFailed(failAt, 'time_expired');
      }
    } catch (e) {
      // non-fatal
    }

    let inventory: string[] = [];
    try {
      inventory = progress?.inventory ? JSON.parse(progress.inventory) : [];
      if (!Array.isArray(inventory)) inventory = [];
    } catch {
      inventory = [];
    }

    // Provide item metadata for UI rendering (name + image) without changing persisted inventory format.
    // Inventory is stored as an array of ItemDefinition.key strings.
    let inventoryItems: Record<string, { id: string; key: string; name: string; imageUrl: string | null }> = {};
    try {
      if (inventory.length > 0) {
        const defs = await prisma.itemDefinition.findMany({
          where: {
            escapeRoomId: ctx.escapeRoomId,
            key: { in: inventory },
          },
          select: { id: true, key: true, name: true, imageUrl: true },
        });
        inventoryItems = Object.fromEntries(defs.map((d) => [d.key, d]));
      }
    } catch {
      inventoryItems = {};
    }

    const roles = safeJsonParse<Record<string, string>>(progress?.roles, {});
    const briefingAcks = safeJsonParse<Record<string, string>>(progress?.briefingAcks, {});
    const inventoryLocks = safeJsonParse<Record<string, any>>(progress?.inventoryLocks, {});
    const sceneState = safeJsonParse<Record<string, any>>((progress as any)?.sceneState, {});

    return NextResponse.json({
      inventory,
      inventoryItems,
      sceneState,
      currentStageIndex: progress?.currentStageIndex ?? 0,
      solvedStages: progress?.solvedStages ?? "[]",
      roles,
      briefingAcks,
      inventoryLocks,
      runStartedAt: progress?.runStartedAt ?? null,
      runExpiresAt: progress?.runExpiresAt ?? null,
      failedAt: progress?.failedAt ?? null,
      failedReason: progress?.failedReason ?? null,
      completedAt: progress?.completedAt ?? null,
      isLeader,
      timeLimitSeconds: escapeRoom?.timeLimitSeconds ?? null,
    });
  } catch (e) {
    console.error('Failed to fetch player room state', e);
    return NextResponse.json({ error: 'Failed to fetch escape room state' }, { status: 500 });
  }
}
