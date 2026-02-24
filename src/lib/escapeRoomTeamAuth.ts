import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export type EscapeRoomTeamContext = {
  teamId: string;
  userId: string;
  escapeRoomId: string;
};

async function getUserIdFromSessionEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

export async function requireEscapeRoomTeamContext(
  request: NextRequest,
  puzzleId: string,
  options?: { teamId?: string | null; requireStarted?: boolean; requireNotFinished?: boolean; allowUserFailed?: boolean }
): Promise<EscapeRoomTeamContext | NextResponse> {
  const requireStarted = options?.requireStarted ?? true;
  const requireNotFinished = options?.requireNotFinished ?? true;
  const allowUserFailed = options?.allowUserFailed ?? false;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await getUserIdFromSessionEmail(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const teamId = options?.teamId ?? request.nextUrl.searchParams.get("teamId");
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { teamId: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
  }

  const memberCount = await prisma.teamMember.count({ where: { teamId } });
  const puzzleForMin = await prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { minTeamSize: true } });
  const minRequired = (puzzleForMin?.minTeamSize ?? 0) > 0 ? puzzleForMin!.minTeamSize : 1;
  if (memberCount < minRequired) {
    return NextResponse.json(
      { error: `Escape room requires at least ${minRequired} team member(s) (team has ${memberCount})` },
      { status: 403 }
    );
  }

  const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
    where: { puzzleId },
    select: { id: true },
  });

  if (!escapeRoom) {
    return NextResponse.json({ error: "Escape room not found" }, { status: 404 });
  }

  // Per-user lockout: once a player fails an escape room, they cannot access it again.
  if (!allowUserFailed) {
    try {
      const userProgress = await prisma.userEscapeProgress.findUnique({
        where: { userId_escapeRoomId: { userId, escapeRoomId: escapeRoom.id } },
        select: { failedAt: true },
      });
      if (userProgress?.failedAt) {
        return NextResponse.json(
          { error: "You have already failed this escape room and no longer have access to it." },
          { status: 403 }
        );
      }
    } catch {
      // non-fatal
    }
  }

  if (requireStarted) {
    const progress = await (prisma as any).teamEscapeProgress.findUnique({
      where: { teamId_escapeRoomId: { teamId, escapeRoomId: escapeRoom.id } },
      select: { id: true, failedAt: true, completedAt: true },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "Escape room has not been started for this team. Start from the team lobby." },
        { status: 409 }
      );
    }

    if (requireNotFinished) {
      if (progress.completedAt) {
        return NextResponse.json(
          { error: "This escape room run is already complete." },
          { status: 409 }
        );
      }
      if (progress.failedAt) {
        return NextResponse.json(
          { error: "This escape room run has already failed and cannot be retried." },
          { status: 409 }
        );
      }
    }
  }

  return { teamId, userId, escapeRoomId: escapeRoom.id };
}
