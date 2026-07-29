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

  describe("logic_grid", () => {
    const CATEGORIES = [
      { id: "person", name: "Guests", entries: ["Maya", "Jordan", "Lena", "Theo"] },
      { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
      { id: "time", name: "Arrival Times", entries: ["8:00", "8:30", "9:00", "9:30"] },
      { id: "object", name: "Objects", entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"] },
    ];
    const SOLUTION = {
      Maya: { room: "Library", time: "8:00", object: "Silver Key" },
      Jordan: { room: "Vault", time: "8:30", object: "Red Journal" },
      Lena: { room: "Observatory", time: "9:00", object: "Brass Compass" },
      Theo: { room: "Gallery", time: "9:30", object: "Glass Eye" },
    };

    test("sanitizes a valid legacy (plain-string) clue puzzle and strips the solution", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        intro: "Four guests entered the Midnight Exhibition.",
        categories: CATEGORIES,
        clues: ["Maya did not enter the Vault."],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      expect(sanitized.solution).toBeUndefined();
      expect(sanitized.clues).toEqual([
        { id: "clue-1", text: "Maya did not enter the Vault.", type: "textOnly", operands: [] },
      ]);
      expect(Object.keys(sanitized).sort()).toEqual(["categories", "clues", "intro"]);
    });

    test("sanitizes a valid structured clue puzzle, stripping contaminated root and per-operand fields", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        intro: "Four guests entered the Midnight Exhibition.",
        categories: CATEGORIES,
        clues: [
          {
            id: "clue-a",
            text: "The Library visitor arrived at 8:00.",
            type: "same",
            operands: [
              { categoryId: "room", entry: "Library", authorNote: "leaked note" },
              { categoryId: "time", entry: "8:00", debugWeight: 42 },
            ],
            solverHint: "check the solution map",
            internalDifficulty: 9,
          },
        ],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      expect(sanitized.solution).toBeUndefined();
      const clues = sanitized.clues as Array<Record<string, unknown>>;
      expect(clues).toHaveLength(1);
      expect(Object.keys(clues[0]).sort()).toEqual(["id", "operands", "text", "type"]);
      const operands = clues[0].operands as Array<Record<string, unknown>>;
      for (const operand of operands) {
        expect(Object.keys(operand).sort()).toEqual(["categoryId", "entry"]);
      }
      expect(JSON.stringify(sanitized)).not.toContain("leaked note");
      expect(JSON.stringify(sanitized)).not.toContain("solverHint");
      expect(JSON.stringify(sanitized)).not.toContain("internalDifficulty");
    });

    test("sanitizes a mix of legacy and structured clues", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        intro: "Four guests entered the Midnight Exhibition.",
        categories: CATEGORIES,
        clues: [
          "Maya did not enter the Vault.",
          {
            text: "The Library visitor arrived at 8:00.",
            type: "same",
            operands: [
              { categoryId: "room", entry: "Library" },
              { categoryId: "time", entry: "8:00" },
            ],
          },
        ],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      const clues = sanitized.clues as Array<Record<string, unknown>>;
      expect(clues).toHaveLength(2);
      expect(clues[0].type).toBe("textOnly");
      expect(clues[1].type).toBe("same");
    });

    test("fails closed to an empty clues array (never echoes raw data) when a structured clue is malformed", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        intro: "Four guests entered the Midnight Exhibition.",
        categories: CATEGORIES,
        clues: [
          {
            text: "Broken clue.",
            type: "same",
            operands: [{ categoryId: "person", entry: "Maya", privateSolverNote: "leak" }],
          },
        ],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      expect(sanitized.clues).toEqual([]);
      expect(sanitized.solution).toBeUndefined();
      expect(JSON.stringify(sanitized)).not.toContain("privateSolverNote");
      expect(JSON.stringify(sanitized)).not.toContain("leak");
    });

    test("fails closed to an empty clues array when the categories are invalid", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        intro: "Broken puzzle.",
        categories: [{ id: "person", name: "Guests", entries: ["Maya"] }],
        clues: ["Maya did not enter the Vault."],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      expect(sanitized.clues).toEqual([]);
      expect(sanitized.solution).toBeUndefined();
    });

    test("always strips the solution regardless of validity", () => {
      const sanitized = sanitizePublicPuzzleData("logic_grid", {
        categories: [],
        clues: [],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      expect(sanitized.solution).toBeUndefined();
      expect(JSON.stringify(sanitized)).not.toContain("Silver Key");
    });

    test("a non-logic-grid puzzle type is left untouched by logic grid sanitization", () => {
      const sanitized = sanitizePublicPuzzleData("word_search", {
        categories: CATEGORIES,
        clues: ["Maya did not enter the Vault."],
        solution: SOLUTION,
      }) as Record<string, unknown>;

      // Falls through to the generic passthrough branch — solution is not a logic-grid-recognized
      // key for this type, so it is left alone (no logic_grid-specific stripping applies).
      expect(sanitized.solution).toEqual(SOLUTION);
      expect(sanitized.clues).toEqual(["Maya did not enter the Vault."]);
    });
  });
});
