import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface ApplicationUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface ApplicationQueryRow {
  user: ApplicationUser | null;
  [key: string]: unknown;
}

// Player-facing application data must never include applicant email
// addresses. This rebuilds the nested user object explicitly (id/name/image
// only) so a stray `email` field on the Prisma result or a mocked query can
// never leak through, even if the select clause above it is ever changed
// incorrectly.
function serializeApplicationForManagers(application: ApplicationQueryRow) {
  return {
    ...application,
    user: application.user
      ? {
          id: application.user.id,
          name: application.user.name,
          image: application.user.image,
        }
      : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await getServerSession(authOptions);

    const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
    let requesterUserId: string | null =
      typeof sessionUserId === "string" && sessionUserId.trim()
        ? sessionUserId.trim()
        : null;

    if (!requesterUserId) {
      const sessionEmail =
        typeof session?.user?.email === "string" ? session.user.email.trim() : "";

      if (!sessionEmail) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requester = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });

      if (!requester) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      requesterUserId = requester.id;
    }

    // Verify user is admin/mod for the team
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: requesterUserId } },
    });
    if (!member || !["admin", "moderator"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Exclude pending invites for users who are already members of the team
    const members = await prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } });
    const memberIds = members.map((m) => m.userId);

    const pendingRows = await prisma.teamInvite.findMany({
      where: {
        teamId,
        status: "pending",
        NOT: memberIds.length > 0 ? { userId: { in: memberIds } } : undefined,
      },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });

    // An application is a self-submitted row: invitedBy === userId.
    const applications = pendingRows.filter((row) => row.invitedBy === row.userId);

    return NextResponse.json(
      applications.map((application) =>
        serializeApplicationForManagers(application as unknown as ApplicationQueryRow)
      )
    );
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
