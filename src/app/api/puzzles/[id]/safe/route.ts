import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/attemptLimit";
import { getPuzzleAccessState } from "@/lib/puzzle-state/getPuzzleAccessState";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { id: puzzleId } = await context.params;
    const body = await request.json();
    const { guess } = body as { guess: string };

    if (!guess || typeof guess !== "string") {
      return NextResponse.json({ error: "No guess provided" }, { status: 400 });
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: { data: true, puzzleType: true },
    });

    if (!puzzle || puzzle.puzzleType !== "crack_safe") {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const safeData = (puzzle.data ?? {}) as Record<string, unknown>;
    const code = String(safeData.safecode ?? "");

    if (!code) {
      return NextResponse.json({ error: "No code configured for this puzzle" }, { status: 400 });
    }

    // Check 3-attempt limit (each full failed game = 1 attempt)
    const accessState = await getPuzzleAccessState(currentUser.id, puzzleId);
    if (accessState.isAttemptLocked) {
      return NextResponse.json(
        {
          locked: true,
          attemptsUsed: accessState.attemptsUsed,
          maxAttempts: MAX_PUZZLE_ATTEMPTS,
          revealCode: code,
        },
        { status: 403 }
      );
    }

    const cleanGuess = guess.replace(/\D/g, "");
    if (cleanGuess.length !== code.length) {
      return NextResponse.json(
        { error: `Guess must be ${code.length} digits` },
        { status: 400 }
      );
    }

    // ── Mastermind scoring ──────────────────────────────────────────────────
    const codeArr = code.split("");
    const guessArr = cleanGuess.split("");
    const usedCode: boolean[] = Array(code.length).fill(false);
    const usedGuess: boolean[] = Array(code.length).fill(false);
    // per-position hint: "green" = correct digit + position, "yellow" = present but wrong position, "gray" = not in code
    const hints: string[] = Array(code.length).fill("gray");

    let bulls = 0; // correct digit + correct position
    let cows = 0;  // correct digit + wrong position

    // Pass 1 – exact matches
    for (let i = 0; i < code.length; i++) {
      if (guessArr[i] === codeArr[i]) {
        bulls++;
        hints[i] = "green";
        usedCode[i] = true;
        usedGuess[i] = true;
      }
    }

    // Pass 2 – present but misplaced
    for (let i = 0; i < code.length; i++) {
      if (usedGuess[i]) continue;
      for (let j = 0; j < code.length; j++) {
        if (usedCode[j]) continue;
        if (guessArr[i] === codeArr[j]) {
          cows++;
          hints[i] = "yellow";
          usedCode[j] = true;
          break;
        }
      }
    }

    const correct = bulls === code.length;

    return NextResponse.json({ bulls, cows, correct, digits: code.length, hints });
  } catch (err) {
    console.error("[safe/guess] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
