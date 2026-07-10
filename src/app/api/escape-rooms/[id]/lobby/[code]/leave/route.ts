import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

/**
 * Create a fresh solo-save snapshot row for a player who leaves while others are still playing.
 * The shared run continues uninterrupted; the departing player gets their own paused record
 * so they can resume solo at any time.
 */
async function createSoloSnapshot(lobbyId: string, soloUserId: string, puzzleId: string) {
  try {
    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return;

    const progress = await prisma.teamEscapeProgress.findFirst({
      where: { lobbyId, escapeRoomId: escapeRoom.id },
      select: {
        runStartedAt: true,
        runExpiresAt: true,
        completedAt: true,
        failedAt: true,
        currentStageIndex: true,
        solvedStages: true,
        inventory: true,
      },
    });

    if (!progress?.runStartedAt || progress.completedAt || progress.failedAt) return;

    const remainingMs = progress.runExpiresAt
      ? Math.max(0, new Date(progress.runExpiresAt).getTime() - Date.now())
      : null;

    // If they already have a paused save for this room, update it; otherwise create a new one.
    const existing = await prisma.teamEscapeProgress.findFirst({
      where: { soloUserId, escapeRoomId: escapeRoom.id, pausedAt: { not: null }, completedAt: null, failedAt: null },
      select: { id: true },
    });

    const snapshotData = {
      pausedAt: new Date(),
      pausedRemainingMs: remainingMs,
      soloUserId,
      runExpiresAt: null,
      runStartedAt: new Date(),
      currentStageIndex: progress.currentStageIndex,
      solvedStages: progress.solvedStages,
      inventory: progress.inventory,
    };

    if (existing) {
      await prisma.teamEscapeProgress.update({ where: { id: existing.id }, data: snapshotData });
    } else {
      await prisma.teamEscapeProgress.create({ data: { escapeRoomId: escapeRoom.id, ...snapshotData } });
    }
  } catch {
    // non-fatal
  }
}

/** Pause an active solo run when the last player departs. */
async function pauseActiveRun(lobbyId: string, soloUserId: string, puzzleId: string) {
  try {
    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return;

    const progress = await prisma.teamEscapeProgress.findFirst({
      where: { lobbyId, escapeRoomId: escapeRoom.id },
      select: { id: true, runStartedAt: true, runExpiresAt: true, completedAt: true, failedAt: true, pausedAt: true },
    });

    if (!progress?.runStartedAt || progress.completedAt || progress.failedAt || progress.pausedAt) return;

    const remainingMs = progress.runExpiresAt
      ? Math.max(0, new Date(progress.runExpiresAt).getTime() - Date.now())
      : null;

    await prisma.teamEscapeProgress.update({
      where: { id: progress.id },
      data: {
        pausedAt: new Date(),
        pausedRemainingMs: remainingMs,
        soloUserId,
        runExpiresAt: null, // stop the timer from expiring while away
      },
    });
  } catch {
    // non-fatal
  }
}

/** POST /api/escape-rooms/[id]/lobby/[code]/leave */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; code: string }> } | { params: { id: string; code: string } }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = params instanceof Promise ? await params : params;
    const { id: puzzleId, code } = resolved;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const lobby = await prisma.escapeRoomLobby.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        id: true,
        puzzleId: true,
        hostId: true,
        status: true,
        members: { select: { userId: true }, orderBy: { joinedAt: "asc" } },
      },
    });

    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    if (lobby.puzzleId !== puzzleId) return NextResponse.json({ error: "Wrong puzzle" }, { status: 400 });

    // Remove member
    await prisma.escapeRoomLobbyMember.deleteMany({
      where: { lobbyId: lobby.id, userId: user.id },
    });

    const remaining = lobby.members.filter((m: any) => m.userId !== user.id);

    if (remaining.length === 0) {
      // Last person left — pause any active run so they can resume later, then expire lobby.
      if (lobby.status === "started") {
        await pauseActiveRun(lobby.id, user.id, puzzleId);
      }
      await prisma.escapeRoomLobby.update({ where: { id: lobby.id }, data: { status: "expired" } });
    } else {
      // Others still playing — snapshot this player's stage progress so they can resume solo.
      if (lobby.status === "started") {
        await createSoloSnapshot(lobby.id, user.id, puzzleId);
      }
      if (lobby.hostId === user.id) {
        // Host left — transfer to next member
        await prisma.escapeRoomLobby.update({
          where: { id: lobby.id },
          data: { hostId: remaining[0].userId },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[escape-lobby] leave error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
