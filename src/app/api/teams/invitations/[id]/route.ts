import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeamUpdate } from "@/lib/notification-service";
import { z } from "zod";

const ActionSchema = z.object({
  invitationId: z.string(),
  action: z.enum(["accept", "decline"]),
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
    const { invitationId, action } = ActionSchema.parse(body);

    // Get invitation
    const invitation = await prisma.teamInvite.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Verify invitation is for this user
    if (invitation.userId !== user.id) {
      return NextResponse.json(
        { error: "This invitation is not for you" },
        { status: 403 }
      );
    }

    // Verify invitation hasn't expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      // Check if already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: invitation.teamId, userId: user.id },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "You are already a member of this team" },
          { status: 400 }
        );
      }

      // Accept invitation and add user to team
      await prisma.teamInvite.update({
        where: { id: invitationId },
        data: { status: "accepted" },
      });

      await prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: user.id,
          role: "member",
        },
      });

      // Notify all team members that a new member joined
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: invitation.teamId },
        select: { userId: true },
      });

      const team = await prisma.team.findUnique({
        where: { id: invitation.teamId },
        select: { name: true },
      });

      if (team) {
        await notifyTeamUpdate(
          teamMembers.map(m => m.userId),
          {
            teamId: invitation.teamId,
            teamName: team.name,
            updateTitle: "New Team Member",
            updateMessage: `${user.name || user.email} has joined the team!`,
          }
        );
      }

      return NextResponse.json({
        message: "Invitation accepted",
        teamId: invitation.teamId,
      });
    } else if (action === "decline") {
      // Decline invitation
      await prisma.teamInvite.update({
        where: { id: invitationId },
        data: { status: "declined" },
      });

      return NextResponse.json({ message: "Invitation declined" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to process invitation:", error);
    return NextResponse.json(
      { error: "Failed to process invitation" },
      { status: 500 }
    );
  }
}
