import { normalizeWordList } from "@/lib/wordSearchCore";

export type WordSearchPersistenceScope = "catalog" | "daily" | "none";

type StoredWordSearchProgress = {
  version?: number;
  signature?: string;
  foundWords?: unknown;
  hintedWords?: unknown;
};

export function wordSearchStorageKey(
  scope: WordSearchPersistenceScope,
  puzzleId: string,
  dailyDayNumber?: number,
) {
  if (scope === "catalog") return `word-search:v3:catalog:${puzzleId}`;
  if (scope === "daily" && Number.isInteger(dailyDayNumber) && Number(dailyDayNumber) > 0) {
    return `word-search:v3:daily:${dailyDayNumber}:${puzzleId}`;
  }
  return null;
}

export function restoreWordSearchProgress({
  storage,
  scope,
  puzzleId,
  dailyDayNumber,
  signature,
  placeableWords,
  alreadySolved = false,
}: {
  storage: Storage | null;
  scope: WordSearchPersistenceScope;
  puzzleId: string;
  dailyDayNumber?: number;
  signature: string;
  placeableWords: string[];
  alreadySolved?: boolean;
}) {
  if (scope === "none") return { found: [] as string[], hinted: [] as string[] };
  if (alreadySolved) return { found: placeableWords, hinted: [] as string[] };
  const key = wordSearchStorageKey(scope, puzzleId, dailyDayNumber);
  if (!storage || !key) return { found: [] as string[], hinted: [] as string[] };

  const read = (candidateKey: string, version: number) => {
    try {
      const value = JSON.parse(storage.getItem(candidateKey) ?? "null") as StoredWordSearchProgress | null;
      if (value?.version !== version || value.signature !== signature || !Array.isArray(value.foundWords)) return null;
      const allowed = new Set(placeableWords);
      const found = normalizeWordList(value.foundWords).filter((word) => allowed.has(word));
      const foundSet = new Set(found);
      const hinted = Array.isArray(value.hintedWords)
        ? normalizeWordList(value.hintedWords).filter((word) => foundSet.has(word))
        : [];
      return { found, hinted };
    } catch {
      return null;
    }
  };

  const current = read(key, 3);
  if (current) return current;

  // v2 predated mode scoping. It represented catalog progress and must never
  // seed a daily puzzle or a synchronous Warz round.
  if (scope !== "catalog") return { found: [] as string[], hinted: [] as string[] };
  const legacyKey = `word-search:v2:${puzzleId}`;
  const legacy = read(legacyKey, 2);
  if (!legacy) return { found: [] as string[], hinted: [] as string[] };
  try {
    storage.setItem(key, JSON.stringify({ version: 3, signature, foundWords: legacy.found, hintedWords: legacy.hinted }));
    storage.removeItem(legacyKey);
  } catch {
    // The validated legacy state remains usable for this render even when the
    // browser refuses the migration write.
  }
  return legacy;
}
