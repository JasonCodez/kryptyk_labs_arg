import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const invitingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!invitingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { teamId, userId } = body;

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: "teamId and userId are required" },
        { status: 400 }
      );
    }

    if (teamId === userId) {
      return NextResponse.json(
        { error: "Cannot invite yourself" },
        { status: 400 }
      );
    }

    // Check if team exists and user is a member
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Check if inviting user is a member of the team
    const isMember = team.members.some((m) => m.userId === invitingUser.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You must be a member of the team to invite others" },
        { status: 403 }
      );
    }

    // Check if team is full (max 4 members)
    if (team.members.length >= 4) {
      return NextResponse.json(
        { error: "Team is full (maximum 4 members)" },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const alreadyMember = team.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.teamInvite.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (existingInvite && existingInvite.status === "pending") {
      return NextResponse.json(
        { error: "Invitation already sent to this user" },
        { status: 400 }
      );
    }

    // Create invite
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        userId,
        invitedBy: invitingUser.id,
        expiresAt,
        status: "pending",
      },
    });

    return NextResponse.json({ success: true, invite }, { status: 201 });
  } catch (error) {
    console.error("Error creating team invite:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
