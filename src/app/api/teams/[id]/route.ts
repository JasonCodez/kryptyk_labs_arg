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

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // If the team is public, allow anyone (including unauthenticated) to view it.
    if (team.isPublic) {
      // For public views, strip member emails for privacy when requester isn't a member.
      if (!session?.user?.email || !team.members.some((m: any) => m.user?.email === session.user?.email)) {
        const redacted = {
          ...team,
          members: team.members.map((m: any) => ({
            ...m,
            user: {
              id: m.user?.id,
              name: m.user?.name,
              image: m.user?.image,
            },
          })),
        };
        return NextResponse.json(redacted);
      }
      return NextResponse.json(team);
    }

    // Private team: only allow members
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isMember = team.members.some(
      (m: { user: { email?: string | null } | null }) => m.user?.email === session.user?.email
    );

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}
