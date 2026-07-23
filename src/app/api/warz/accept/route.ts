import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { sanitizePublicPuzzleData } from "@/lib/publicPuzzleData";
import { Prisma } from "@prisma/client";

/**
 * POST /api/warz/accept
 *
 * Called when a player accepts an OPEN challenge (before playing).
 * Body: { challengeId }
 *
 * Flow:
 *  1. Verify challenge is OPEN and not expired
 *  2. Verify opponent eligibility on the puzzle
 *  3. Verify opponent has enough points
 *  4. Deduct opponent wager
 *  5. Set status → IN_PROGRESS, opponentId
 */
export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const body = await request.json();
    const { challengeId } = body as { challengeId: string };

    if (!challengeId) {
      return NextResponse.json({ error: "challengeId required" }, { status: 400 });
    }

    const challenge = await prisma.puzzleWarzChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }
    if (challenge.status !== "OPEN") {
      return NextResponse.json({ error: "Challenge is no longer open" }, { status: 409 });
    }
    if (challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: "This challenge has expired" }, { status: 409 });
    }
    if (challenge.challengerId === currentUser.id) {
      return NextResponse.json({ error: "You cannot accept your own challenge" }, { status: 400 });
    }
    // Enforce targeted invite
    if (challenge.invitedUserId && challenge.invitedUserId !== currentUser.id) {
      return NextResponse.json(
        { error: "This challenge is a private invite to another player" },
        { status: 403 }
      );
    }

    // Eligibility checks:
    // - no prior normal puzzle progress
    // - no prior Warz participation on this puzzle (as challenger or opponent)
    const [existingProgress, priorWarzParticipation] = await Promise.all([
      prisma.userPuzzleProgress.findUnique({
        where: { userId_puzzleId: { userId: currentUser.id, puzzleId: challenge.puzzleId } },
      }),
      prisma.puzzleWarzChallenge.findFirst({
        where: {
          puzzleId: challenge.puzzleId,
          OR: [
            { challengerId: currentUser.id },
            { opponentId: currentUser.id },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (existingProgress && (existingProgress.solved || existingProgress.attempts > 0)) {
      return NextResponse.json(
        { error: "You have already attempted this puzzle and cannot accept this challenge" },
        { status: 409 }
      );
    }

    if (priorWarzParticipation) {
      return NextResponse.json(
        { error: "You have already played this puzzle in Warz and cannot accept this challenge" },
        { status: 409 }
      );
    }

    // Points check
    const freshUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { totalPoints: true },
    });
    if (!freshUser || freshUser.totalPoints < challenge.challengerWager) {
      return NextResponse.json(
        { error: `You need at least ${challenge.challengerWager} points to accept this challenge` },
        { status: 400 }
      );
    }

    // Atomic: deduct wager + mark IN_PROGRESS
    const [, updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: currentUser.id },
        data: { totalPoints: { decrement: challenge.challengerWager } },
      }),
      prisma.puzzleWarzChallenge.update({
        where: { id: challengeId },
        data: {
          opponentId: currentUser.id,
          status: "IN_PROGRESS",
        },
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
        },
      }),
    ]);

    const safeUpdated = {
      ...updated,
      puzzle:
        updated.puzzle && updated.puzzle.data
          ? {
              ...updated.puzzle,
              data: sanitizePublicPuzzleData(
                updated.puzzle.puzzleType,
                updated.puzzle.data
              ) as Prisma.JsonValue,
            }
          : updated.puzzle,
    };

    // Notify challenger
    try {
      await prisma.notification.create({
        data: {
          userId: challenge.challengerId,
          type: "warz_accepted",
          title: "⚔️ Challenge Accepted!",
          message: `${currentUser.name ?? "Someone"} accepted your Warz challenge. The battle is on!`,
          icon: "⚔️",
          relatedId: challengeId,
        },
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ challenge: safeUpdated });
  } catch (err) {
    console.error("[WARZ ACCEPT]", err);
    return NextResponse.json({ error: "Failed to accept challenge" }, { status: 500 });
  }
}
