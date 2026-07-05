import fs from "fs";
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

/**
 * Picks `count` distinct real words whose length falls in [minLength, maxLength] —
 * used by the word search puzzle creator's "Generate Real Words" button, where
 * maxLength is the grid size so no picked word can ever be too long to place.
 */
export function pickRandomDictionaryWords(minLength: number, maxLength: number, count: number): string[] {
  const candidates = [...loadWordSet()].filter(
    (w) => w.length >= minLength && w.length <= maxLength && !banned.has(w)
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
