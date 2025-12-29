import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET user's pending invitations
export async function GET(request: NextRequest) {
  try {
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

    const invitations = await prisma.teamInvite.findMany({
      where: {
        userId: user.id,
        status: "pending",
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
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
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
  userEmails: z.array(z.string().email()).min(1),
});

export async function POST(request: NextRequest) {
  try {
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
    const { teamId, userEmails } = InviteSchema.parse(body);

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
    for (const email of userEmails) {
      const invitedUser = await prisma.user.findUnique({
        where: { email },
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
