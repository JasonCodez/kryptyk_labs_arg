import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// POST /api/puzzles/[id]/hints/update-effectiveness - Called when puzzle is solved
const UpdateEffectivenessSchema = z.object({
  hintIds: z.array(z.string()), // IDs of hints that helped lead to solve
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { hintIds } = UpdateEffectivenessSchema.parse(body);

    // Get current time
    const now = new Date();

    // Update each hint usage record to mark it as leading to solve
    for (const hintId of hintIds) {
      // Get all recent hint usages for this hint by this user (within last 30 minutes)
      const recentUsages = await prisma.hintHistory.findMany({
        where: {
          hintId,
          userId: user.id,
          revealedAt: {
            gte: new Date(now.getTime() - 30 * 60 * 1000), // Last 30 minutes
          },
          solvedAt: null, // Not yet marked as solved
        },
        orderBy: { revealedAt: "desc" },
        take: 1, // Get the most recent one
      });

      if (recentUsages.length > 0) {
        const usage = recentUsages[0];
        const timeToSolve = Math.round(
          (now.getTime() - usage.revealedAt.getTime()) / 1000
        ); // In seconds

        await prisma.hintHistory.update({
          where: { id: usage.id },
          data: {
            solvedAt: now,
            timeToSolve,
            leadToSolve: true,
          },
        });

        // Update hint's effectiveness stats
        const hint = await prisma.puzzleHint.findUnique({
          where: { id: hintId },
        });

        if (hint) {
          const newTimesLeadToSolve = hint.timesLeadToSolve + 1;
          const oldAverage = hint.averageTimeToSolve || 0;
          const newAverage =
            (oldAverage * (newTimesLeadToSolve - 1) + timeToSolve) /
            newTimesLeadToSolve;

          await prisma.puzzleHint.update({
            where: { id: hintId },
            data: {
              timesLeadToSolve: newTimesLeadToSolve,
              averageTimeToSolve: newAverage,
            },
          });
        }
      }
    }

    return NextResponse.json(
      { message: "Hint effectiveness updated" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to update hint effectiveness:", error);
    return NextResponse.json(
      { error: "Failed to update hint effectiveness" },
      { status: 500 }
    );
  }
}
