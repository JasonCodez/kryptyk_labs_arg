import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAllowedDisplayName } from '@/lib/display-name-validator';
import { validateSameOrigin } from "@/lib/requestSecurity";

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
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

    // Look up by the authenticated user's ID, never the request body, so a
    // caller can only ever rename themself.
    const currentUser = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { id: true, name: true, nameChanged: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hadDisplayName = typeof currentUser.name === "string" && currentUser.name.trim().length > 0;

    // A missing display name (new OAuth signups) must always be settable —
    // that first assignment is onboarding, not "the one later rename".
    if (hadDisplayName && currentUser.nameChanged) {
      return NextResponse.json({ error: "Display name may only be changed once" }, { status: 403 });
    }

    // Enforce display name rules: only letters and numbers, 3-16 chars
    // Validate using shared validator (includes banned words)
    const v = isAllowedDisplayName(trimmedName);
    if (!v.ok) return NextResponse.json({ error: v.reason || 'Invalid name' }, { status: 400 });

    // Check if another user already has this name (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        id: {
          not: userId,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: "This display name is already taken" }, { status: 409 });
    }

    let updatedUser: { id: string; name: string | null; nameChanged: boolean };
    try {
      updatedUser = await (prisma.user as any).update({
        where: { id: userId },
        data: { name: trimmedName, nameChanged: hadDisplayName },
        select: {
          id: true,
          name: true,
          nameChanged: true,
        },
      });
    } catch (updateError) {
      // Two concurrent requests can both pass the uniqueness check above and
      // then race on the unique column itself — surface that safely instead
      // of leaking the underlying database error.
      if (updateError instanceof Prisma.PrismaClientKnownRequestError && updateError.code === "P2002") {
        return NextResponse.json({ error: "This display name is already taken" }, { status: 409 });
      }
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating name:", error);
    return NextResponse.json(
      { error: "Failed to update name" },
      { status: 500 }
    );
  }
}
