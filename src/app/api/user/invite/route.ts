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

    // Get all referrals for this user
    const referrals = await prisma.userReferral.findMany({
      where: { referrerId: user.id },
      select: {
        id: true,
        inviteCode: true,
        inviteEmail: true,
        refereeJoinedAt: true,
        refereeFirstPuzzleSolvedAt: true,
        createdAt: true,
        referee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Count successful referrals (where referee solved first puzzle)
    const successfulReferrals = referrals.filter(
      (r: { refereeFirstPuzzleSolvedAt?: string | Date | null }) => r.refereeFirstPuzzleSolvedAt !== null
    ).length;

    return NextResponse.json({
      referrals,
      successfulReferrals,
      totalInvites: referrals.length,
    });
  } catch (error) {
    console.error("Get referrals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    );
  }
}
