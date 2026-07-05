import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { forumRulesAcceptedAt: new Date() },
      select: { forumRulesAcceptedAt: true },
    });

    return NextResponse.json({ forumRulesAccepted: !!user.forumRulesAcceptedAt });
  } catch (error) {
    console.error("Failed to record forum rules acceptance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
