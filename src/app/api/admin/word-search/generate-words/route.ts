import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/requireAdmin";
import { pickRandomDictionaryWords, lookupDefinition } from "@/lib/dictionary";

// 5, not 3 — very short words skew heavily toward everyday-simple ("acid", "brag"),
// working against the "expand vocabulary" goal alongside the common-word filter below.
const MIN_WORD_LENGTH = 5;
const MAX_ROUNDS = 3;
const CANDIDATE_MULTIPLIER = 4;
const MAX_CANDIDATES_PER_ROUND = 20;
const LOOKUP_CONCURRENCY = 3;
// Hard time budget so a slow/degraded upstream dictionary API can't run this past a
// platform request timeout — we return whatever was found so far instead of hanging.
const TIME_BUDGET_MS = 15_000;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * GET /api/admin/word-search/generate-words?gridSize=12&count=8
 * Returns real dictionary words for the word search creator's "Generate Real Words"
 * button. gridSize caps word length so nothing generated can ever be too long to place
 * in the grid. Every returned word is also verified to have a real definition via the
 * same dictionaryapi.dev lookup the player-facing "word found" modal uses — the raw
 * word-list package used for spelling validity includes many obscure/archaic entries
 * (e.g. "SQUABBIEST", "KYDST") that pass as "real words" but have no definition, which
 * made the definition modal feel broken for players. Filtering here keeps the two
 * word sources in sync.
 */
export async function GET(req: NextRequest) {
  try {
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

    const found: string[] = [];
    const tried = new Set<string>();
    const deadline = Date.now() + TIME_BUDGET_MS;

    for (let round = 0; round < MAX_ROUNDS && found.length < count && Date.now() < deadline; round++) {
      const needed = count - found.length;
      const candidates = pickRandomDictionaryWords(
        MIN_WORD_LENGTH,
        gridSize,
        Math.min(needed * CANDIDATE_MULTIPLIER, MAX_CANDIDATES_PER_ROUND)
      ).filter((w) => !tried.has(w));
      if (candidates.length === 0) break;
      candidates.forEach((w) => tried.add(w));

      const definitions = await mapWithConcurrency(candidates, LOOKUP_CONCURRENCY, lookupDefinition);
      definitions.forEach((def, i) => {
        if (def && found.length < count) found.push(candidates[i]);
      });
    }

    return NextResponse.json({ words: found });
  } catch (err) {
    console.error("[GENERATE WORDS]", err);
    return NextResponse.json({ error: "Failed to generate words — please try again" }, { status: 500 });
  }
}
