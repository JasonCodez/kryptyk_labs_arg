import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }

    if (trimmedName.length > 50) {
      return NextResponse.json({ error: "Name must be 50 characters or less" }, { status: 400 });
    }

    // Check if another user already has this name (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        email: {
          not: session.user.email,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: "This display name is already taken" }, { status: 409 });
    }

    // Update user name
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { name: trimmedName },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({ 
      success: true,
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating name:", error);
    return NextResponse.json(
      { error: "Failed to update name" },
      { status: 500 }
    );
  }
}
