import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/escape-rooms/[id]/solo-save
 * Returns the current user's paused solo save for this escape room, if any.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return NextResponse.json({ save: null });

    const save = await prisma.teamEscapeProgress.findFirst({
      where: {
        soloUserId: user.id,
        escapeRoomId: escapeRoom.id,
        pausedAt: { not: null },
        completedAt: null,
        failedAt: null,
      },
      select: {
        id: true,
        pausedAt: true,
        pausedRemainingMs: true,
        currentStageIndex: true,
        solvedStages: true,
      },
      orderBy: { pausedAt: "desc" },
    });

    if (!save) return NextResponse.json({ save: null });

    return NextResponse.json({
      save: {
        pausedAt: save.pausedAt,
        pausedRemainingMs: save.pausedRemainingMs,
        currentStageIndex: save.currentStageIndex,
        solvedStages: save.solvedStages,
      },
    });
  } catch (e) {
    console.error("[solo-save] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/escape-rooms/[id]/solo-save
 * Discards the current user's paused solo save (abandon and start fresh).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { puzzleId },
      select: { id: true },
    });
    if (!escapeRoom) return NextResponse.json({ ok: true });

    // Mark as abandoned (failed) so it no longer blocks resume.
    await prisma.teamEscapeProgress.updateMany({
      where: {
        soloUserId: user.id,
        escapeRoomId: escapeRoom.id,
        pausedAt: { not: null },
        completedAt: null,
        failedAt: null,
      },
      data: {
        failedAt: new Date(),
        failedReason: "solo_abandoned",
        pausedAt: null,
        pausedRemainingMs: null,
        soloUserId: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[solo-save] delete error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
