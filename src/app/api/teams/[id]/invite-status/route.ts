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
      return NextResponse.json({ status: 'none' });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ status: 'none' });

    const invite = await prisma.teamInvite.findUnique({ where: { teamId_userId: { teamId, userId: user.id } }, select: { status: true } });

    return NextResponse.json({ status: invite?.status ?? 'none' });
  } catch (error) {
    console.error('Failed to fetch invite status', error);
    return NextResponse.json({ status: 'none' }, { status: 500 });
  }
}
