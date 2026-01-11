import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeamUpdate } from "@/lib/notification-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { select: { userId: true, role: true } } },
    });

    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    if (!team.isPublic) {
      return NextResponse.json({ error: "Cannot apply to a private team" }, { status: 403 });
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "You are already a member of this team" }, { status: 400 });
    }

    // Check existing invite/application
    const existingInvite = await prisma.teamInvite.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
    });
    if (existingInvite && existingInvite.status === "pending") {
      return NextResponse.json({ error: "You already have a pending application or invitation" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.teamInvite.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: { status: "pending", expiresAt },
      create: {
        teamId: team.id,
        userId: user.id,
        invitedBy: user.id, // applicant
        status: "pending",
        expiresAt,
      },
    });

    // Notify admins/moderators of the team about the application
    const adminMembers = team.members.filter((m: any) => ["admin", "moderator"].includes(m.role));
    const adminIds = adminMembers.map((m: any) => m.userId);

    if (adminIds.length > 0) {
      await notifyTeamUpdate(adminIds, {
        teamId: team.id,
        teamName: team.name,
        updateTitle: "New Join Request",
        updateMessage: `${user.name || user.email} has applied to join the team.`,
      });
    }

    return NextResponse.json({ message: "Application submitted", invite }, { status: 201 });
  } catch (error) {
    console.error("Failed to apply to team:", error);
    return NextResponse.json({ error: "Failed to apply to team" }, { status: 500 });
  }
}
