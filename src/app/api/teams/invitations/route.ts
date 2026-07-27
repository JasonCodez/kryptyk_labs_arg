import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { validateSameOrigin } from "@/lib/requestSecurity";

// GET user's pending invitations

interface InvitationQueryRow {
  id: string;
  teamId: string;
  status: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  team: {
    id: string;
    name: string;
    description: string | null;
    members: Array<{
      id: string;
      user: {
        id: string;
        name: string | null;
        image: string | null;
      } | null;
    }>;
  };
}

interface SafePendingInvitation {
  id: string;
  teamId: string;
  status: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  team: {
    id: string;
    name: string;
    description: string | null;
    members: Array<{
      id: string;
      user: {
        id: string;
        name: string | null;
        image: string | null;
      };
    }>;
  };
}

function hasSafeMemberUser(
  member: InvitationQueryRow["team"]["members"][number]
): member is InvitationQueryRow["team"]["members"][number] & {
  user: { id: string; name: string | null; image: string | null };
} {
  return (
    !!member &&
    typeof member.id === "string" &&
    !!member.user &&
    typeof member.user.id === "string"
  );
}

function serializePendingInvitation(
  invitation: InvitationQueryRow
): SafePendingInvitation {
  return {
    id: invitation.id,
    teamId: invitation.teamId,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    team: {
      id: invitation.team.id,
      name: invitation.team.name,
      description: invitation.team.description,
      members: invitation.team.members
        .filter(hasSafeMemberUser)
        .map((member) => ({
          id: member.id,
          user: {
            id: member.user.id,
            name: member.user.name,
            image: member.user.image,
          },
        })),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
    let requesterUserId =
      typeof sessionUserId === "string" && sessionUserId.trim()
        ? sessionUserId.trim()
        : null;

    const sessionEmail =
      typeof session?.user?.email === "string" ? session.user.email.trim() : "";

    if (!requesterUserId && !sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!requesterUserId) {
      const requester = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true },
      });

      if (!requester) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      requesterUserId = requester.id;
    }

    const invitations = await prisma.teamInvite.findMany({
      where: {
        userId: requesterUserId,
        status: "pending",
        // Applications are stored as teamInvite rows where invitedBy === userId.
        // Only show leader-sent invites in the invitations tray.
        NOT: { invitedBy: requesterUserId },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            members: {
              select: {
                id: true,
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
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      (invitations as unknown as InvitationQueryRow[]).map(
        serializePendingInvitation
      )
    );
  } catch (error) {
    console.error("Failed to fetch invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// POST - Send team invitations
const InviteSchema = z.object({
  teamId: z.string(),
  // Accept display names (unique per product assumption)
  userNames: z.array(z.string().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { teamId, userNames } = InviteSchema.parse(body);

    // Verify user is a team admin
    const teamMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (!teamMember || !["admin", "moderator"].includes(teamMember.role)) {
      return NextResponse.json(
        { error: "Only admins and moderators can invite users" },
        { status: 403 }
      );
    }

    // Get the team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Find or create users and send invitations
    const invitations = [];
    for (const name of userNames) {
      // Find user by display name. Using findFirst because `name` is not enforced unique in Prisma schema,
      // but the product assumes display names are unique.
      const invitedUser = await prisma.user.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      if (!invitedUser) {
        continue; // Skip non-existent users
      }

      // Check if user is already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: invitedUser.id } },
      });

      if (existingMember) {
        continue; // Skip if already a member
      }

      // Check if invitation already exists
      const existingInvite = await prisma.teamInvite.findUnique({
        where: { teamId_userId: { teamId, userId: invitedUser.id } },
      });

      if (existingInvite) {
        // Update existing invitation if it was declined
        if (existingInvite.status === "declined") {
          const updated = await prisma.teamInvite.update({
            where: { id: existingInvite.id },
            data: {
              status: "pending",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          invitations.push(updated);
        }
        continue;
      }

      // Create new invitation
      const invitation = await prisma.teamInvite.create({
        data: {
          teamId,
          userId: invitedUser.id,
          invitedBy: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: "pending",
        },
      });

      invitations.push(invitation);
    }

    return NextResponse.json(
      {
        message: "Invitations sent",
        count: invitations.length,
        invitations,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to send invitations:", error);
    return NextResponse.json(
      { error: "Failed to send invitations" },
      { status: 500 }
    );
  }
}
