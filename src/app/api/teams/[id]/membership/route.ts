import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ role: null });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ role: null });

    const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: user.id } }, select: { role: true } });

    return NextResponse.json({ role: membership?.role ?? null });
  } catch (error) {
    console.error("Failed to fetch membership:", error);
    return NextResponse.json({ role: null }, { status: 500 });
  }
}

// DELETE - allow the current user to leave the team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const membership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: user.id } } });
    if (!membership) return NextResponse.json({ error: "Not a member of this team" }, { status: 404 });

    // Delete the membership (allow leaving even if last admin; we'll promote someone if needed)
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: user.id } } });

    // After deletion, ensure there's at least one admin. If none, promote the earliest-joined member.
    const adminCountAfter = await prisma.teamMember.count({ where: { teamId, role: 'admin' } });
    if (adminCountAfter === 0) {
      // Find the earliest member (by joinedAt)
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
        return NextResponse.json({ message: "Left team and team deleted" });
      } catch (e) {
        console.warn("Failed to delete empty team:", e);
        // Fallthrough to normal response
      }
    }

    return NextResponse.json({ message: "Left team" });
  } catch (error) {
    console.error("Failed to leave team:", error);
    return NextResponse.json({ error: "Failed to leave team" }, { status: 500 });
  }
}
