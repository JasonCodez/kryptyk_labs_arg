import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** POST /api/escape-rooms/[id]/lobby — create a new lobby for this escape room puzzle. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, puzzleType: true },
    });
    if (!puzzle) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    if (puzzle.puzzleType !== "escape_room") {
      return NextResponse.json({ error: "Puzzle is not an escape room" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const maxPlayers = Math.min(4, Math.max(1, Number(body?.maxPlayers) || 4));

    // Generate a unique 6-char code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.escapeRoomLobby.findUnique({ where: { code } });
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minute lobby window

    const lobby = await prisma.escapeRoomLobby.create({
      data: {
        code,
        puzzleId,
        hostId: user.id,
        maxPlayers,
        status: "waiting",
        expiresAt,
        members: { create: { userId: user.id } },
      },
      select: { id: true, code: true, maxPlayers: true, status: true, expiresAt: true, hostId: true },
    });

    return NextResponse.json({ lobby });
  } catch (e) {
    console.error("[escape-lobby] create error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
