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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { inviteEmail } = body;

    // Create referral record
    const referral = await prisma.userReferral.create({
      data: {
        referrerId: user.id,
        inviteEmail: inviteEmail || undefined,
      },
    });

    // Generate invite URL
    const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/signup?ref=${referral.inviteCode}`;

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        inviteCode: referral.inviteCode,
        inviteUrl,
        inviteEmail: referral.inviteEmail,
      },
    });
  } catch (error) {
    console.error("Generate invite error:", error);
    return NextResponse.json(
      { error: "Failed to generate invite" },
      { status: 500 }
    );
  }
}
