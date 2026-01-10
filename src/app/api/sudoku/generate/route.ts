import { NextRequest, NextResponse } from "next/server";
import { generateSudoku } from "@/lib/sudoku-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const difficulty = body?.difficulty || "medium";

    // Generate on the server to avoid blocking the client UI
    const generated = generateSudoku(difficulty as any);

    return NextResponse.json({ success: true, puzzle: generated.puzzle, solution: generated.solution });
  } catch (error) {
    console.error("Sudoku generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
