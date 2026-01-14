import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user?.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check if the user is an admin of any team
    const adminMembership = await prisma.teamMember.findFirst({ where: { userId: user.id, role: 'admin' } });
    const isAdmin = !!adminMembership;

    let teamId = null;
    let teamName = null;
    if (adminMembership) {
      teamId = adminMembership.teamId;
      const team = await prisma.team.findUnique({ where: { id: adminMembership.teamId } });
      teamName = team?.name ?? null;
    }

    return NextResponse.json({ isAdmin, teamId, teamName });
  } catch (error) {
    console.error('Failed to check team admin:', error);
    return NextResponse.json({ error: 'Failed to check team admin' }, { status: 500 });
  }
}
