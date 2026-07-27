import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface TeamMemberUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface TeamMemberRow {
  user: TeamMemberUser | null;
  [key: string]: unknown;
}

interface TeamQueryResult {
  members: TeamMemberRow[];
  [key: string]: unknown;
}

// Player-facing team responses must never include member email addresses.
// This rebuilds the nested user object explicitly (id/name/image only) so a
// stray `email` field on the Prisma result or a mocked query can never leak
// through, even if the select clause above it is ever changed incorrectly.
function serializeTeamForPlayers(team: TeamQueryResult) {
  return {
    ...team,
    members: team.members.map((member) => ({
      ...member,
      user: member.user
        ? {
            id: member.user.id,
            name: member.user.name,
            image: member.user.image,
          }
        : null,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await getServerSession(authOptions);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Public teams are viewable by everyone, and the response is always
    // email-free, so there is no need for a separate member/nonmember shape
    // or a requester-user lookup just to view the team.
    if (team.isPublic) {
      return NextResponse.json(serializeTeamForPlayers(team as unknown as TeamQueryResult));
    }

    // Private team: only allow members, resolved by internal user ID rather
    // than by comparing email addresses.
    const sessionUserId = (session?.user as { id?: unknown })?.id;
    let requesterUserId: string | null =
      typeof sessionUserId === "string" && sessionUserId.trim() !== ""
        ? sessionUserId
        : null;

    if (!requesterUserId) {
      const sessionEmail = session?.user?.email;
      if (typeof sessionEmail === "string" && sessionEmail.trim() !== "") {
        const requesterUser = await prisma.user.findUnique({
          where: { email: sessionEmail },
          select: { id: true },
        });
        requesterUserId = requesterUser?.id ?? null;
      }
    }

    if (!requesterUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isMember = team.members.some(
      (m: { userId: string }) => m.userId === requesterUserId
    );

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(serializeTeamForPlayers(team as unknown as TeamQueryResult));
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}
