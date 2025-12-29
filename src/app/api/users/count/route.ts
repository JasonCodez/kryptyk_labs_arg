import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await prisma.user.count();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Failed to fetch user count:", error);
    return NextResponse.json(
      { error: "Failed to fetch user count" },
      { status: 500 }
    );
  }
}
