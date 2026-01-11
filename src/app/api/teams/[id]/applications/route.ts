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

    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify user is admin/mod for the team
    const member = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: user.id } } });
    if (!member || !["admin", "moderator"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const applications = await prisma.teamInvite.findMany({
      where: { teamId, status: "pending" },
      include: { user: { select: { id: true, name: true, image: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
