import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeamUpdate } from "@/lib/notification-service";
import { z } from "zod";
import { validateSameOrigin } from "@/lib/requestSecurity";

const ActionSchema = z.object({
  invitationId: z.string(),
  action: z.enum(["accept", "decline"]),
});

function getJoiningPlayerDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return "A player";
  }

  const trimmed = value.trim();
  return trimmed || "A player";
}

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

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
    if (invitation.userId !== requesterUserId) {
      return NextResponse.json(
        { error: "This invitation is not for you" },
        { status: 403 }
      );
    }

    // Applications are represented by teamInvite rows where invitedBy === userId.
    // Those must be processed only by team admins/moderators via the applications endpoint.
    if (invitation.invitedBy === invitation.userId) {
      return NextResponse.json(
        { error: "This record is an application and must be reviewed by team leadership" },
        { status: 400 }
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
          teamId_userId: { teamId: invitation.teamId, userId: requesterUserId },
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
          userId: requesterUserId,
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
        const joiningPlayerDisplayName = getJoiningPlayerDisplayName(
          session?.user?.name
        );

        await notifyTeamUpdate(
          teamMembers.map((m: { userId: string }) => m.userId),
          {
            teamId: invitation.teamId,
            teamName: team.name,
            updateTitle: "New Team Member",
            updateMessage: `${joiningPlayerDisplayName} has joined the team!`,
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
