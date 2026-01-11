import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeamUpdate } from "@/lib/notification-service";
import { z } from "zod";

const ActionSchema = z.object({ action: z.enum(["approve", "deny"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: teamId, inviteId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actingUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!actingUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify acting user is admin/mod for the team
    const member = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: actingUser.id } } });
    if (!member || !["admin", "moderator"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = ActionSchema.parse(body);

    const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.teamId !== teamId) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (invite.status !== "pending") return NextResponse.json({ error: "Application is not pending" }, { status: 400 });

    const applicant = await prisma.user.findUnique({ where: { id: invite.userId }, select: { id: true, name: true, email: true } });

    if (action === "approve") {
      // Check team size limit (max 4)
      const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: { select: { userId: true } } } });
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      if (team.members.length >= 4) return NextResponse.json({ error: "Team is full" }, { status: 400 });

      // Add member
      await prisma.teamMember.create({ data: { teamId, userId: invite.userId, role: "member" } });

      await prisma.teamInvite.update({ where: { id: inviteId }, data: { status: "accepted" } });

      // Notify applicant (best-effort). Do not fail the approve flow if notifications fail.
      if (applicant) {
        try {
          await notifyTeamUpdate([applicant.id], {
            teamId,
            teamName: team?.name || "",
            updateTitle: "Application Approved",
            updateMessage: `Your application to join the team has been approved.`,
          });
        } catch (notifyErr) {
          console.error("Failed to notify applicant of approval:", notifyErr);
        }
      }

      return NextResponse.json({ message: "Applicant approved" });
    }

    // deny
    await prisma.teamInvite.update({ where: { id: inviteId }, data: { status: "declined" } });

    if (applicant) {
      try {
        await notifyTeamUpdate([applicant.id], {
          teamId,
          teamName: (await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }))?.name || "",
          updateTitle: "Application Denied",
          updateMessage: `Your application to join the team was declined.`,
        });
      } catch (notifyErr) {
        console.error("Failed to notify applicant of denial:", notifyErr);
      }
    }

    return NextResponse.json({ message: "Applicant denied" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    console.error("Failed to process application action:", error);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
