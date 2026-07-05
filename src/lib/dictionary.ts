import fs from "fs";
import path from "path";
import crypto from "crypto";
import wordListPath from "word-list";
import { bannedWords } from "@/lib/display-name-validator";

let wordSet: Set<string> | null = null;

function loadWordSet(): Set<string> {
  if (!wordSet) {
    const raw = fs.readFileSync(wordListPath, "utf8");
    wordSet = new Set(raw.split("\n").map((w) => w.trim().toUpperCase()).filter(Boolean));
  }
  return wordSet;
}

export function isValidDictionaryWord(word: string): boolean {
  const normalized = word.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return false;
  return loadWordSet().has(normalized);
}

const banned = new Set(bannedWords.map((w) => w.toUpperCase()));

// The 10,000 most common English words (Google's Trillion Word Corpus) — excluded from
// word search generation so the puzzle actually teaches new vocabulary instead of
// surfacing words everyone already knows (e.g. "acid"). Only covers base/lemma forms, so
// a lightweight suffix strip catches most common inflections too (e.g. "brags" -> "brag")
// without pulling in a full stemmer.
//
// Vendored as a plain committed file rather than read from the most-common-words-by-language
// package: that package resolves its word-list files via readdirSync(`${__dirname}/resources`)
// at runtime, which breaks once Next.js's webpack bundling relocates the compiled module into
// a vendor chunk — __dirname then points at .next/.../vendor-chunks, where the sibling
// resources/ directory doesn't exist (confirmed via a real ENOENT in the dev server). Reading
// a single file via a path resolved from process.cwd() (same pattern as uploadStorage.ts)
// isn't subject to that relocation problem.
let commonWordSet: Set<string> | null = null;

function loadCommonWordSet(): Set<string> {
  if (!commonWordSet) {
    const filePath = path.join(process.cwd(), "src", "lib", "data", "common-words-en.txt");
    const raw = fs.readFileSync(filePath, "utf8");
    commonWordSet = new Set(raw.split("\n").map((w) => w.trim().toUpperCase()).filter(Boolean));
  }
  return commonWordSet;
}

function candidateStems(word: string): string[] {
  const stems = new Set([word]);
  if (word.endsWith("IES") && word.length > 5) stems.add(word.slice(0, -3) + "Y");
  if (word.endsWith("ES") && word.length > 4) stems.add(word.slice(0, -2));
  if (word.endsWith("S") && word.length > 4) stems.add(word.slice(0, -1));
  if (word.endsWith("ING") && word.length > 6) stems.add(word.slice(0, -3));
  if (word.endsWith("ED") && word.length > 5) stems.add(word.slice(0, -2));
  if (word.endsWith("ER") && word.length > 5) stems.add(word.slice(0, -2));
  if (word.endsWith("EST") && word.length > 6) stems.add(word.slice(0, -3));
  if (word.endsWith("LY") && word.length > 5) stems.add(word.slice(0, -2));
  return [...stems];
}

function isCommonWord(word: string): boolean {
  const common = loadCommonWordSet();
  return candidateStems(word).some((s) => common.has(s));
}

/**
 * Picks `count` distinct real words whose length falls in [minLength, maxLength] —
 * used by the word search puzzle creator's "Generate Real Words" button, where
 * maxLength is the grid size so no picked word can ever be too long to place. Excludes
 * words everyday-common enough that they wouldn't teach a player anything new (see
 * isCommonWord above) so the puzzle functions as a vocabulary-building tool.
 */
export function pickRandomDictionaryWords(minLength: number, maxLength: number, count: number): string[] {
  const candidates = [...loadWordSet()].filter(
    (w) => w.length >= minLength && w.length <= maxLength && !banned.has(w) && !isCommonWord(w)
  );

  const picked: string[] = [];
  const pool = candidates.slice();
  while (picked.length < count && pool.length > 0) {
    const idx = crypto.randomInt(0, pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

export interface DictionaryDefinition {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  partOfSpeech: string | null;
  definition: string;
  example: string | null;
}

// In-memory cache — definitions never change, so a 24h TTL just spares repeat calls to the
// free upstream API. Shared by the "does this word have a definition" check the word search
// generator uses and the player-facing definition modal, so a word verified at generation
// time is already warm in cache by the time a player finds it. Resets on deploy; that's fine.
const definitionCache = new Map<string, { data: DictionaryDefinition | null; expires: number }>();
const DEFINITION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FetchOutcome =
  | { ok: true; data: DictionaryDefinition }
  | { ok: false; notFound: boolean }; // notFound=false means a transient failure (rate limit, timeout, 5xx)

async function fetchDefinitionOnce(word: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  let res: Response;
  try {
    res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    });
  } catch {
    return { ok: false, notFound: false };
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 404) return { ok: false, notFound: true };
  if (!res.ok) return { ok: false, notFound: false }; // 429/5xx — transient, do not treat as "no definition"

  const json = await res.json().catch(() => null);
  const entry = Array.isArray(json) ? json[0] : null;
  const meaning = entry?.meanings?.[0];
  const definitionEntry = meaning?.definitions?.[0];
  if (!entry || !meaning || !definitionEntry?.definition) return { ok: false, notFound: true };

  const phoneticWithAudio = (entry.phonetics as Array<{ text?: string; audio?: string }> | undefined)?.find(
    (p) => p.audio
  );

  return {
    ok: true,
    data: {
      word: entry.word ?? word,
      phonetic: entry.phonetic ?? phoneticWithAudio?.text ?? null,
      audioUrl: phoneticWithAudio?.audio || null,
      partOfSpeech: meaning.partOfSpeech ?? null,
      definition: definitionEntry.definition,
      example: definitionEntry.example ?? null,
    },
  };
}

/**
 * Looks up a word's definition via the free dictionaryapi.dev service. Returns null for
 * unknown words, network errors, or timeouts — callers treat that as "no definition
 * available" rather than a hard failure.
 *
 * The free API rate-limits bursts of requests (confirmed: ~40 concurrent lookups trips a
 * 429) — a 429/5xx/timeout is NOT the same as a genuine 404 "word doesn't exist", so only
 * real 404s (or a malformed/empty entry) get cached as a negative result. Transient
 * failures get one short retry and are never cached, so a real word never gets
 * permanently mislabeled as "no definition" just because of a rate-limit blip.
 */
export async function lookupDefinition(word: string): Promise<DictionaryDefinition | null> {
  const normalized = word.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return null;

  const cached = definitionCache.get(normalized);
  if (cached && cached.expires > Date.now()) return cached.data;

  let result = await fetchDefinitionOnce(normalized);
  if (!result.ok && !result.notFound) {
    await new Promise((r) => setTimeout(r, 800));
    result = await fetchDefinitionOnce(normalized);
  }

  if (result.ok) {
    definitionCache.set(normalized, { data: result.data, expires: Date.now() + DEFINITION_CACHE_TTL_MS });
    return result.data;
  }
  if (result.notFound) {
    definitionCache.set(normalized, { data: null, expires: Date.now() + DEFINITION_CACHE_TTL_MS });
  }
  return null;
}
