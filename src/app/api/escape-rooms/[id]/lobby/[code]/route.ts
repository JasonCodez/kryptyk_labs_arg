import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** GET /api/escape-rooms/[id]/lobby/[code] — fetch lobby state. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; code: string }> } | { params: { id: string; code: string } }
) {
  try {
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
        code: true,
        puzzleId: true,
        hostId: true,
        maxPlayers: true,
        status: true,
        expiresAt: true,
        startedAt: true,
        members: {
          select: {
            userId: true,
            joinedAt: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    if (lobby.puzzleId !== puzzleId) return NextResponse.json({ error: "Lobby is not for this puzzle" }, { status: 400 });

    // Auto-expire check
    if (lobby.status === "waiting" && new Date(lobby.expiresAt) < new Date()) {
      await prisma.escapeRoomLobby.update({
        where: { id: lobby.id },
        data: { status: "expired" },
      });
      lobby.status = "expired";
    }

    return NextResponse.json({ lobby });
  } catch (e) {
    console.error("[escape-lobby] get error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
