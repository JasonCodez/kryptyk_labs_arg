import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

/** POST /api/escape-rooms/[id]/lobby/[code]/start — host starts the run. */
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
        expiresAt: true,
        members: { select: { userId: true } },
      },
    });

    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    if (lobby.puzzleId !== puzzleId) return NextResponse.json({ error: "Wrong puzzle" }, { status: 400 });
    if (lobby.hostId !== user.id) return NextResponse.json({ error: "Only the host can start the run" }, { status: 403 });
    if (lobby.status !== "waiting") return NextResponse.json({ error: "Lobby is not in waiting state" }, { status: 409 });
    if (new Date(lobby.expiresAt) < new Date()) {
      await prisma.escapeRoomLobby.update({ where: { id: lobby.id }, data: { status: "expired" } });
      return NextResponse.json({ error: "Lobby has expired" }, { status: 409 });
    }

    // Look up escapeRoom for this puzzleId
    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return NextResponse.json({ error: "Escape room not found" }, { status: 404 });

    // Check if the starting user has a paused solo save for this escape room.
    // If so, re-link it to this new lobby and restore the timer instead of creating fresh progress.
    const pausedSave = await prisma.teamEscapeProgress.findFirst({
      where: {
        soloUserId: user.id,
        escapeRoomId: escapeRoom.id,
        pausedAt: { not: null },
        completedAt: null,
        failedAt: null,
      },
      select: { id: true, pausedRemainingMs: true, lobbyId: true },
      orderBy: { pausedAt: "desc" },
    });

    if (pausedSave) {
      // Expire the old lobby this save was linked to (best-effort).
      if (pausedSave.lobbyId && pausedSave.lobbyId !== lobby.id) {
        await prisma.escapeRoomLobby.updateMany({
          where: { id: pausedSave.lobbyId, status: { not: "expired" } },
          data: { status: "expired" },
        });
      }
      // Restore the run: link to new lobby, rebuild expiry from remaining time.
      const now = new Date();
      const restoredExpiry = typeof pausedSave.pausedRemainingMs === 'number'
        ? new Date(now.getTime() + pausedSave.pausedRemainingMs)
        : null;
      await prisma.teamEscapeProgress.update({
        where: { id: pausedSave.id },
        data: {
          lobbyId: lobby.id,
          runExpiresAt: restoredExpiry,
          pausedAt: null,
          pausedRemainingMs: null,
          soloUserId: null,
        },
      });
    } else {
      // Prevent double-start
      const existingProgress = await prisma.teamEscapeProgress.findFirst({
        where: { lobbyId: lobby.id, escapeRoomId: escapeRoom.id },
        select: { id: true },
      });
      if (!existingProgress) {
        await prisma.teamEscapeProgress.create({
          data: { lobbyId: lobby.id, escapeRoomId: escapeRoom.id },
        });
      }
    }

    const now = new Date();
    await prisma.escapeRoomLobby.update({
      where: { id: lobby.id },
      data: { status: "started", startedAt: now },
    });

    return NextResponse.json({ ok: true, lobbyId: lobby.id });
  } catch (e) {
    console.error("[escape-lobby] start error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
