import {
  findWordInGrid,
  generateWordSearchGrid,
  normalizeWordList,
  normalizePlayableWordSearch,
  snapWordSearchDirection,
  wordSearchCellsInLine,
  validateWordSearchPuzzleData,
  validateWordSelection,
} from "./wordSearchCore";

describe("wordSearchCore", () => {
  test("normalizeWordList uppercases, strips non-letters, and dedupes", () => {
    expect(normalizeWordList([" Chair ", "chair", "T-A_BLE", "X", ""]))
      .toEqual(["CHAIR", "TABLE"]);
  });

  test("validateWordSelection requires straight contiguous lines", () => {
    const grid = [
      ["C", "H", "A", "I", "R"],
      ["X", "X", "X", "X", "X"],
      ["X", "X", "X", "X", "X"],
      ["X", "X", "X", "X", "X"],
      ["X", "X", "X", "X", "X"],
    ];

    const valid = validateWordSelection("CHAIR", grid, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ]);
    expect(valid.valid).toBe(true);

    const invalid = validateWordSelection("CHAIR", grid, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ]);
    expect(invalid.valid).toBe(false);
  });

  test("generateWordSearchGrid places generated words into the grid", () => {
    const { grid, placedWords, unplacedWords } = generateWordSearchGrid(
      ["CHAIR", "TABLE", "LAMP"],
      10
    );

    expect(grid.length).toBe(10);
    expect(placedWords.length).toBe(3);
    expect(unplacedWords.length).toBe(0);

    for (const word of placedWords) {
      expect(findWordInGrid(word, grid)).not.toBeNull();
    }
  });

  test("easy difficulty uses beginner-friendly direction set", () => {
    const result = generateWordSearchGrid(
      ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO"],
      12,
      { difficulty: "easy" }
    );

    const allowed = new Set(["0,1", "1,0", "1,1"]);
    for (const placement of Object.values(result.stats.placements)) {
      expect(allowed.has(`${placement.dr},${placement.dc}`)).toBe(true);
    }
  });

  test("hard difficulty seeds decoys for stronger visual challenge", () => {
    const result = generateWordSearchGrid(
      ["MYSTERY", "ENIGMA", "CIPHER", "PUZZLE", "SECRET", "HIDDEN"],
      15,
      { difficulty: "hard", themedDecoys: true }
    );

    expect(result.stats.decoysPlaced).toBeGreaterThan(0);
  });

  test("validateWordSearchPuzzleData rejects words not present in grid", () => {
    const data = {
      grid: [
        ["C", "H", "A", "I", "R"],
        ["X", "X", "X", "X", "X"],
        ["X", "X", "X", "X", "X"],
        ["X", "X", "X", "X", "X"],
        ["X", "X", "X", "X", "X"],
      ],
      words: ["CHAIR", "TABLE"],
    };

    const result = validateWordSearchPuzzleData(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not present in grid");
  });

  test("play normalization excludes unplaceable words and keeps repeated letters", () => {
    const normalized = normalizePlayableWordSearch([["B", "O", "O", "K"], ["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "X", "X", "X"]], ["BOOK", "MISSING", "book"]);
    expect(normalized.words).toEqual(["BOOK"]);
    expect(normalized.placements.get("BOOK")).toHaveLength(4);
    expect(normalized.signature).toContain("BOOK");
  });

  test("selection geometry snaps to eight directions and creates contiguous cells", () => {
    expect(snapWordSearchDirection(4, 3)).toEqual({ dr: 1, dc: 1 });
    expect(wordSearchCellsInLine({ row: 4, col: 4 }, { row: 1, col: 1 })).toEqual([
      { row: 4, col: 4 }, { row: 3, col: 3 }, { row: 2, col: 2 }, { row: 1, col: 1 },
    ]);
  });
});
