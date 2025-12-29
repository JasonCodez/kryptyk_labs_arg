import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get all teams the user is a member of (either as creator or member)
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTeams = teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team._count.members,
    }));

    return NextResponse.json({ teams: formattedTeams });
  } catch (error) {
    console.error("Error fetching user teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}
