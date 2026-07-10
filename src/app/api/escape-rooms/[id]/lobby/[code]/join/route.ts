import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

/** POST /api/escape-rooms/[id]/lobby/[code]/join */
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
        maxPlayers: true,
        status: true,
        expiresAt: true,
        _count: { select: { members: true } },
      },
    });

    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    if (lobby.puzzleId !== puzzleId) return NextResponse.json({ error: "Lobby is not for this puzzle" }, { status: 400 });
    if (lobby.status !== "waiting") return NextResponse.json({ error: "This lobby has already started or expired" }, { status: 409 });
    if (new Date(lobby.expiresAt) < new Date()) {
      await prisma.escapeRoomLobby.update({ where: { id: lobby.id }, data: { status: "expired" } });
      return NextResponse.json({ error: "Lobby has expired" }, { status: 409 });
    }

    // Already a member?
    const existing = await prisma.escapeRoomLobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
      select: { id: true },
    });

    if (!existing) {
      if (lobby._count.members >= lobby.maxPlayers) {
        return NextResponse.json({ error: "Lobby is full" }, { status: 409 });
      }
      await prisma.escapeRoomLobbyMember.create({
        data: { lobbyId: lobby.id, userId: user.id },
      });
    }

    return NextResponse.json({ ok: true, lobbyId: lobby.id });
  } catch (e) {
    console.error("[escape-lobby] join error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
