import { sanitizePublicPuzzleData } from "./publicPuzzleData";

describe("sanitizePublicPuzzleData", () => {
  test("strips word_crack secret while preserving word length", () => {
    const sanitized = sanitizePublicPuzzleData("word_crack", {
      word: "apple",
      wordLength: 5,
      maxAttempts: 6,
    }) as Record<string, unknown>;

    expect(sanitized.word).toBeUndefined();
    expect(sanitized.wordLength).toBe(5);
    expect(sanitized.maxAttempts).toBe(6);
  });

  test("strips crossword clue answers from public payload", () => {
    const sanitized = sanitizePublicPuzzleData("crossword", {
      clues: {
        across: [
          { number: 1, row: 0, col: 0, answer: "ABC", text: "Across 1" },
          { number: 4, row: 1, col: 0, answer: "DEF", text: "Across 4" },
          { number: 5, row: 2, col: 0, answer: "GHI", text: "Across 5" },
        ],
        down: [
          { number: 1, row: 0, col: 0, answer: "ADG", text: "Down 1" },
          { number: 2, row: 0, col: 1, answer: "BEH", text: "Down 2" },
          { number: 3, row: 0, col: 2, answer: "CFI", text: "Down 3" },
        ],
      },
    }) as Record<string, unknown>;

    const clues = sanitized.clues as {
      across: Array<Record<string, unknown>>;
      down: Array<Record<string, unknown>>;
    };

    expect(clues.across[0].answer).toBeUndefined();
    expect(clues.down[0].answer).toBeUndefined();
    expect(clues.across[0].length).toBe(3);
    expect(clues.down[0].length).toBe(3);
    expect(sanitized.rows).toBe(3);
    expect(sanitized.cols).toBe(3);
    expect(sanitized.blackSquareRatio).toBe(0);
  });

  test("strips every Gridlock answer-bearing field from the general puzzle payload", () => {
    const sanitized = sanitizePublicPuzzleData("gridlock_file", { gridlockFile: {
      schemaVersion: 2,
      answerMode: "selection",
      fileNumber: 3,
      fileTitle: "Public Matrix",
      flavorText: "Trace the signal.",
      objective: "Select one record.",
      gridType: "logic",
      rows: 2,
      columns: 2,
      requiredSelections: 1,
      maximumAttempts: 3,
      grid: [[{ id: "alpha", label: "Alpha", value: "Alpha" }, { id: "beta", label: "Beta", value: "Beta" }], [{ id: "gamma", label: "Gamma", value: "Gamma" }, { id: "delta", label: "Delta", value: "Delta" }]],
      correctAnswers: ["alpha"],
      ruleExplanation: "Alpha is correct.",
      primaryRuleFamily: "constraint",
      primaryRuleAxis: "both",
      retentionUnlock: "secret lore",
      rewardSettings: { xp: 100 },
      rules: [{ id: "visible", type: "constraint", text: "Match the signal.", relatedCellIds: [], displayOrder: 0, initiallyVisible: true }],
    } }) as { gridlockFile: Record<string, unknown> };

    expect(sanitized.gridlockFile.correctAnswers).toBeUndefined();
    expect(sanitized.gridlockFile.ruleExplanation).toBeUndefined();
    expect(sanitized.gridlockFile.primaryRuleFamily).toBeUndefined();
    expect(sanitized.gridlockFile.retentionUnlock).toBeUndefined();
    expect(sanitized.gridlockFile.rewardSettings).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain("Alpha is correct");
  });
});
