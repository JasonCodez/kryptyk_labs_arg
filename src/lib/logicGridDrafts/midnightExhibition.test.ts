import { validateLogicGridPuzzleData, stripLogicGridSolution } from "@/lib/logicGridCore";
import { analyzeLogicGridUniqueness, evaluateLogicGridClueAgainstSolution } from "@/lib/logicGridSolver";
import {
  MIDNIGHT_EXHIBITION_TITLE,
  MIDNIGHT_EXHIBITION_MYSTERY_QUESTION,
  MIDNIGHT_EXHIBITION_EXPECTED_ANSWER,
  MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION,
  MIDNIGHT_EXHIBITION_DRAFT_DATA,
} from "./midnightExhibition";

const EXPECTED_TIME_ORDER = ["8:00", "8:30", "9:00", "9:30"];

const EXPECTED_CLUE_IDS = [
  "midnight-01-compass",
  "midnight-02-observatory-eye",
  "midnight-03-theo-object",
  "midnight-04-journal-before-lena",
  "midnight-05-gallery-after-eye",
  "midnight-06-gallery-before-vault",
  "midnight-07-library-after-maya",
];

const EXPECTED_CLUE_TYPES = [
  "same",
  "notSame",
  "eitherOr",
  "before",
  "after",
  "immediatelyBefore",
  "immediatelyAfter",
];

const ORDERED_TYPES = new Set(["before", "after", "immediatelyBefore", "immediatelyAfter"]);

describe("The Midnight Exhibition — metadata", () => {
  it("has the exact title, mystery question, and expected answer", () => {
    expect(MIDNIGHT_EXHIBITION_TITLE).toBe("The Midnight Exhibition");
    expect(MIDNIGHT_EXHIBITION_MYSTERY_QUESTION).toBe(
      "Who entered the Vault carrying the stolen Silver Key?"
    );
    expect(MIDNIGHT_EXHIBITION_EXPECTED_ANSWER).toBe("Lena");
  });

  it("has the exact intro copy, which never names the culprit or key carrier", () => {
    const intro = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { intro: string }).intro;
    expect(intro).toBe(
      "At 9:35 p.m., the curator of the Midnight Exhibition discovered that the Silver Key had vanished from its display. Four guests had entered four different rooms at different times, each carrying one unusual object. Determine who entered the Vault carrying the stolen Silver Key."
    );
    expect(intro).not.toContain("Lena");
    expect(intro.toLowerCase()).not.toContain("carried the silver key");
  });
});

describe("The Midnight Exhibition — category shape", () => {
  const categories = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { categories: Array<Record<string, unknown>> })
    .categories;

  it("has exactly four categories in the exact order", () => {
    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.id)).toEqual(["person", "room", "time", "object"]);
    expect(categories.map((c) => c.name)).toEqual(["Guests", "Rooms", "Arrival Times", "Objects"]);
  });

  it("has exactly four entries per category, in exact order", () => {
    expect(categories[0].entries).toEqual(["Maya", "Jordan", "Lena", "Theo"]);
    expect(categories[1].entries).toEqual(["Observatory", "Library", "Vault", "Gallery"]);
    expect(categories[2].entries).toEqual(EXPECTED_TIME_ORDER);
    expect(categories[3].entries).toEqual(["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"]);
    for (const category of categories) {
      expect((category.entries as unknown[]).length).toBe(4);
    }
  });

  it("uses person as the primary category and time as the ordered category, in the authored order", () => {
    expect(categories[0].id).toBe("person");
    expect(categories[2].id).toBe("time");
    expect(categories[2].entries).toEqual(EXPECTED_TIME_ORDER);
  });
});

describe("The Midnight Exhibition — clue shape", () => {
  const clues = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: Array<Record<string, unknown>> }).clues;

  it("has exactly seven clues in the exact order with unique, exact IDs", () => {
    expect(clues).toHaveLength(7);
    expect(clues.map((c) => c.id)).toEqual(EXPECTED_CLUE_IDS);
    expect(new Set(clues.map((c) => c.id)).size).toBe(7);
  });

  it("uses every evaluatable structured type exactly once, and no textOnly clue", () => {
    expect(clues.map((c) => c.type)).toEqual(EXPECTED_CLUE_TYPES);
    expect(clues.some((c) => c.type === "textOnly")).toBe(false);
    const uniqueTypes = new Set(clues.map((c) => c.type));
    expect(uniqueTypes.size).toBe(7);
  });

  it("only ordered clue types carry orderedCategoryId, and always 'time'", () => {
    for (const c of clues) {
      if (ORDERED_TYPES.has(c.type as string)) {
        expect(c.orderedCategoryId).toBe("time");
      } else {
        expect(c.orderedCategoryId).toBeUndefined();
      }
    }
  });

  it("clue 6 uses two different room operands (same category, different entries)", () => {
    const clue6 = clues[5] as { operands: Array<{ categoryId: string; entry: string }> };
    expect(clue6.operands).toHaveLength(2);
    expect(clue6.operands[0].categoryId).toBe("room");
    expect(clue6.operands[1].categoryId).toBe("room");
    expect(clue6.operands[0].entry).not.toBe(clue6.operands[1].entry);
    expect(clue6.operands[0].entry).toBe("Gallery");
    expect(clue6.operands[1].entry).toBe("Vault");
  });

  it("clue text matches the exact authored copy", () => {
    const expectedText = [
      "Maya carried the Brass Compass.",
      "The guest in the Observatory did not carry the Glass Eye.",
      "Theo carried either the Silver Key or the Red Journal.",
      "The guest carrying the Red Journal arrived before Lena.",
      "The guest in the Gallery arrived after the guest carrying the Glass Eye.",
      "The Gallery guest arrived immediately before the Vault guest.",
      "The Library guest arrived immediately after Maya.",
    ];
    expect(clues.map((c) => c.text)).toEqual(expectedText);
  });
});

describe("The Midnight Exhibition — core validation", () => {
  const result = validateLogicGridPuzzleData(MIDNIGHT_EXHIBITION_DRAFT_DATA, { requireSolution: true });

  it("validates successfully with a normalized result", () => {
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.normalized).toBeTruthy();
  });

  it("normalizes intro, categories, clues, and solution exactly", () => {
    const normalized = result.normalized!;
    expect(normalized.intro).toBe(
      (MIDNIGHT_EXHIBITION_DRAFT_DATA as { intro: string }).intro
    );
    expect(normalized.categories.map((c) => c.id)).toEqual(["person", "room", "time", "object"]);
    expect(normalized.clues).toHaveLength(7);
    expect(normalized.clues.map((c) => c.id)).toEqual(EXPECTED_CLUE_IDS);
    expect(normalized.solution).toEqual(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
  });

  it("public solution stripping removes the solution but keeps everything else", () => {
    const normalized = result.normalized!;
    const stripped = stripLogicGridSolution(normalized);

    expect((stripped as { solution?: unknown }).solution).toBeUndefined();
    expect(stripped.intro).toBe(normalized.intro);
    expect(stripped.categories).toEqual(normalized.categories);
    expect(stripped.clues).toHaveLength(7);
    expect(stripped.clues.map((c) => c.id)).toEqual(EXPECTED_CLUE_IDS);
    expect(stripped.clues.map((c) => c.text)).toEqual(normalized.clues.map((c) => c.text));
    expect(stripped.clues.map((c) => c.type)).toEqual(normalized.clues.map((c) => c.type));
    expect(stripped.clues.map((c) => c.operands)).toEqual(normalized.clues.map((c) => c.operands));
    for (const clue of stripped.clues) {
      if (ORDERED_TYPES.has(clue.type)) {
        expect(clue.orderedCategoryId).toBe("time");
      } else {
        expect(clue.orderedCategoryId).toBeUndefined();
      }
    }
  });
});

describe("The Midnight Exhibition — every clue is true against the intended solution", () => {
  const { normalized } = validateLogicGridPuzzleData(MIDNIGHT_EXHIBITION_DRAFT_DATA, {
    requireSolution: true,
  });
  const categories = normalized!.categories;
  const clues = normalized!.clues;

  it.each(EXPECTED_CLUE_IDS)("clue %s evaluates to exactly true", (clueId) => {
    const clue = clues.find((c) => c.id === clueId)!;
    const result = evaluateLogicGridClueAgainstSolution(
      categories,
      MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION,
      clue
    );
    expect(result).toBe(true);
  });

  it("exact semantic spot checks", () => {
    const byId = new Map(clues.map((c) => [c.id, c]));
    const sol = MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION;

    // Maya and Brass Compass resolve to the same primary row.
    expect(evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-01-compass")!)).toBe(
      true
    );

    // Observatory and Glass Eye resolve to different rows.
    expect(
      evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-02-observatory-eye")!)
    ).toBe(true);

    // Theo resolves to one of Silver Key or Red Journal.
    expect(evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-03-theo-object")!)).toBe(
      true
    );

    // Red Journal occurs before Lena along time.
    expect(
      evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-04-journal-before-lena")!)
    ).toBe(true);

    // Gallery occurs after Glass Eye along time.
    expect(
      evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-05-gallery-after-eye")!)
    ).toBe(true);

    // Gallery occurs immediately before Vault along time.
    expect(
      evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-06-gallery-before-vault")!)
    ).toBe(true);

    // Library occurs immediately after Maya along time.
    expect(
      evaluateLogicGridClueAgainstSolution(categories, sol, byId.get("midnight-07-library-after-maya")!)
    ).toBe(true);
  });
});

describe("The Midnight Exhibition — uniqueness proof", () => {
  it("has exactly one solution, matching the expected solution exactly", () => {
    const result = analyzeLogicGridUniqueness(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    expect(result.status).toBe("unique");
    expect(result.solutionsFound).toBe(1);
    expect(result.searchExhausted).toBe(true);
    expect(result.firstSolution).toBeTruthy();
    expect(result.secondSolution).toBeUndefined();
    expect(result.firstSolution).toEqual(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
  });

  it("is deterministic across repeated analysis", () => {
    const snapshot = JSON.parse(JSON.stringify(MIDNIGHT_EXHIBITION_DRAFT_DATA));
    const first = analyzeLogicGridUniqueness(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    const second = analyzeLogicGridUniqueness(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    const third = analyzeLogicGridUniqueness(MIDNIGHT_EXHIBITION_DRAFT_DATA);

    expect(first.status).toBe("unique");
    expect(second.status).toBe("unique");
    expect(third.status).toBe("unique");
    expect(first.firstSolution).toEqual(second.firstSolution);
    expect(second.firstSolution).toEqual(third.firstSolution);
    expect(first.secondSolution).toBeUndefined();
    expect(second.secondSolution).toBeUndefined();
    expect(MIDNIGHT_EXHIBITION_DRAFT_DATA).toEqual(snapshot);
  });

  it("produces the same result whether or not the authored solution is supplied", () => {
    const { solution: _omit, ...withoutSolution } = MIDNIGHT_EXHIBITION_DRAFT_DATA as Record<
      string,
      unknown
    >;
    const withSolutionResult = analyzeLogicGridUniqueness(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    const withoutSolutionResult = analyzeLogicGridUniqueness(withoutSolution);

    expect(withoutSolutionResult.status).toBe(withSolutionResult.status);
    expect(withoutSolutionResult.solutionsFound).toBe(withSolutionResult.solutionsFound);
    expect(withoutSolutionResult.searchExhausted).toBe(withSolutionResult.searchExhausted);
    expect(withoutSolutionResult.firstSolution).toEqual(withSolutionResult.firstSolution);
  });
});

describe("The Midnight Exhibition — every clue is necessary (one-clue removal audit)", () => {
  const allClues = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: Array<Record<string, unknown>> }).clues;

  it.each(EXPECTED_CLUE_IDS)("removing clue %s makes the case ambiguous", (clueId) => {
    const remainingClues = allClues.filter((c) => c.id !== clueId);
    expect(remainingClues).toHaveLength(6);

    const draftWithoutClue = {
      ...MIDNIGHT_EXHIBITION_DRAFT_DATA,
      clues: remainingClues,
    };

    const result = analyzeLogicGridUniqueness(draftWithoutClue);

    expect(result.status).toBe("ambiguous");
    expect(result.solutionsFound).toBe(2);
    expect(result.searchExhausted).toBe(false);
  });
});

describe("The Midnight Exhibition — mystery-answer derivation", () => {
  it("exactly one primary row has room=Vault and object=Silver Key, and it is Lena", () => {
    const sol = MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION;
    const matchingRows = Object.entries(sol).filter(
      ([, row]) => row.room === "Vault" && row.object === "Silver Key"
    );
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0][0]).toBe("Lena");
    expect(matchingRows[0][0]).toBe(MIDNIGHT_EXHIBITION_EXPECTED_ANSWER);
  });

  it("Lena's full row matches Vault / Silver Key / 9:30", () => {
    const lena = MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION.Lena;
    expect(lena.room).toBe("Vault");
    expect(lena.object).toBe("Silver Key");
    expect(lena.time).toBe("9:30");
  });

  it("does not contain a direct answer clue connecting Lena, Vault, or Silver Key", () => {
    const clues = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: Array<Record<string, unknown>> }).clues;
    const sameClues = clues.filter((c) => c.type === "same") as Array<{
      operands: Array<{ categoryId: string; entry: string }>;
    }>;

    const forbiddenPairs = [
      [
        { categoryId: "person", entry: "Lena" },
        { categoryId: "room", entry: "Vault" },
      ],
      [
        { categoryId: "person", entry: "Lena" },
        { categoryId: "object", entry: "Silver Key" },
      ],
      [
        { categoryId: "room", entry: "Vault" },
        { categoryId: "object", entry: "Silver Key" },
      ],
    ];

    for (const same of sameClues) {
      const ops = same.operands.map((o) => `${o.categoryId}::${o.entry}`).sort();
      for (const forbidden of forbiddenPairs) {
        const forbiddenKeys = forbidden.map((o) => `${o.categoryId}::${o.entry}`).sort();
        expect(ops).not.toEqual(forbiddenKeys);
      }
    }
  });

  it("does not state the answer directly in clue text", () => {
    const clueTexts = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: Array<{ text: string }> }).clues.map(
      (c) => c.text
    );
    for (const text of clueTexts) {
      expect(text).not.toBe("Lena entered the Vault.");
      expect(text).not.toBe("Lena carried the Silver Key.");
      expect(text).not.toBe("The Vault guest carried the Silver Key.");
    }
  });
});
