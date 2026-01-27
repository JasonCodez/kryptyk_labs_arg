import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Use the real NextAuth server session; remove dev-header shortcut.
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt to select `nameChanged` if the schema supports it; fall back
    // to selecting without it so local environments without the migration
    // do not break with a 500.
    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true, image: true, nameChanged: true },
      });
    } catch (e) {
      // Fallback to older schema without `nameChanged`
      try {
        user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, role: true, image: true },
        });
      } catch (ee) {
        throw ee;
      }
    }

    if (!user) {
      // Create a lightweight user record; try including `nameChanged` first,
      // fall back if the column doesn't exist.
      try {
        const created = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || undefined,
            image: session.user.image || undefined,
            role: 'PLAYER',
          },
          select: { id: true, role: true, image: true, nameChanged: true },
        });
        return NextResponse.json({ id: created.id, role: created.role, image: created.image, nameChanged: created.nameChanged ?? false });
      } catch (e) {
        const created = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || undefined,
            image: session.user.image || undefined,
            role: 'PLAYER',
          },
          select: { id: true, role: true, image: true },
        });
        return NextResponse.json({ id: created.id, role: created.role, image: created.image, nameChanged: false });
      }
    }

    return NextResponse.json({ id: user.id, role: user.role, image: user.image, nameChanged: user.nameChanged ?? false });
  } catch (error) {
    console.error("Error fetching user info:", error);
    return NextResponse.json(
      { error: "Failed to fetch user info" },
      { status: 500 }
    );
  }
}
