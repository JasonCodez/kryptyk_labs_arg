import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  return user?.role === "admin" ? session : null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id: teamId } = await params;

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Require the admin to type the team's exact name — this permanently wipes the team's
    // chat log, progress, and puzzle completions with no undo, so a stronger confirmation
    // than a single click is warranted (mirrors the "type DELETE" pattern used for account
    // deletion, adapted here to confirm *which* team when working from a list of many).
    const body = await req.json().catch(() => ({}));
    const confirmName = typeof body?.confirmName === "string" ? body.confirmName : "";
    if (confirmName !== team.name) {
      return NextResponse.json({ error: "Team name confirmation did not match." }, { status: 400 });
    }

    // Most child models (members, invites, progress, puzzle completions/assignments/
    // submissions, escape progress) have onDelete:Cascade and are cleaned up automatically.
    // The remaining tables reference teamId without a real FK/cascade, so they're handled
    // manually: LobbyMessage (team chat) is deleted outright, while LeaderboardEntry /
    // GlobalLeaderboard rows are historical points records — those are kept, just detached
    // from the deleted team rather than erased.
    await prisma.$transaction(async (tx) => {
      await tx.lobbyMessage.deleteMany({ where: { teamId } });
      await tx.playerRoomState.deleteMany({ where: { teamId } });
      await tx.leaderboardEntry.updateMany({ where: { teamId }, data: { teamId: null } });
      await tx.globalLeaderboard.updateMany({ where: { teamId }, data: { teamId: null } });
      await tx.team.delete({ where: { id: teamId } });
    });

    return NextResponse.json({ success: true, id: teamId });
  } catch (error) {
    console.error("[ADMIN TEAM DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
