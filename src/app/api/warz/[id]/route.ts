import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { sanitizePublicPuzzleData } from "@/lib/publicPuzzleData";
import { Prisma } from "@prisma/client";

// GET /api/warz/[id] — single challenge details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id } = await params;

    const challenge = await prisma.puzzleWarzChallenge.findUnique({
      where: { id },
      include: {
        puzzle: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            puzzleType: true,
            data: true,
            sudoku: {
              select: {
                puzzleGrid: true,
                solutionGrid: true,
              },
            },
            jigsaw: {
              select: {
                imageUrl: true,
                gridRows: true,
                gridCols: true,
                snapTolerance: true,
                rotationEnabled: true,
              },
            },
          },
        },
        challenger: { select: { id: true, name: true, image: true, level: true } },
        opponent: { select: { id: true, name: true, image: true, level: true } },
        winner: { select: { id: true, name: true } },
        invitedUser: { select: { id: true, name: true } },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Don't leak the challenger's time until the challenge is completed
    const isCompleted = challenge.status === "COMPLETED";
    const safeChallenge = {
      ...challenge,
      challengerTime: isCompleted ? challenge.challengerTime : null,
    };

    if (safeChallenge.puzzle?.data) {
      safeChallenge.puzzle = {
        ...safeChallenge.puzzle,
        data: sanitizePublicPuzzleData(
          safeChallenge.puzzle.puzzleType,
          safeChallenge.puzzle.data
        ) as Prisma.JsonValue,
      };
    }

    return NextResponse.json({ challenge: safeChallenge });
  } catch (err) {
    console.error("[WARZ GET ID]", err);
    return NextResponse.json({ error: "Failed to fetch challenge" }, { status: 500 });
  }
}
