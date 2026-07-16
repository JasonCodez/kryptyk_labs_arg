/** @jest-environment jsdom */

import { restoreWordSearchProgress, wordSearchStorageKey } from "./wordSearchPersistence";

const base = {
  storage: localStorage,
  puzzleId: "shared-puzzle",
  signature: "grid-signature",
  placeableWords: ["CAT", "DOG"],
};

beforeEach(() => localStorage.clear());

test("uses separate catalog and daily v3 keys and gives Warz no key", () => {
  expect(wordSearchStorageKey("catalog", "puzzle-1")).toBe("word-search:v3:catalog:puzzle-1");
  expect(wordSearchStorageKey("daily", "puzzle-1", 42)).toBe("word-search:v3:daily:42:puzzle-1");
  expect(wordSearchStorageKey("daily", "puzzle-1")).toBeNull();
  expect(wordSearchStorageKey("none", "puzzle-1")).toBeNull();
});

test("migrates a compatible v2 payload into catalog only", () => {
  localStorage.setItem("word-search:v2:shared-puzzle", JSON.stringify({
    version: 2,
    signature: "grid-signature",
    foundWords: ["cat", "UNSUPPORTED"],
    hintedWords: ["CAT", "DOG"],
  }));
  expect(restoreWordSearchProgress({ ...base, scope: "catalog" })).toEqual({ found: ["CAT"], hinted: ["CAT"] });
  expect(localStorage.getItem("word-search:v2:shared-puzzle")).toBeNull();
  expect(JSON.parse(localStorage.getItem("word-search:v3:catalog:shared-puzzle")!)).toMatchObject({ version: 3, foundWords: ["CAT"] });
});

test("daily and Warz never read legacy or catalog progress", () => {
  localStorage.setItem("word-search:v2:shared-puzzle", JSON.stringify({ version: 2, signature: "grid-signature", foundWords: ["CAT"] }));
  localStorage.setItem("word-search:v3:catalog:shared-puzzle", JSON.stringify({ version: 3, signature: "grid-signature", foundWords: ["DOG"] }));
  expect(restoreWordSearchProgress({ ...base, scope: "daily", dailyDayNumber: 7 })).toEqual({ found: [], hinted: [] });
  expect(restoreWordSearchProgress({ ...base, scope: "none" })).toEqual({ found: [], hinted: [] });
  expect(localStorage.getItem("word-search:v2:shared-puzzle")).not.toBeNull();
});

test("rejects malformed, stale-signature, and unsupported saved words", () => {
  const key = "word-search:v3:daily:7:shared-puzzle";
  localStorage.setItem(key, "not-json");
  expect(restoreWordSearchProgress({ ...base, scope: "daily", dailyDayNumber: 7 })).toEqual({ found: [], hinted: [] });
  localStorage.setItem(key, JSON.stringify({ version: 3, signature: "old", foundWords: ["CAT"] }));
  expect(restoreWordSearchProgress({ ...base, scope: "daily", dailyDayNumber: 7 })).toEqual({ found: [], hinted: [] });
  localStorage.setItem(key, JSON.stringify({ version: 3, signature: "grid-signature", foundWords: ["CAT", "BIRD"] }));
  expect(restoreWordSearchProgress({ ...base, scope: "daily", dailyDayNumber: 7 })).toEqual({ found: ["CAT"], hinted: [] });
});
