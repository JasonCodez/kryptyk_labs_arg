import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/escape-rooms/[id]/lobby/pause-run
 * Internal endpoint called by the socket server when a player disconnects from an active
 * lobby run. Protected by x-socket-secret.
 *
 * - If other players are still in the lobby: creates a solo-save snapshot row for this
 *   player (shared run continues unaffected).
 * - If this was the last player: pauses the shared progress record in place.
 *
 * Body: { lobbyId: string, userId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const secret = process.env.SOCKET_SECRET;
    if (secret) {
      const provided = request.headers.get("x-socket-secret") ?? "";
      if (provided !== secret) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const body = await request.json().catch(() => null);
    const { lobbyId, userId } = body ?? {};

    if (!lobbyId || !userId) {
      return NextResponse.json({ error: "lobbyId and userId required" }, { status: 400 });
    }

    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return NextResponse.json({ ok: true }); // no-op

    // How many members are still connected to this lobby?
    const remainingMembers = await prisma.escapeRoomLobbyMember.count({
      where: { lobbyId },
    });

    const progress = await prisma.teamEscapeProgress.findFirst({
      where: { lobbyId, escapeRoomId: escapeRoom.id },
      select: {
        id: true,
        runStartedAt: true,
        runExpiresAt: true,
        completedAt: true,
        failedAt: true,
        pausedAt: true,
        currentStageIndex: true,
        solvedStages: true,
        inventory: true,
      },
    });

    if (!progress?.runStartedAt || progress.completedAt || progress.failedAt) {
      return NextResponse.json({ ok: true }); // not started or already ended
    }

    const remainingMs = progress.runExpiresAt
      ? Math.max(0, new Date(progress.runExpiresAt).getTime() - Date.now())
      : null;

    if (remainingMembers > 0) {
      // Others still playing — create a solo save snapshot for the disconnecting player
      // without touching the shared progress record.
      const existing = await prisma.teamEscapeProgress.findFirst({
        where: {
          soloUserId: userId,
          escapeRoomId: escapeRoom.id,
          pausedAt: { not: null },
          completedAt: null,
          failedAt: null,
        },
        select: { id: true },
      });

      const snapshotData = {
        pausedAt: new Date(),
        pausedRemainingMs: remainingMs,
        soloUserId: userId,
        runExpiresAt: null,
        runStartedAt: new Date(),
        currentStageIndex: progress.currentStageIndex,
        solvedStages: progress.solvedStages,
        inventory: progress.inventory,
      };

      if (existing) {
        await prisma.teamEscapeProgress.update({ where: { id: existing.id }, data: snapshotData });
      } else {
        await prisma.teamEscapeProgress.create({
          data: { escapeRoomId: escapeRoom.id, ...snapshotData },
        });
      }
    } else {
      // Last player — pause the shared record in place (stop the timer).
      if (progress.pausedAt) return NextResponse.json({ ok: true }); // already paused

      await prisma.teamEscapeProgress.update({
        where: { id: progress.id },
        data: {
          pausedAt: new Date(),
          pausedRemainingMs: remainingMs,
          soloUserId: userId,
          runExpiresAt: null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[escape-lobby] pause-run error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
