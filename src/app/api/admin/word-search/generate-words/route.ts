import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/requireAdmin";
import { pickRandomDictionaryWords } from "@/lib/dictionary";

const MIN_WORD_LENGTH = 3;

/**
 * GET /api/admin/word-search/generate-words?gridSize=12&count=8
 * Returns real dictionary words for the word search creator's "Generate Real Words"
 * button. gridSize caps word length so nothing generated can ever be too long to place
 * in the grid.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const gridSize = Number(req.nextUrl.searchParams.get("gridSize"));
  const count = Number(req.nextUrl.searchParams.get("count"));

  if (!Number.isInteger(gridSize) || gridSize < MIN_WORD_LENGTH) {
    return NextResponse.json({ error: "Invalid gridSize" }, { status: 400 });
  }
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return NextResponse.json({ error: "Invalid count" }, { status: 400 });
  }

  const words = pickRandomDictionaryWords(MIN_WORD_LENGTH, gridSize, count);
  return NextResponse.json({ words });
}
