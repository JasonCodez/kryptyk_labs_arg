import fs from "fs";
import wordListPath from "word-list";

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
