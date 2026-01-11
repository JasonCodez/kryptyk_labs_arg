import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: teamId, memberId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify the requester is an admin or moderator of the team
    const requester = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: user.id } } });
    if (!requester || !["admin", "moderator"].includes(requester.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent kicking yourself via this endpoint
    const target = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (target.id === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // Remove the team member record
    const result = await prisma.teamMember.deleteMany({ where: { teamId, userId: memberId } });

    // After removal, ensure there's at least one admin. If none, promote the earliest-joined member.
    const adminCountAfter = await prisma.teamMember.count({ where: { teamId, role: 'admin' } });
    if (adminCountAfter === 0) {
      const earliest = await prisma.teamMember.findFirst({ where: { teamId }, orderBy: { joinedAt: 'asc' } });
      if (earliest) {
        await prisma.teamMember.update({ where: { teamId_userId: { teamId, userId: earliest.userId } }, data: { role: 'admin' } });
        try {
          await prisma.notification.create({
            data: {
              userId: earliest.userId,
              type: 'team_update',
              title: 'Promoted to Admin',
              message: 'You have been promoted to admin of the team.',
              relatedId: teamId,
            },
          });
        } catch (e) {
          console.warn('Failed to create promotion notification:', e);
        }
      }
    }

    // If no members remain, delete the team entirely
    const memberCount = await prisma.teamMember.count({ where: { teamId } });
    if (memberCount === 0) {
      try {
        await prisma.team.delete({ where: { id: teamId } });
        return NextResponse.json({ message: "Member removed and team deleted", count: result.count });
      } catch (e) {
        console.warn("Failed to delete empty team:", e);
        // Fallthrough to normal response
      }
    }

    return NextResponse.json({ message: "Member removed", count: result.count });
  } catch (error) {
    console.error("Failed to remove team member:", error);
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
  }
}
