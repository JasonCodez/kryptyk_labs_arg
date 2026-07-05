import { NextRequest, NextResponse } from "next/server";
import { lookupDefinition } from "@/lib/dictionary";

export const runtime = "nodejs";

/**
 * GET /api/dictionary/define?word=example
 * Proxies the free dictionaryapi.dev lookup used by the word search puzzle's
 * "find a word, learn its definition" modal. Always resolves (never 4xx/5xx to the
 * client) — an unknown or unreachable word just comes back as { found: false } so the
 * UI can show a friendly fallback instead of an error.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("word") ?? "";
  const word = raw.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!word) {
    return NextResponse.json({ error: "Invalid word" }, { status: 400 });
  }

  const result = await lookupDefinition(word);
  return NextResponse.json(result ? { found: true, ...result } : { found: false });
}
