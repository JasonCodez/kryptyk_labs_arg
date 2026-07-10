import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/escape-rooms/[id]/lobby/transfer-host
 * Internal endpoint called by the socket server when the current lobby host
 * disconnects mid-game. Protected by x-socket-secret.
 * Body: { lobbyId: string, newHostId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SOCKET_SECRET;
    if (secret) {
      const provided = request.headers.get("x-socket-secret") ?? "";
      if (provided !== secret) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => null);
    const { lobbyId, newHostId } = body ?? {};

    if (!lobbyId || !newHostId) {
      return NextResponse.json({ error: "lobbyId and newHostId required" }, { status: 400 });
    }

    const lobby = await prisma.escapeRoomLobby.findUnique({
      where: { id: lobbyId },
      select: { id: true, hostId: true },
    });

    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

    // Only update if the host actually changed (idempotent).
    if (lobby.hostId !== newHostId) {
      await prisma.escapeRoomLobby.update({
        where: { id: lobbyId },
        data: { hostId: newHostId },
      });
    }

    return NextResponse.json({ ok: true, newHostId });
  } catch (e) {
    console.error("[escape-lobby] transfer-host error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
