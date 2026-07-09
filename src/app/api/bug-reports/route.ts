import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/bug-reports — public submission endpoint. Works signed-out: bugs can show up
// before someone even creates an account, and those reports shouldn't be lost.
export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const body = await request.json();
    const description: string = String(body.description ?? "").trim().slice(0, 2000);
    const puzzleId: string | null = typeof body.puzzleId === "string" && body.puzzleId ? body.puzzleId : null;
    const otherLocation: string = String(body.otherLocation ?? "").trim().slice(0, 200);
    const contactEmail: string = String(body.contactEmail ?? "").trim().slice(0, 200);

    if (!description) {
      return NextResponse.json({ error: "Please describe what happened." }, { status: 400 });
    }
    if (!puzzleId && !otherLocation) {
      return NextResponse.json({ error: "Pick a puzzle or describe where you saw this." }, { status: 400 });
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    }

    // Auth is optional here — attach a userId when signed in, otherwise leave it null.
    const session = await getServerSession(authOptions);
    let userId: string | null = null;
    if (session?.user?.email) {
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = currentUser?.id ?? null;
    }

    // Look up the puzzle title server-side rather than trusting a client-supplied one.
    let puzzleTitle: string | null = null;
    let resolvedPuzzleId: string | null = null;
    if (puzzleId) {
      const puzzle = await prisma.puzzle.findUnique({
        where: { id: puzzleId },
        select: { id: true, title: true },
      });
      if (puzzle) {
        resolvedPuzzleId = puzzle.id;
        puzzleTitle = puzzle.title;
      }
    }

    await prisma.bugReport.create({
      data: {
        userId,
        puzzleId: resolvedPuzzleId,
        puzzleTitle,
        otherLocation: resolvedPuzzleId ? null : (otherLocation || null),
        description,
        contactEmail: contactEmail || null,
      },
    });

    return NextResponse.json({ submitted: true });
  } catch (error) {
    console.error("Failed to submit bug report:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
