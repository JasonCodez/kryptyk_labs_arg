import {
  analyzeLogicGridUniqueness,
  evaluateLogicGridClueAgainstSolution,
  type LogicGridUniquenessResult,
} from "./logicGridSolver";
import type {
  LogicGridCategoryNormalized,
  LogicGridClueNormalized,
  LogicGridSolution,
} from "./logicGridCore";

const CATEGORIES: LogicGridCategoryNormalized[] = [
  { id: "person", name: "Guests", entries: ["Maya", "Jordan", "Lena", "Theo"] },
  { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
  { id: "time", name: "Arrival Times", entries: ["8:00", "8:30", "9:00", "9:30"] },
  { id: "object", name: "Objects", entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"] },
];

const EXPECTED_SOLUTION: LogicGridSolution = {
  Maya: { room: "Observatory", time: "8:00", object: "Brass Compass" },
  Jordan: { room: "Library", time: "8:30", object: "Silver Key" },
  Lena: { room: "Vault", time: "9:00", object: "Red Journal" },
  Theo: { room: "Gallery", time: "9:30", object: "Glass Eye" },
};

function op(categoryId: string, entry: string) {
  return { categoryId, entry };
}

function clue(
  id: string,
  type: LogicGridClueNormalized["type"],
  operands: { categoryId: string; entry: string }[],
  orderedCategoryId?: string
): LogicGridClueNormalized {
  const base: LogicGridClueNormalized = { id, text: id, type, operands };
  if (orderedCategoryId) base.orderedCategoryId = orderedCategoryId;
  return base;
}

function baseData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    intro: "Four guests entered the Midnight Exhibition.",
    categories: CATEGORIES,
    clues: [],
    ...overrides,
  };
}

// The 12 direct `same` clues that uniquely pin EXPECTED_SOLUTION — one per (primary row, other
// category) pair.
const DIRECT_UNIQUE_CLUES = [
  clue("c1", "same", [op("person", "Maya"), op("room", "Observatory")]),
  clue("c2", "same", [op("person", "Maya"), op("time", "8:00")]),
  clue("c3", "same", [op("person", "Maya"), op("object", "Brass Compass")]),
  clue("c4", "same", [op("person", "Jordan"), op("room", "Library")]),
  clue("c5", "same", [op("person", "Jordan"), op("time", "8:30")]),
  clue("c6", "same", [op("person", "Jordan"), op("object", "Silver Key")]),
  clue("c7", "same", [op("person", "Lena"), op("room", "Vault")]),
  clue("c8", "same", [op("person", "Lena"), op("time", "9:00")]),
  clue("c9", "same", [op("person", "Lena"), op("object", "Red Journal")]),
  clue("c10", "same", [op("person", "Theo"), op("room", "Gallery")]),
  clue("c11", "same", [op("person", "Theo"), op("time", "9:30")]),
  clue("c12", "same", [op("person", "Theo"), op("object", "Glass Eye")]),
];

describe("evaluateLogicGridClueAgainstSolution — candidate-solution validation", () => {
  const validClue = clue("c1", "same", [op("room", "Observatory"), op("time", "8:00")]);

  it("accepts a complete bijective candidate", () => {
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, validClue)).toBe(true);
  });

  it("returns null for a missing primary row", () => {
    const { Theo: _omit, ...broken } = EXPECTED_SOLUTION;
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, broken, validClue)).toBeNull();
  });

  it("returns null for a non-object row", () => {
    const broken = { ...EXPECTED_SOLUTION, Maya: "not an object" };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, broken as unknown as LogicGridSolution, validClue)).toBeNull();
  });

  it("returns null for a missing category assignment", () => {
    const { room: _omit, ...rest } = EXPECTED_SOLUTION.Maya;
    const broken = { ...EXPECTED_SOLUTION, Maya: rest };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, broken as unknown as LogicGridSolution, validClue)).toBeNull();
  });

  it("returns null for an unknown assigned entry", () => {
    const broken = { ...EXPECTED_SOLUTION, Maya: { ...EXPECTED_SOLUTION.Maya, room: "Not A Room" } };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, broken, validClue)).toBeNull();
  });

  it("returns null for a duplicate category assignment across two primary rows", () => {
    const broken = { ...EXPECTED_SOLUTION, Jordan: { ...EXPECTED_SOLUTION.Jordan, room: "Observatory" } };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, broken, validClue)).toBeNull();
  });

  it("returns null for non-array categories", () => {
    expect(
      evaluateLogicGridClueAgainstSolution(
        {} as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClue
      )
    ).toBeNull();
  });

  it("returns null for a null clue", () => {
    expect(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, null as unknown as LogicGridClueNormalized)
    ).toBeNull();
  });

  it("does not mutate categories or the candidate solution", () => {
    const categoriesSnapshot = JSON.parse(JSON.stringify(CATEGORIES));
    const solutionSnapshot = JSON.parse(JSON.stringify(EXPECTED_SOLUTION));
    evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, validClue);
    expect(CATEGORIES).toEqual(categoriesSnapshot);
    expect(EXPECTED_SOLUTION).toEqual(solutionSnapshot);
  });

  it("never throws for malformed runtime values cast to the expected types", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      42,
      "string",
      [],
      {},
      { type: "same", operands: null },
      { type: "eitherOr", operands: [op("person", "Maya")] },
      { type: "immediatelyBefore", operands: [], orderedCategoryId: 123 },
    ];
    for (const value of malformed) {
      expect(() =>
        evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, value as unknown as LogicGridClueNormalized)
      ).not.toThrow();
    }
  });
});

describe("evaluateLogicGridClueAgainstSolution — textOnly", () => {
  it("always returns null and never inspects clue text", () => {
    const c: LogicGridClueNormalized = {
      id: "t1",
      text: "Jordan arrived immediately before the guest carrying the Red Journal.",
      type: "textOnly",
      operands: [],
    };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });
});

describe("evaluateLogicGridClueAgainstSolution — same", () => {
  it("returns true for Library same 8:30", () => {
    const c = clue("s1", "same", [op("room", "Library"), op("time", "8:30")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("returns false for Library same 9:00", () => {
    const c = clue("s2", "same", [op("room", "Library"), op("time", "9:00")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("reversed operands produce the same result", () => {
    const forward = clue("s3", "same", [op("room", "Library"), op("time", "8:30")]);
    const reversed = clue("s3", "same", [op("time", "8:30"), op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, forward)).toBe(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, reversed)
    );
  });

  it("returns null for one operand", () => {
    const c = clue("s4", "same", [op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for three operands", () => {
    const c = clue("s5", "same", [op("room", "Library"), op("time", "8:30"), op("object", "Silver Key")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for same-category operands", () => {
    const c = clue("s6", "same", [op("room", "Library"), op("room", "Vault")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for an unknown entry", () => {
    const c = clue("s7", "same", [op("room", "Not A Room"), op("time", "8:30")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });
});

describe("evaluateLogicGridClueAgainstSolution — notSame", () => {
  it("Maya notSame Vault returns true", () => {
    const c = clue("n1", "notSame", [op("person", "Maya"), op("room", "Vault")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("Lena notSame Vault returns false", () => {
    const c = clue("n2", "notSame", [op("person", "Lena"), op("room", "Vault")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("reversed operands behave identically", () => {
    const forward = clue("n3", "notSame", [op("person", "Lena"), op("room", "Vault")]);
    const reversed = clue("n3", "notSame", [op("room", "Vault"), op("person", "Lena")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, forward)).toBe(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, reversed)
    );
  });

  it("returns null for an invalid operand count", () => {
    const c = clue("n4", "notSame", [op("person", "Maya")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for same-category operands", () => {
    const c = clue("n5", "notSame", [op("person", "Maya"), op("person", "Jordan")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });
});

describe("evaluateLogicGridClueAgainstSolution — eitherOr", () => {
  it("Maya with Observatory or Library returns true", () => {
    const c = clue("e1", "eitherOr", [op("person", "Maya"), op("room", "Observatory"), op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("Maya with Vault or Gallery returns false", () => {
    const c = clue("e2", "eitherOr", [op("person", "Maya"), op("room", "Vault"), op("room", "Gallery")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("Jordan with Observatory or Library returns true", () => {
    const c = clue("e3", "eitherOr", [op("person", "Jordan"), op("room", "Observatory"), op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("returns null for duplicate alternatives", () => {
    const c = clue("e4", "eitherOr", [op("person", "Maya"), op("room", "Observatory"), op("room", "Observatory")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for alternatives from different categories", () => {
    const c = clue("e5", "eitherOr", [op("person", "Maya"), op("room", "Observatory"), op("time", "8:00")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null when the subject is in the alternatives' category", () => {
    const c = clue("e6", "eitherOr", [op("person", "Maya"), op("person", "Jordan"), op("person", "Lena")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });

  it("returns null for an incorrect operand count", () => {
    const c = clue("e7", "eitherOr", [op("person", "Maya"), op("room", "Observatory")]);
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
  });
});

describe("evaluateLogicGridClueAgainstSolution — ordered types", () => {
  it("before: Maya before Red Journal along time -> true", () => {
    const c = clue("o1", "before", [op("person", "Maya"), op("object", "Red Journal")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("before: Lena before Silver Key along time -> false", () => {
    const c = clue("o2", "before", [op("person", "Lena"), op("object", "Silver Key")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("after: Red Journal after Jordan along time -> true", () => {
    const c = clue("o3", "after", [op("object", "Red Journal"), op("person", "Jordan")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("after: Maya after Silver Key along time -> false", () => {
    const c = clue("o4", "after", [op("person", "Maya"), op("object", "Silver Key")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("immediatelyBefore: Jordan immediatelyBefore Red Journal along time -> true", () => {
    const c = clue("o5", "immediatelyBefore", [op("person", "Jordan"), op("object", "Red Journal")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("immediatelyBefore: Maya immediatelyBefore Red Journal along time -> false", () => {
    const c = clue("o6", "immediatelyBefore", [op("person", "Maya"), op("object", "Red Journal")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  it("immediatelyAfter: Red Journal immediatelyAfter Jordan along time -> true", () => {
    const c = clue("o7", "immediatelyAfter", [op("object", "Red Journal"), op("person", "Jordan")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });

  it("immediatelyAfter: Theo immediatelyAfter Jordan along time -> false", () => {
    const c = clue("o8", "immediatelyAfter", [op("person", "Theo"), op("person", "Jordan")], "time");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(false);
  });

  for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
    describe(type, () => {
      it("supports cross-category operands", () => {
        const c = clue(`${type}-cross`, type, [op("person", "Maya"), op("object", "Silver Key")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).not.toBeNull();
      });

      it("supports same-category, different-entry operands", () => {
        const c = clue(`${type}-same`, type, [op("person", "Maya"), op("person", "Jordan")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).not.toBeNull();
      });

      it("returns null for exact duplicate operands", () => {
        const c = clue(`${type}-dup`, type, [op("person", "Maya"), op("person", "Maya")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("returns null for a missing ordered category", () => {
        const c: LogicGridClueNormalized = {
          id: `${type}-missing`,
          text: type,
          type,
          operands: [op("person", "Maya"), op("person", "Jordan")],
        };
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("returns null for an unknown ordered category", () => {
        const c = clue(`${type}-unknown`, type, [op("person", "Maya"), op("person", "Jordan")], "nope");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("returns null when the ordered category matches operand 1", () => {
        const c = clue(`${type}-op1`, type, [op("time", "8:00"), op("object", "Silver Key")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("returns null when the ordered category matches operand 2", () => {
        const c = clue(`${type}-op2`, type, [op("object", "Silver Key"), op("time", "8:00")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("returns null for an unknown operand entry", () => {
        const c = clue(`${type}-badentry`, type, [op("person", "Nobody"), op("person", "Jordan")], "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });
    });
  }

  it("primary ordered category: Observatory before Red Journal along Guests -> true (no row.person needed)", () => {
    const c = clue("primary-order", "before", [op("room", "Observatory"), op("object", "Red Journal")], "person");
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBe(true);
  });
});

describe("analyzeLogicGridUniqueness — invalid input", () => {
  it("null puzzle data", () => {
    const result = analyzeLogicGridUniqueness(null);
    expect(result.status).toBe("invalid");
    expect(result.solutionsFound).toBe(0);
    expect(result.searchExhausted).toBe(false);
    expect(result.error).toBe("Logic grid puzzleData is missing.");
  });

  it("missing categories", () => {
    const { categories: _omit, ...rest } = baseData();
    const result = analyzeLogicGridUniqueness(rest);
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid requires puzzleData.categories.");
  });

  it("invalid category data", () => {
    const result = analyzeLogicGridUniqueness(baseData({ categories: [null, null, null] }));
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid category 1: invalid category.");
  });

  it("missing clues", () => {
    const { clues: _omit, ...rest } = baseData();
    const result = analyzeLogicGridUniqueness(rest);
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid requires puzzleData.clues.");
  });

  it("malformed structured clue", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({ clues: [{ text: "x", type: "same", operands: [op("person", "Maya")] }] })
    );
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid clue 1: same clues require exactly 2 operands.");
  });

  it("duplicate clue id", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        clues: [
          { id: "dup", text: "x", type: "textOnly", operands: [] },
          { id: "dup", text: "y", type: "textOnly", operands: [] },
        ],
      })
    );
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid clue 2: id duplicates an earlier clue id.");
  });

  it("unknown operand entry", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        clues: [{ text: "x", type: "same", operands: [op("room", "Not A Room"), op("time", "8:00")] }],
      })
    );
    expect(result.status).toBe("invalid");
    expect(result.error).toBe("Logic grid clue 1: operand references an unknown entry.");
  });
});

describe("analyzeLogicGridUniqueness — unsupported size", () => {
  it("3 categories x 4 entries", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({ categories: CATEGORIES.slice(0, 3), clues: ["placeholder"] })
    );
    expect(result.status).toBe("unsupported");
    expect(result.solutionsFound).toBe(0);
    expect(result.searchExhausted).toBe(false);
    expect(result.firstSolution).toBeUndefined();
    expect(result.secondSolution).toBeUndefined();
  });

  it("5 categories x 4 entries", () => {
    const fifth = { id: "extra", name: "Extra", entries: ["A", "B", "C", "D"] };
    const result = analyzeLogicGridUniqueness(
      baseData({ categories: [...CATEGORIES, fifth], clues: ["placeholder"] })
    );
    expect(result.status).toBe("unsupported");
  });

  it("4 categories x 3 entries", () => {
    const shrunk = CATEGORIES.map((c) => ({ ...c, entries: c.entries.slice(0, 3) }));
    const result = analyzeLogicGridUniqueness(baseData({ categories: shrunk, clues: ["placeholder"] }));
    expect(result.status).toBe("unsupported");
  });

  it("4 categories x 5 entries", () => {
    const grown = CATEGORIES.map((c, i) => ({ ...c, entries: [...c.entries, `Extra${i}`] }));
    const result = analyzeLogicGridUniqueness(baseData({ categories: grown, clues: ["placeholder"] }));
    expect(result.status).toBe("unsupported");
  });
});

describe("analyzeLogicGridUniqueness — unsupported textOnly clues", () => {
  it("a single legacy clue is unsupported with its generated id", () => {
    const result = analyzeLogicGridUniqueness(baseData({ clues: ["Maya did not enter the Vault."] }));
    expect(result.status).toBe("unsupported");
    expect(result.solutionsFound).toBe(0);
    expect(result.searchExhausted).toBe(false);
    expect(result.unsupportedClueIds).toEqual(["clue-1"]);
    expect(result.error).toBe("Logic grid uniqueness analysis requires every clue to use structured metadata.");
  });

  it("a mixed structured + legacy fixture reports every textOnly id in source order, without leaking clue text", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        clues: [
          "First legacy clue.",
          { id: "structured-1", text: "structured", type: "same", operands: [op("room", "Library"), op("time", "8:30")] },
          "Second legacy clue mentioning a secret phrase.",
        ],
      })
    );
    expect(result.status).toBe("unsupported");
    expect(result.unsupportedClueIds).toEqual(["clue-1", "clue-3"]);
    expect(result.error).not.toContain("secret phrase");
    expect(JSON.stringify(result)).not.toContain("secret phrase");
  });
});

describe("analyzeLogicGridUniqueness — contradictory", () => {
  it("Maya same Vault AND Maya notSame Vault has no solution", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        clues: [
          clue("a", "same", [op("person", "Maya"), op("room", "Vault")]),
          clue("b", "notSame", [op("person", "Maya"), op("room", "Vault")]),
        ],
      })
    );
    expect(result.status).toBe("contradictory");
    expect(result.solutionsFound).toBe(0);
    expect(result.searchExhausted).toBe(true);
    expect(result.firstSolution).toBeUndefined();
    expect(result.secondSolution).toBeUndefined();
  });
});

describe("analyzeLogicGridUniqueness — ambiguous", () => {
  it("a single weak clue leaves multiple valid solutions", () => {
    const data = baseData({ clues: [clue("weak", "notSame", [op("person", "Maya"), op("room", "Vault")])] });
    const result = analyzeLogicGridUniqueness(data);
    expect(result.status).toBe("ambiguous");
    expect(result.solutionsFound).toBe(2);
    expect(result.searchExhausted).toBe(false);
    expect(result.firstSolution).toBeTruthy();
    expect(result.secondSolution).toBeTruthy();
    expect(result.firstSolution).not.toEqual(result.secondSolution);

    for (const solution of [result.firstSolution!, result.secondSolution!]) {
      for (const c of data.clues as LogicGridClueNormalized[]) {
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, solution, c)).toBe(true);
      }
      // Complete bijection: every primary row present, every other-category value used exactly once.
      expect(Object.keys(solution).sort()).toEqual(CATEGORIES[0].entries.slice().sort());
      for (const other of CATEGORIES.slice(1)) {
        const assigned = CATEGORIES[0].entries.map((e) => solution[e][other.id]);
        expect(new Set(assigned).size).toBe(other.entries.length);
      }
    }

    const again = analyzeLogicGridUniqueness(data);
    expect(again.firstSolution).toEqual(result.firstSolution);
    expect(again.secondSolution).toEqual(result.secondSolution);
  });
});

describe("analyzeLogicGridUniqueness — unique (direct clue fixture)", () => {
  it("12 direct same clues uniquely force EXPECTED_SOLUTION", () => {
    const result = analyzeLogicGridUniqueness(baseData({ clues: DIRECT_UNIQUE_CLUES }));
    expect(result.status).toBe("unique");
    expect(result.solutionsFound).toBe(1);
    expect(result.searchExhausted).toBe(true);
    expect(result.firstSolution).toEqual(EXPECTED_SOLUTION);
    expect(result.secondSolution).toBeUndefined();
  });
});

describe("analyzeLogicGridUniqueness — unique (mixed clue-type fixture)", () => {
  it("remains unique after adding redundant clues covering every supported type", () => {
    const redundant = [
      clue("r-notsame", "notSame", [op("person", "Maya"), op("room", "Vault")]),
      clue("r-either", "eitherOr", [op("person", "Maya"), op("room", "Observatory"), op("room", "Library")]),
      clue("r-before", "before", [op("person", "Maya"), op("person", "Theo")], "time"),
      clue("r-after", "after", [op("person", "Theo"), op("person", "Maya")], "time"),
      clue("r-immbefore", "immediatelyBefore", [op("person", "Maya"), op("person", "Jordan")], "time"),
      clue("r-immafter", "immediatelyAfter", [op("person", "Jordan"), op("person", "Maya")], "time"),
    ];
    const result = analyzeLogicGridUniqueness(baseData({ clues: [...DIRECT_UNIQUE_CLUES, ...redundant] }));
    expect(result.status).toBe("unique");
    expect(result.solutionsFound).toBe(1);
    expect(result.searchExhausted).toBe(true);
    expect(result.firstSolution).toEqual(EXPECTED_SOLUTION);
  });
});

describe("analyzeLogicGridUniqueness — authored-solution independence", () => {
  const withoutSolution = baseData({ clues: DIRECT_UNIQUE_CLUES });
  const withCorrectSolution = baseData({ clues: DIRECT_UNIQUE_CLUES, solution: EXPECTED_SOLUTION });
  const withIncorrectSolution = baseData({
    clues: DIRECT_UNIQUE_CLUES,
    solution: { ...EXPECTED_SOLUTION, Maya: { room: "Vault", time: "9:30", object: "Glass Eye" } },
  });
  const withContaminatedSolution = baseData({
    clues: DIRECT_UNIQUE_CLUES,
    solution: { ...EXPECTED_SOLUTION, privateNote: "do not leak this" },
  });

  it("all four forms produce identical results", () => {
    const results = [withoutSolution, withCorrectSolution, withIncorrectSolution, withContaminatedSolution].map(
      (data) => analyzeLogicGridUniqueness(data)
    );
    for (const result of results) {
      expect(result.status).toBe("unique");
      expect(result.solutionsFound).toBe(1);
      expect(result.searchExhausted).toBe(true);
      expect(result.firstSolution).toEqual(EXPECTED_SOLUTION);
    }
  });

  it("does not mutate any of the four input objects", () => {
    const snapshots = [withoutSolution, withCorrectSolution, withIncorrectSolution, withContaminatedSolution].map(
      (data) => JSON.parse(JSON.stringify(data))
    );
    [withoutSolution, withCorrectSolution, withIncorrectSolution, withContaminatedSolution].forEach(
      (data, i) => {
        analyzeLogicGridUniqueness(data);
        expect(data).toEqual(snapshots[i]);
      }
    );
  });
});

describe("analyzeLogicGridUniqueness — natural-language independence", () => {
  it("changing only clue text does not change the result", () => {
    const withOriginalText = baseData({ clues: DIRECT_UNIQUE_CLUES });
    const withDifferentText = baseData({
      clues: DIRECT_UNIQUE_CLUES.map((c) => ({ ...c, text: `Rewritten: ${c.text} — totally different wording.` })),
    });
    const resultA = analyzeLogicGridUniqueness(withOriginalText);
    const resultB = analyzeLogicGridUniqueness(withDifferentText);
    expect(resultA.status).toBe(resultB.status);
    expect(resultA.firstSolution).toEqual(resultB.firstSolution);
  });
});

describe("analyzeLogicGridUniqueness — determinism", () => {
  it("unique witness remains identical across repeated runs", () => {
    const data = baseData({ clues: DIRECT_UNIQUE_CLUES });
    const categoriesSnapshot = JSON.parse(JSON.stringify(CATEGORIES));
    const first = analyzeLogicGridUniqueness(data);
    const second = analyzeLogicGridUniqueness(data);
    const third = analyzeLogicGridUniqueness(data);
    expect(first.firstSolution).toEqual(second.firstSolution);
    expect(second.firstSolution).toEqual(third.firstSolution);
    expect(CATEGORIES).toEqual(categoriesSnapshot);
  });

  it("ambiguous first and second witnesses remain identical across repeated runs", () => {
    const data = baseData({ clues: [clue("weak", "notSame", [op("person", "Maya"), op("room", "Vault")])] });
    const first = analyzeLogicGridUniqueness(data);
    const second = analyzeLogicGridUniqueness(data);
    expect(first.firstSolution).toEqual(second.firstSolution);
    expect(first.secondSolution).toEqual(second.secondSolution);
  });
});

describe("analyzeLogicGridUniqueness — witness-copy safety", () => {
  it("mutating a returned witness does not affect subsequent analysis", () => {
    const data = baseData({ clues: DIRECT_UNIQUE_CLUES });
    const first = analyzeLogicGridUniqueness(data);
    (first.firstSolution as LogicGridSolution).Maya.room = "Vault";

    const second = analyzeLogicGridUniqueness(data);
    expect(second.firstSolution).toEqual(EXPECTED_SOLUTION);
  });
});

describe("logicGridSolver — module safety (static review support)", () => {
  it("exposes only the documented exports", async () => {
    const moduleExports = await import("./logicGridSolver");
    expect(Object.keys(moduleExports).sort()).toEqual(
      ["analyzeLogicGridUniqueness", "evaluateLogicGridClueAgainstSolution"].sort()
    );
  });
});

// Exercises every branch of the LogicGridUniquenessResult contract in one place, matching the
// documented interpretation examples exactly.
describe("LogicGridUniquenessResult contract shape", () => {
  it("invalid", () => {
    const result: LogicGridUniquenessResult = analyzeLogicGridUniqueness(null);
    expect(result).toEqual({
      status: "invalid",
      solutionsFound: 0,
      searchExhausted: false,
      error: expect.any(String),
    });
  });

  it("unsupported (size)", () => {
    const result = analyzeLogicGridUniqueness(baseData({ categories: CATEGORIES.slice(0, 3), clues: ["x"] }));
    expect(result).toEqual({
      status: "unsupported",
      solutionsFound: 0,
      searchExhausted: false,
      error: expect.any(String),
    });
  });

  it("contradictory", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        clues: [
          clue("a", "same", [op("person", "Maya"), op("room", "Vault")]),
          clue("b", "notSame", [op("person", "Maya"), op("room", "Vault")]),
        ],
      })
    );
    expect(result).toEqual({ status: "contradictory", solutionsFound: 0, searchExhausted: true });
  });

  it("unique", () => {
    const result = analyzeLogicGridUniqueness(baseData({ clues: DIRECT_UNIQUE_CLUES }));
    expect(result).toEqual({
      status: "unique",
      solutionsFound: 1,
      searchExhausted: true,
      firstSolution: EXPECTED_SOLUTION,
    });
  });

  it("ambiguous", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({ clues: [clue("weak", "notSame", [op("person", "Maya"), op("room", "Vault")])] })
    );
    expect(result.status).toBe("ambiguous");
    expect(result.solutionsFound).toBe(2);
    expect(result.searchExhausted).toBe(false);
    expect(result.firstSolution).toBeTruthy();
    expect(result.secondSolution).toBeTruthy();
  });
});

// ── Pass 26C1 correction — entity-identity collision safety ────────────────

// `artifact::code` / "A" and `artifact` / "code::A" are two distinct entities that both
// serialized to the composite string key "artifact::code::A" under the old implementation.
const COLLISION_CATEGORIES: LogicGridCategoryNormalized[] = [
  { id: "person", name: "People", entries: ["Maya", "Jordan", "Lena", "Theo"] },
  { id: "artifact::code", name: "Artifact Codes", entries: ["A", "B", "C", "D"] },
  { id: "artifact", name: "Artifacts", entries: ["code::A", "code::B", "code::C", "code::D"] },
  { id: "time", name: "Times", entries: ["1", "2", "3", "4"] },
];

const COLLISION_SOLUTION: LogicGridSolution = {
  Maya: { "artifact::code": "A", artifact: "code::B", time: "1" },
  Jordan: { "artifact::code": "B", artifact: "code::A", time: "2" },
  Lena: { "artifact::code": "C", artifact: "code::C", time: "3" },
  Theo: { "artifact::code": "D", artifact: "code::D", time: "4" },
};

describe("evaluateLogicGridClueAgainstSolution — entity-identity collision safety", () => {
  it("each collision-prone operand resolves to its own correct primary row", () => {
    // Maya owns both artifact::code/A and time/1 — a `same` clue between them must be true.
    // Under the old concatenated-key implementation, artifact::code/A and artifact/code::A
    // shared one Map entry, so this would have incorrectly resolved to Jordan and returned false.
    const c = clue("same-collision", "same", [op("artifact::code", "A"), op("time", "1")]);
    expect(evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, c)).toBe(true);
  });

  it("a false same clue remains false", () => {
    // artifact::code/A belongs to Maya, time/2 belongs to Jordan — must be false. Under the old
    // implementation both operands collapsed to the same overwritten key (Jordan), making this
    // incorrectly evaluate to true.
    const c = clue("same-collision-false", "same", [op("artifact::code", "A"), op("time", "2")]);
    expect(evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, c)).toBe(false);
  });

  it("notSame remains correct across colliding keys", () => {
    // artifact::code/A -> Maya, artifact/code::A -> Jordan: different rows, so notSame is true.
    // Under the old implementation both operands resolved to the same (overwritten) row, making
    // this incorrectly false.
    const c = clue("notsame-collision", "notSame", [op("artifact::code", "A"), op("artifact", "code::A")]);
    expect(evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, c)).toBe(true);
  });

  it("ordered evaluation remains correct across colliding keys", () => {
    // artifact::code/A -> Maya (time index 0), artifact/code::A -> Jordan (time index 1): Maya
    // before Jordan along time is true. Under the old implementation both operands resolved to
    // the same row, making this incorrectly false (an item is never before itself).
    const c = clue(
      "before-collision",
      "before",
      [op("artifact::code", "A"), op("artifact", "code::A")],
      "time"
    );
    expect(evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, c)).toBe(true);
  });

  it("reversing operand order does not change a symmetric clue's result", () => {
    const forward = clue("rev-collision-a", "same", [op("artifact::code", "A"), op("time", "1")]);
    const reversed = clue("rev-collision-b", "same", [op("time", "1"), op("artifact::code", "A")]);
    expect(evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, forward)).toBe(
      evaluateLogicGridClueAgainstSolution(COLLISION_CATEGORIES, COLLISION_SOLUTION, reversed)
    );
  });
});

describe("analyzeLogicGridUniqueness — entity-identity collision safety", () => {
  const COLLISION_DIRECT_CLUES = [
    clue("cc1", "same", [op("person", "Maya"), op("artifact::code", "A")]),
    clue("cc2", "same", [op("person", "Maya"), op("artifact", "code::B")]),
    clue("cc3", "same", [op("person", "Maya"), op("time", "1")]),
    clue("cc4", "same", [op("person", "Jordan"), op("artifact::code", "B")]),
    clue("cc5", "same", [op("person", "Jordan"), op("artifact", "code::A")]),
    clue("cc6", "same", [op("person", "Jordan"), op("time", "2")]),
    clue("cc7", "same", [op("person", "Lena"), op("artifact::code", "C")]),
    clue("cc8", "same", [op("person", "Lena"), op("artifact", "code::C")]),
    clue("cc9", "same", [op("person", "Lena"), op("time", "3")]),
    clue("cc10", "same", [op("person", "Theo"), op("artifact::code", "D")]),
    clue("cc11", "same", [op("person", "Theo"), op("artifact", "code::D")]),
    clue("cc12", "same", [op("person", "Theo"), op("time", "4")]),
  ];

  it("a fully structured collision-prone puzzle still resolves to a correct unique witness", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({ categories: COLLISION_CATEGORIES, clues: COLLISION_DIRECT_CLUES })
    );
    expect(result.status).toBe("unique");
    expect(result.solutionsFound).toBe(1);
    expect(result.searchExhausted).toBe(true);
    expect(result.firstSolution).toEqual(COLLISION_SOLUTION);
  });

  it("a weak collision-prone puzzle is correctly ambiguous", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        categories: COLLISION_CATEGORIES,
        clues: [clue("weak-collision", "notSame", [op("person", "Maya"), op("artifact::code", "A")])],
      })
    );
    expect(result.status).toBe("ambiguous");
    expect(result.solutionsFound).toBe(2);
    expect(result.searchExhausted).toBe(false);
    expect(result.firstSolution).toBeTruthy();
    expect(result.secondSolution).toBeTruthy();
    expect(result.firstSolution).not.toEqual(result.secondSolution);
  });
});

// ── Pass 26C1 correction — malformed-category runtime safety ───────────────

describe("evaluateLogicGridClueAgainstSolution — malformed categories always return exactly null", () => {
  const validClueForCategoryTests = clue("x", "same", [op("room", "Observatory"), op("time", "8:00")]);

  function cloneCategories(): Array<{ id: string; name: string; entries: unknown }> {
    return JSON.parse(JSON.stringify(CATEGORIES));
  }

  const simpleMalformedCases: Array<[string, unknown]> = [
    ["null", null],
    ["empty object", {}],
    ["empty array", []],
    ["array containing null", [null]],
    ["array containing an array", [[]]],
    ["array containing an empty object", [{}]],
  ];

  for (const [label, value] of simpleMalformedCases) {
    it(`returns exactly null for ${label}`, () => {
      expect(
        evaluateLogicGridClueAgainstSolution(
          value as unknown as LogicGridCategoryNormalized[],
          EXPECTED_SOLUTION,
          validClueForCategoryTests
        )
      ).toBe(null);
    });
  }

  it("returns exactly null when entries is not an array (padded to a valid category count)", () => {
    const categories = [
      { id: "person", name: "People", entries: null },
      { id: "room", name: "Rooms", entries: ["A", "B", "C", "D"] },
      { id: "time", name: "Times", entries: ["1", "2", "3", "4"] },
    ];
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for a blank category id", () => {
    const categories = cloneCategories();
    categories[0].id = "  ";
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for duplicate category IDs", () => {
    const categories = cloneCategories();
    categories[1].id = categories[0].id;
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for duplicate entries within a category", () => {
    const categories = cloneCategories();
    (categories[1].entries as string[])[1] = (categories[1].entries as string[])[0];
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for case-insensitive duplicate entries", () => {
    const categories = cloneCategories();
    const entries = categories[1].entries as string[];
    entries[1] = entries[0].toUpperCase();
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for unequal category lengths", () => {
    const categories = cloneCategories();
    (categories[1].entries as string[]).push("Extra");
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for a blank category name", () => {
    const categories = cloneCategories();
    categories[0].name = "   ";
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for a blank entry", () => {
    const categories = cloneCategories();
    (categories[0].entries as string[])[0] = "   ";
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });

  it("returns exactly null for a non-string entry", () => {
    const categories = cloneCategories();
    (categories[0].entries as unknown[])[0] = 123;
    expect(
      evaluateLogicGridClueAgainstSolution(
        categories as unknown as LogicGridCategoryNormalized[],
        EXPECTED_SOLUTION,
        validClueForCategoryTests
      )
    ).toBe(null);
  });
});

describe("evaluateLogicGridClueAgainstSolution — category immutability", () => {
  it("leaves valid runtime categories byte-identical after evaluation", () => {
    const categories = JSON.parse(JSON.stringify(CATEGORIES)) as LogicGridCategoryNormalized[];
    const snapshot = JSON.parse(JSON.stringify(categories));
    const c = clue("x", "same", [op("room", "Observatory"), op("time", "8:00")]);

    evaluateLogicGridClueAgainstSolution(categories, EXPECTED_SOLUTION, c);

    expect(categories).toEqual(snapshot);
    expect(Object.keys(categories[0]).sort()).toEqual(["entries", "id", "name"]);
    expect(categories[0].entries).toEqual(snapshot[0].entries);
  });
});

// ── Pass 26C1 correction — malformed-clue runtime safety ───────────────────

describe("evaluateLogicGridClueAgainstSolution — malformed clues always return exactly null", () => {
  const validOperands = [op("room", "Observatory"), op("time", "8:00")];

  const malformedClueCases: Array<[string, unknown]> = [
    ["null clue", null],
    ["array clue", []],
    ["missing id", { text: "x", type: "same", operands: validOperands }],
    ["blank id", { id: "   ", text: "x", type: "same", operands: validOperands }],
    ["non-string id", { id: 123, text: "x", type: "same", operands: validOperands }],
    ["missing text", { id: "c1", type: "same", operands: validOperands }],
    ["non-string text", { id: "c1", text: 123, type: "same", operands: validOperands }],
    ["missing type", { id: "c1", text: "x", operands: validOperands }],
    ["unknown type", { id: "c1", text: "x", type: "madeUp", operands: validOperands }],
    ["missing operands", { id: "c1", text: "x", type: "same" }],
    ["non-array operands", { id: "c1", text: "x", type: "same", operands: "nope" }],
    ["null operand", { id: "c1", text: "x", type: "same", operands: [null, op("time", "8:00")] }],
    ["array operand", { id: "c1", text: "x", type: "same", operands: [[], op("time", "8:00")] }],
    [
      "missing operand category ID",
      { id: "c1", text: "x", type: "same", operands: [{ entry: "Observatory" }, op("time", "8:00")] },
    ],
    [
      "blank operand category ID",
      {
        id: "c1",
        text: "x",
        type: "same",
        operands: [{ categoryId: "  ", entry: "Observatory" }, op("time", "8:00")],
      },
    ],
    [
      "missing operand entry",
      { id: "c1", text: "x", type: "same", operands: [{ categoryId: "room" }, op("time", "8:00")] },
    ],
    [
      "blank operand entry",
      {
        id: "c1",
        text: "x",
        type: "same",
        operands: [{ categoryId: "room", entry: "   " }, op("time", "8:00")],
      },
    ],
    [
      "non-string ordered category ID",
      {
        id: "c1",
        text: "x",
        type: "before",
        orderedCategoryId: 123,
        operands: [op("person", "Maya"), op("person", "Jordan")],
      },
    ],
  ];

  for (const [label, value] of malformedClueCases) {
    it(`returns exactly null for ${label}`, () => {
      expect(
        evaluateLogicGridClueAgainstSolution(
          CATEGORIES,
          EXPECTED_SOLUTION,
          value as unknown as LogicGridClueNormalized
        )
      ).toBe(null);
    });
  }
});

describe("evaluateLogicGridClueAgainstSolution — clue text independence", () => {
  it("two otherwise identical clues with drastically different text evaluate identically", () => {
    const clueA = clue("t1", "same", [op("room", "Library"), op("time", "8:30")]);
    const clueB: LogicGridClueNormalized = {
      ...clueA,
      text: "A completely unrelated sentence that must never be inspected.",
    };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, clueA)).toBe(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, clueB)
    );
  });
});

// ── Pass 26C1 final correction — ordered metadata must match clue type ─────

describe("evaluateLogicGridClueAgainstSolution — non-ordered clues reject orderedCategoryId", () => {
  const nonOrderedFixtures: Array<[LogicGridClueNormalized["type"], LogicGridClueNormalized]> = [
    ["same", clue("no-same", "same", [op("room", "Library"), op("time", "8:30")])],
    ["notSame", clue("no-notsame", "notSame", [op("person", "Maya"), op("room", "Vault")])],
    [
      "eitherOr",
      clue("no-either", "eitherOr", [op("person", "Maya"), op("room", "Observatory"), op("room", "Library")]),
    ],
  ];

  for (const [type, baseClue] of nonOrderedFixtures) {
    it(`${type}: a nonblank orderedCategoryId invalidates the clue`, () => {
      const withMetadata: LogicGridClueNormalized = { ...baseClue, orderedCategoryId: "object" };
      expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, withMetadata)).toBeNull();
    });

    it(`${type}: a blank orderedCategoryId is treated as absent and does not change the result`, () => {
      const withoutMetadata = evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, baseClue);
      const withBlankMetadata: LogicGridClueNormalized = { ...baseClue, orderedCategoryId: "   " };
      expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, withBlankMetadata)).toBe(
        withoutMetadata
      );
    });
  }

  it("textOnly continues returning null regardless of orderedCategoryId, without parsing text", () => {
    const withMetadata: LogicGridClueNormalized = {
      id: "no-textonly",
      text: "Jordan arrived immediately before the guest carrying the Red Journal.",
      type: "textOnly",
      operands: [],
      orderedCategoryId: "time",
    };
    expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, withMetadata)).toBeNull();
  });
});

describe("evaluateLogicGridClueAgainstSolution — ordered clues require valid orderedCategoryId", () => {
  for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
    describe(type, () => {
      const operands = [op("person", "Maya"), op("person", "Jordan")];

      it("missing orderedCategoryId returns null", () => {
        const c: LogicGridClueNormalized = { id: `${type}-missing`, text: type, type, operands };
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("blank orderedCategoryId returns null", () => {
        const c = clue(`${type}-blank`, type, operands, "   ");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("non-string orderedCategoryId returns null", () => {
        const c: LogicGridClueNormalized = {
          id: `${type}-nonstring`,
          text: type,
          type,
          operands,
          orderedCategoryId: 123 as unknown as string,
        };
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).toBeNull();
      });

      it("a valid nonblank orderedCategoryId preserves existing behavior", () => {
        const c = clue(`${type}-valid`, type, operands, "time");
        expect(evaluateLogicGridClueAgainstSolution(CATEGORIES, EXPECTED_SOLUTION, c)).not.toBeNull();
      });
    });
  }
});

// ── Pass 26C1 final correction — __proto__-safe solution records ───────────

function safeRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  const record = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) record[key] = value;
  return record;
}

const PROTOTYPE_CATEGORIES: LogicGridCategoryNormalized[] = [
  { id: "person", name: "People", entries: ["__proto__", "Jordan", "Lena", "Theo"] },
  { id: "__proto__", name: "Codes", entries: ["Alpha", "Beta", "Gamma", "Delta"] },
  { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
  { id: "time", name: "Times", entries: ["1", "2", "3", "4"] },
];

const PROTOTYPE_SOLUTION: LogicGridSolution = safeRecord<Record<string, string>>([
  ["__proto__", safeRecord([["__proto__", "Alpha"], ["room", "Observatory"], ["time", "1"]])],
  ["Jordan", safeRecord([["__proto__", "Beta"], ["room", "Library"], ["time", "2"]])],
  ["Lena", safeRecord([["__proto__", "Gamma"], ["room", "Vault"], ["time", "3"]])],
  ["Theo", safeRecord([["__proto__", "Delta"], ["room", "Gallery"], ["time", "4"]])],
]);

describe("evaluateLogicGridClueAgainstSolution — __proto__-safe operand resolution", () => {
  it("an operand using primary entry __proto__ resolves correctly", () => {
    const c = clue("proto-primary", "same", [op("person", "__proto__"), op("room", "Observatory")]);
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(true);
  });

  it("an operand using category ID __proto__ resolves correctly", () => {
    const c = clue("proto-category", "same", [op("__proto__", "Alpha"), op("room", "Observatory")]);
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(true);
  });

  it("a true same clue returns true", () => {
    const c = clue("proto-true", "same", [op("person", "__proto__"), op("time", "1")]);
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(true);
  });

  it("a false same clue returns false", () => {
    const c = clue("proto-false", "same", [op("person", "__proto__"), op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(false);
  });

  it("notSame remains correct", () => {
    const c = clue("proto-notsame", "notSame", [op("person", "__proto__"), op("room", "Library")]);
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(true);
  });

  it("ordered evaluation remains correct", () => {
    const c = clue(
      "proto-before",
      "before",
      [op("person", "__proto__"), op("person", "Jordan")],
      "time"
    );
    expect(evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c)).toBe(true);
  });

  it("leaves the candidate input unchanged", () => {
    const snapshot = JSON.stringify(PROTOTYPE_SOLUTION);
    const c = clue("proto-snapshot", "same", [op("person", "__proto__"), op("time", "1")]);
    evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c);
    expect(JSON.stringify(PROTOTYPE_SOLUTION)).toBe(snapshot);
  });

  it("Object.prototype receives no new properties", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    const c = clue("proto-pollution", "same", [op("person", "__proto__"), op("time", "1")]);
    evaluateLogicGridClueAgainstSolution(PROTOTYPE_CATEGORIES, PROTOTYPE_SOLUTION, c);
    const after = Object.getOwnPropertyNames(Object.prototype).sort();
    expect(after).toEqual(before);
    expect(({} as Record<string, unknown>).__proto__).toBe(Object.prototype);
  });
});

describe("analyzeLogicGridUniqueness — __proto__-safe uniqueness analysis", () => {
  const PROTOTYPE_DIRECT_CLUES = [
    clue("pp1", "same", [op("person", "__proto__"), op("__proto__", "Alpha")]),
    clue("pp2", "same", [op("person", "__proto__"), op("room", "Observatory")]),
    clue("pp3", "same", [op("person", "__proto__"), op("time", "1")]),
    clue("pp4", "same", [op("person", "Jordan"), op("__proto__", "Beta")]),
    clue("pp5", "same", [op("person", "Jordan"), op("room", "Library")]),
    clue("pp6", "same", [op("person", "Jordan"), op("time", "2")]),
    clue("pp7", "same", [op("person", "Lena"), op("__proto__", "Gamma")]),
    clue("pp8", "same", [op("person", "Lena"), op("room", "Vault")]),
    clue("pp9", "same", [op("person", "Lena"), op("time", "3")]),
    clue("pp10", "same", [op("person", "Theo"), op("__proto__", "Delta")]),
    clue("pp11", "same", [op("person", "Theo"), op("room", "Gallery")]),
    clue("pp12", "same", [op("person", "Theo"), op("time", "4")]),
  ];

  it("a fully structured __proto__-sensitive puzzle resolves to a correct unique witness", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({ categories: PROTOTYPE_CATEGORIES, clues: PROTOTYPE_DIRECT_CLUES })
    );
    expect(result.status).toBe("unique");
    expect(result.solutionsFound).toBe(1);
    expect(result.searchExhausted).toBe(true);

    const solution = result.firstSolution!;
    expect(Object.prototype.hasOwnProperty.call(solution, "__proto__")).toBe(true);
    const protoRow = solution["__proto__"];
    expect(Object.prototype.hasOwnProperty.call(protoRow, "__proto__")).toBe(true);
    expect(protoRow["__proto__"]).toBe("Alpha");
    expect(protoRow.room).toBe("Observatory");
    expect(protoRow.time).toBe("1");

    const json = JSON.stringify(solution);
    expect((json.match(/"__proto__"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(json).toContain('"Alpha"');
  });
});

describe("analyzeLogicGridUniqueness — __proto__-safe ambiguous analysis", () => {
  it("a weak __proto__-sensitive puzzle is correctly ambiguous with valid witnesses", () => {
    const result = analyzeLogicGridUniqueness(
      baseData({
        categories: PROTOTYPE_CATEGORIES,
        clues: [clue("weak-proto", "notSame", [op("person", "__proto__"), op("room", "Library")])],
      })
    );
    expect(result.status).toBe("ambiguous");
    expect(result.solutionsFound).toBe(2);
    expect(result.searchExhausted).toBe(false);

    for (const solution of [result.firstSolution!, result.secondSolution!]) {
      expect(Object.prototype.hasOwnProperty.call(solution, "__proto__")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(solution["__proto__"], "__proto__")).toBe(true);
      expect(Object.keys(solution).sort()).toEqual(PROTOTYPE_CATEGORIES[0].entries.slice().sort());
      for (const other of PROTOTYPE_CATEGORIES.slice(1)) {
        const assigned = PROTOTYPE_CATEGORIES[0].entries.map((entry) => solution[entry][other.id]);
        expect(new Set(assigned).size).toBe(other.entries.length);
      }
    }
    expect(result.firstSolution).not.toEqual(result.secondSolution);
  });
});

describe("evaluateLogicGridClueAgainstSolution — inherited-property rejection", () => {
  it("rejects a candidate whose primary row exists only via the prototype chain", () => {
    const inheritedRowSource = { Maya: { room: "Observatory", time: "8:00", object: "Brass Compass" } };
    const solution = Object.create(inheritedRowSource) as Record<string, unknown>;
    solution.Jordan = { room: "Library", time: "8:30", object: "Silver Key" };
    solution.Lena = { room: "Vault", time: "9:00", object: "Red Journal" };
    solution.Theo = { room: "Gallery", time: "9:30", object: "Glass Eye" };

    // Confirm the setup: Maya is genuinely only reachable through the prototype.
    expect(Object.prototype.hasOwnProperty.call(solution, "Maya")).toBe(false);
    expect((solution as Record<string, unknown>).Maya).toBeTruthy();

    const c = clue("inherited-row", "same", [op("room", "Observatory"), op("time", "8:00")]);
    expect(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, solution as unknown as LogicGridSolution, c)
    ).toBeNull();
  });

  it("rejects a candidate whose category assignment exists only via a row's prototype", () => {
    const rowPrototype = { room: "Observatory" };
    const mayaRow = Object.create(rowPrototype) as Record<string, unknown>;
    mayaRow.time = "8:00";
    mayaRow.object = "Brass Compass";

    expect(Object.prototype.hasOwnProperty.call(mayaRow, "room")).toBe(false);
    expect(mayaRow.room).toBe("Observatory");

    const solution = {
      Maya: mayaRow,
      Jordan: { room: "Library", time: "8:30", object: "Silver Key" },
      Lena: { room: "Vault", time: "9:00", object: "Red Journal" },
      Theo: { room: "Gallery", time: "9:30", object: "Glass Eye" },
    };

    const c = clue("inherited-assignment", "same", [op("room", "Observatory"), op("time", "8:00")]);
    expect(
      evaluateLogicGridClueAgainstSolution(CATEGORIES, solution as unknown as LogicGridSolution, c)
    ).toBeNull();
  });
});
