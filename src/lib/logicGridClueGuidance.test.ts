import {
  deriveLogicGridTeachingGuide,
  getLogicGridCategoryPairKey,
  type LogicGridTeachingGuide,
} from "./logicGridClueGuidance";
import { getLogicGridCellKey } from "./logicGridGame";
import type { LogicGridCategoryNormalized, LogicGridClueNormalized } from "./logicGridCore";

const CATEGORIES: LogicGridCategoryNormalized[] = [
  { id: "person", name: "Guests", entries: ["Maya", "Jordan", "Lena", "Theo"] },
  { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
  { id: "time", name: "Arrival Times", entries: ["8:00", "8:30", "9:00", "9:30"] },
  { id: "object", name: "Objects", entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"] },
];

function keyFor(catA: string, entryA: string, catB: string, entryB: string): string {
  return getLogicGridCellKey(CATEGORIES, catA, entryA, catB, entryB)!;
}

describe("getLogicGridCategoryPairKey", () => {
  it("returns the canonical earlier::later key", () => {
    expect(getLogicGridCategoryPairKey(CATEGORIES, "room", "time")).toBe("room::time");
  });

  it("reversed arguments produce the same canonical key", () => {
    expect(getLogicGridCategoryPairKey(CATEGORIES, "time", "room")).toBe("room::time");
  });

  it("returns null for a category paired with itself", () => {
    expect(getLogicGridCategoryPairKey(CATEGORIES, "room", "room")).toBeNull();
  });

  it("returns null for an unknown first category", () => {
    expect(getLogicGridCategoryPairKey(CATEGORIES, "nope", "room")).toBeNull();
  });

  it("returns null for an unknown second category", () => {
    expect(getLogicGridCategoryPairKey(CATEGORIES, "room", "nope")).toBeNull();
  });

  it("does not mutate the categories input", () => {
    const snapshot = JSON.parse(JSON.stringify(CATEGORIES));
    getLogicGridCategoryPairKey(CATEGORIES, "person", "object");
    expect(CATEGORIES).toEqual(snapshot);
  });
});

describe("deriveLogicGridTeachingGuide — textOnly", () => {
  it("returns null for a textOnly clue", () => {
    const clue: LogicGridClueNormalized = {
      id: "clue-1",
      text: "Maya did not enter the Vault.",
      type: "textOnly",
      operands: [],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });

  it("does not attempt to parse clue text — a sentence resembling a supported clue still returns null", () => {
    const clue: LogicGridClueNormalized = {
      id: "clue-1",
      text: "Jordan arrived immediately before the guest carrying the Red Journal.",
      type: "textOnly",
      operands: [],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });
});

describe("deriveLogicGridTeachingGuide — same", () => {
  const clue: LogicGridClueNormalized = {
    id: "same-1",
    text: "The Library visitor arrived at 8:00.",
    type: "same",
    operands: [
      { categoryId: "room", entry: "Library" },
      { categoryId: "time", entry: "8:00" },
    ],
  };

  it("produces the correct heading, summary, and steps", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.heading).toBe("Connect these entries");
    expect(guide.summary).toBe("Library belongs with 8:00.");
    expect(guide.steps).toEqual([
      "Find the highlighted intersection.",
      "Mark it ✓ to confirm the relationship.",
      "Use the automatic row and column eliminations to continue.",
    ]);
  });

  it("focuses one canonical pair key, one primary cell, and zero context cells", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.focus.pairKeys).toEqual(["room::time"]);
    expect(guide.focus.primaryCellKeys).toEqual([keyFor("room", "Library", "time", "8:00")]);
    expect(guide.focus.contextCellKeys).toEqual([]);
  });

  it("reversed operand category order still generates the same canonical keys", () => {
    const reversed: LogicGridClueNormalized = {
      ...clue,
      operands: [
        { categoryId: "time", entry: "8:00" },
        { categoryId: "room", entry: "Library" },
      ],
    };
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, reversed)!;
    expect(guide.focus.pairKeys).toEqual(["room::time"]);
    expect(guide.focus.primaryCellKeys).toEqual([keyFor("room", "Library", "time", "8:00")]);
  });

  it("needs no hidden solution and does not mutate input", () => {
    const categoriesSnapshot = JSON.parse(JSON.stringify(CATEGORIES));
    const clueSnapshot = JSON.parse(JSON.stringify(clue));
    deriveLogicGridTeachingGuide(CATEGORIES, clue);
    expect(CATEGORIES).toEqual(categoriesSnapshot);
    expect(clue).toEqual(clueSnapshot);
  });
});

describe("deriveLogicGridTeachingGuide — notSame", () => {
  const clue: LogicGridClueNormalized = {
    id: "notsame-1",
    text: "Maya did not enter the Vault.",
    type: "notSame",
    operands: [
      { categoryId: "person", entry: "Maya" },
      { categoryId: "room", entry: "Vault" },
    ],
  };

  it("produces the correct heading, summary, and ✕ instruction", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.heading).toBe("Rule out this pairing");
    expect(guide.summary).toBe("Maya cannot be paired with Vault.");
    expect(guide.steps[1]).toBe("Mark it ✕ to eliminate the relationship.");
  });

  it("focuses exactly one primary cell and no context cells", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.focus.primaryCellKeys).toEqual([keyFor("person", "Maya", "room", "Vault")]);
    expect(guide.focus.contextCellKeys).toEqual([]);
  });

  it("returns null for an invalid operand entry", () => {
    const broken: LogicGridClueNormalized = {
      ...clue,
      operands: [
        { categoryId: "person", entry: "Nobody" },
        { categoryId: "room", entry: "Vault" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
  });
});

describe("deriveLogicGridTeachingGuide — eitherOr", () => {
  const clue: LogicGridClueNormalized = {
    id: "either-1",
    text: "Maya carried the Silver Key or the Red Journal.",
    type: "eitherOr",
    operands: [
      { categoryId: "person", entry: "Maya" },
      { categoryId: "object", entry: "Silver Key" },
      { categoryId: "object", entry: "Red Journal" },
    ],
  };

  it("focuses exactly two primary alternative cells", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.focus.primaryCellKeys.sort()).toEqual(
      [keyFor("person", "Maya", "object", "Silver Key"), keyFor("person", "Maya", "object", "Red Journal")].sort()
    );
  });

  it("treats every other subject-to-alternative-category cell as context", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.focus.contextCellKeys.sort()).toEqual(
      [
        keyFor("person", "Maya", "object", "Brass Compass"),
        keyFor("person", "Maya", "object", "Glass Eye"),
      ].sort()
    );
  });

  it("never lists a primary cell as also context", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    const overlap = guide.focus.primaryCellKeys.filter((k) => guide.focus.contextCellKeys.includes(k));
    expect(overlap).toEqual([]);
  });

  it("uses a canonical pair key", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.focus.pairKeys).toEqual(["person::object"]);
  });

  it("is deterministic across repeated calls", () => {
    const guideA = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    const guideB = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guideA).toEqual(guideB);
  });

  it("summary mentions both alternatives", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.summary).toContain("Silver Key");
    expect(guide.summary).toContain("Red Journal");
  });

  it("steps explain that the two primary options remain open, using the real category name", () => {
    const guide = deriveLogicGridTeachingGuide(CATEGORIES, clue)!;
    expect(guide.steps[0]).toContain("two strongly highlighted cells");
    expect(guide.steps[1]).toContain("Objects");
    expect(guide.steps[1]).not.toContain("Rooms");
  });

  it("returns null when the alternative operands span two different categories", () => {
    const broken: LogicGridClueNormalized = {
      ...clue,
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "room", entry: "Library" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
  });

  it("returns null for a missing alternative category", () => {
    const broken: LogicGridClueNormalized = {
      ...clue,
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "nope", entry: "Silver Key" },
        { categoryId: "nope", entry: "Red Journal" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
  });
});

describe("deriveLogicGridTeachingGuide — ordered types", () => {
  for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
    describe(type, () => {
      const crossCategoryClue: LogicGridClueNormalized = {
        id: `${type}-cross`,
        text: `${type} clue.`,
        type,
        orderedCategoryId: "time",
        operands: [
          { categoryId: "person", entry: "Jordan" },
          { categoryId: "object", entry: "Red Journal" },
        ],
      };

      const sameCategoryClue: LogicGridClueNormalized = {
        id: `${type}-same`,
        text: `${type} clue.`,
        type,
        orderedCategoryId: "time",
        operands: [
          { categoryId: "person", entry: "Jordan" },
          { categoryId: "person", entry: "Maya" },
        ],
      };

      it("cross-category operands produce two pair keys", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        expect(guide.focus.pairKeys.sort()).toEqual(["person::time", "time::object"].sort());
      });

      it("same-category operands produce one deduplicated pair key", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, sameCategoryClue)!;
        expect(guide.focus.pairKeys).toEqual(["person::time"]);
      });

      it("every operand-to-ordered-category cell appears as a primary cell, deduplicated", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        const expectedJordan = CATEGORIES.find((c) => c.id === "time")!.entries.map((t) =>
          keyFor("person", "Jordan", "time", t)
        );
        const expectedJournal = CATEGORIES.find((c) => c.id === "time")!.entries.map((t) =>
          keyFor("object", "Red Journal", "time", t)
        );
        expect(guide.focus.primaryCellKeys.sort()).toEqual([...expectedJordan, ...expectedJournal].sort());
        expect(new Set(guide.focus.primaryCellKeys).size).toBe(guide.focus.primaryCellKeys.length);
      });

      it("has no context cells", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        expect(guide.focus.contextCellKeys).toEqual([]);
      });

      it("does not include the direct operand-1-to-operand-2 cell", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        const directKey = keyFor("person", "Jordan", "object", "Red Journal");
        expect(guide.focus.primaryCellKeys).not.toContain(directKey);
      });

      it("produces the correct heading", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        const expectedHeading =
          type === "before"
            ? "Compare earlier positions"
            : type === "after"
            ? "Compare later positions"
            : "Compare adjacent positions";
        expect(guide.heading).toBe(expectedHeading);
      });

      it("produces a summary naming both operands and the ordered category", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        expect(guide.summary).toContain("Jordan");
        expect(guide.summary).toContain("Red Journal");
        expect(guide.summary).toContain("Arrival Times");
      });

      it("includes the ordered category's entry sequence in the steps", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        expect(guide.steps[0]).toContain("8:00 → 8:30 → 9:00 → 9:30");
      });

      it("adjacency explanation matches the immediacy of the type", () => {
        const guide = deriveLogicGridTeachingGuide(CATEGORIES, crossCategoryClue)!;
        const isImmediate = type === "immediatelyBefore" || type === "immediatelyAfter";
        if (isImmediate) {
          expect(guide.steps[2]).toContain("adjacent");
        } else {
          expect(guide.steps[2]).toContain("do not need to be adjacent");
        }
      });

      it("returns null when the ordered category matches an operand's category", () => {
        const broken: LogicGridClueNormalized = {
          ...crossCategoryClue,
          orderedCategoryId: "person",
        };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
      });

      it("returns null when orderedCategoryId is missing", () => {
        const { orderedCategoryId: _omit, ...rest } = crossCategoryClue;
        expect(deriveLogicGridTeachingGuide(CATEGORIES, rest as LogicGridClueNormalized)).toBeNull();
      });

      it("returns null for an unknown orderedCategoryId", () => {
        const broken: LogicGridClueNormalized = { ...crossCategoryClue, orderedCategoryId: "nope" };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
      });

      it("returns null for an unknown operand entry", () => {
        const broken: LogicGridClueNormalized = {
          ...crossCategoryClue,
          operands: [
            { categoryId: "person", entry: "Nobody" },
            { categoryId: "object", entry: "Red Journal" },
          ],
        };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, broken)).toBeNull();
      });
    });
  }
});

describe("deriveLogicGridTeachingGuide — safety", () => {
  const guides: LogicGridTeachingGuide[] = [
    deriveLogicGridTeachingGuide(CATEGORIES, {
      id: "same-1",
      text: "same",
      type: "same",
      operands: [
        { categoryId: "room", entry: "Library" },
        { categoryId: "time", entry: "8:00" },
      ],
    })!,
    deriveLogicGridTeachingGuide(CATEGORIES, {
      id: "either-1",
      text: "either",
      type: "eitherOr",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    })!,
    deriveLogicGridTeachingGuide(CATEGORIES, {
      id: "before-1",
      text: "before",
      type: "immediatelyBefore",
      orderedCategoryId: "time",
      operands: [
        { categoryId: "person", entry: "Jordan" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    })!,
  ];

  it("contains no solution field on any guide", () => {
    for (const guide of guides) {
      expect("solution" in guide).toBe(false);
    }
  });

  it("does not spread the raw clue object", () => {
    for (const guide of guides) {
      expect("operands" in guide).toBe(false);
      expect("type" in guide).toBe(false);
      expect("text" in guide).toBe(false);
    }
  });

  it("arrays contain no duplicate keys", () => {
    for (const guide of guides) {
      expect(new Set(guide.focus.pairKeys).size).toBe(guide.focus.pairKeys.length);
      expect(new Set(guide.focus.primaryCellKeys).size).toBe(guide.focus.primaryCellKeys.length);
      expect(new Set(guide.focus.contextCellKeys).size).toBe(guide.focus.contextCellKeys.length);
    }
  });

  it("never throws for malformed runtime values cast to the normalized type", () => {
    const malformedValues: unknown[] = [
      null,
      undefined,
      42,
      "a string",
      [],
      {},
      { type: "same", operands: null },
      { type: "eitherOr", operands: [{ categoryId: "person", entry: "Maya" }] },
      { type: "immediatelyBefore", operands: [], orderedCategoryId: 123 },
    ];
    for (const value of malformedValues) {
      expect(() =>
        deriveLogicGridTeachingGuide(CATEGORIES, value as unknown as LogicGridClueNormalized)
      ).not.toThrow();
    }
  });

  it("does not mutate categories across many calls", () => {
    const snapshot = JSON.parse(JSON.stringify(CATEGORIES));
    for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
      deriveLogicGridTeachingGuide(CATEGORIES, {
        id: "x",
        text: "x",
        type,
        orderedCategoryId: "time",
        operands: [
          { categoryId: "person", entry: "Jordan" },
          { categoryId: "object", entry: "Red Journal" },
        ],
      });
    }
    expect(CATEGORIES).toEqual(snapshot);
  });
});

// ── Pass 26B2 correction — runtime-safety hardening ────────────────────────

const VALID_SAME_CLUE: LogicGridClueNormalized = {
  id: "same-1",
  text: "same",
  type: "same",
  operands: [
    { categoryId: "room", entry: "Library" },
    { categoryId: "time", entry: "8:00" },
  ],
};

describe("category runtime safety", () => {
  it("getLogicGridCategoryPairKey returns null for a non-array categories value", () => {
    expect(getLogicGridCategoryPairKey(null as unknown as LogicGridCategoryNormalized[], "room", "time")).toBeNull();
    expect(getLogicGridCategoryPairKey({} as unknown as LogicGridCategoryNormalized[], "room", "time")).toBeNull();
  });

  it("deriveLogicGridTeachingGuide returns null for a non-array categories value", () => {
    expect(deriveLogicGridTeachingGuide(null as unknown as LogicGridCategoryNormalized[], VALID_SAME_CLUE)).toBeNull();
    expect(deriveLogicGridTeachingGuide({} as unknown as LogicGridCategoryNormalized[], VALID_SAME_CLUE)).toBeNull();
  });

  it("neither call throws for a non-array categories value", () => {
    expect(() =>
      getLogicGridCategoryPairKey(null as unknown as LogicGridCategoryNormalized[], "room", "time")
    ).not.toThrow();
    expect(() =>
      deriveLogicGridTeachingGuide({} as unknown as LogicGridCategoryNormalized[], VALID_SAME_CLUE)
    ).not.toThrow();
  });
});

describe("clue-id runtime safety", () => {
  it("returns null for a missing clue id", () => {
    const { id: _omit, ...rest } = VALID_SAME_CLUE;
    expect(deriveLogicGridTeachingGuide(CATEGORIES, rest as unknown as LogicGridClueNormalized)).toBeNull();
  });

  it("returns null for a non-string clue id", () => {
    expect(
      deriveLogicGridTeachingGuide(CATEGORIES, { ...VALID_SAME_CLUE, id: 42 } as unknown as LogicGridClueNormalized)
    ).toBeNull();
  });

  it("returns null for a blank clue id", () => {
    expect(deriveLogicGridTeachingGuide(CATEGORIES, { ...VALID_SAME_CLUE, id: "   " })).toBeNull();
  });
});

describe("same / notSame — hardened runtime validation", () => {
  for (const type of ["same", "notSame"] as const) {
    it(`${type}: two valid cross-category operands still work`, () => {
      const guide = deriveLogicGridTeachingGuide(CATEGORIES, { ...VALID_SAME_CLUE, type });
      expect(guide).not.toBeNull();
    });

    it(`${type}: a single operand returns null`, () => {
      const clue = { ...VALID_SAME_CLUE, type, operands: [VALID_SAME_CLUE.operands[0]] };
      expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
    });

    it(`${type}: three operands returns null`, () => {
      const clue = {
        ...VALID_SAME_CLUE,
        type,
        operands: [...VALID_SAME_CLUE.operands, { categoryId: "person", entry: "Maya" }],
      };
      expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
    });

    it(`${type}: same-category operands returns null`, () => {
      const clue: LogicGridClueNormalized = {
        ...VALID_SAME_CLUE,
        type,
        operands: [
          { categoryId: "person", entry: "Maya" },
          { categoryId: "person", entry: "Jordan" },
        ],
      };
      expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
    });

    it(`${type}: exact duplicate operands returns null`, () => {
      const clue: LogicGridClueNormalized = {
        ...VALID_SAME_CLUE,
        type,
        operands: [
          { categoryId: "person", entry: "Maya" },
          { categoryId: "person", entry: "Maya" },
        ],
      };
      expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
    });
  }
});

describe("eitherOr — hardened runtime validation", () => {
  const VALID_EITHER: LogicGridClueNormalized = {
    id: "either-1",
    text: "either",
    type: "eitherOr",
    operands: [
      { categoryId: "person", entry: "Maya" },
      { categoryId: "object", entry: "Silver Key" },
      { categoryId: "object", entry: "Red Journal" },
    ],
  };

  it("a valid subject plus two alternatives still works", () => {
    expect(deriveLogicGridTeachingGuide(CATEGORIES, VALID_EITHER)).not.toBeNull();
  });

  it("duplicate alternative entries return null", () => {
    const clue: LogicGridClueNormalized = {
      ...VALID_EITHER,
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Silver Key" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });

  it("the subject using the alternatives' category returns null", () => {
    const clue: LogicGridClueNormalized = {
      ...VALID_EITHER,
      operands: [
        { categoryId: "object", entry: "Glass Eye" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });

  it("two operands return null", () => {
    const clue: LogicGridClueNormalized = { ...VALID_EITHER, operands: VALID_EITHER.operands.slice(0, 2) };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });

  it("four operands return null", () => {
    const clue: LogicGridClueNormalized = {
      ...VALID_EITHER,
      operands: [...VALID_EITHER.operands, { categoryId: "object", entry: "Glass Eye" }],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });

  it("different alternative categories return null", () => {
    const clue: LogicGridClueNormalized = {
      ...VALID_EITHER,
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "room", entry: "Library" },
      ],
    };
    expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
  });
});

describe("ordered clues — hardened runtime validation", () => {
  for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
    const VALID_ORDERED_CROSS: LogicGridClueNormalized = {
      id: "ordered-1",
      text: "ordered",
      type,
      orderedCategoryId: "time",
      operands: [
        { categoryId: "person", entry: "Jordan" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    };
    const VALID_ORDERED_SAME: LogicGridClueNormalized = {
      ...VALID_ORDERED_CROSS,
      operands: [
        { categoryId: "person", entry: "Jordan" },
        { categoryId: "person", entry: "Maya" },
      ],
    };

    describe(type, () => {
      it("valid cross-category operands still work", () => {
        expect(deriveLogicGridTeachingGuide(CATEGORIES, VALID_ORDERED_CROSS)).not.toBeNull();
      });

      it("valid same-category, different-entry operands still work", () => {
        expect(deriveLogicGridTeachingGuide(CATEGORIES, VALID_ORDERED_SAME)).not.toBeNull();
      });

      it("exact duplicate operands return null", () => {
        const clue: LogicGridClueNormalized = {
          ...VALID_ORDERED_CROSS,
          operands: [
            { categoryId: "person", entry: "Jordan" },
            { categoryId: "person", entry: "Jordan" },
          ],
        };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
      });

      it("a single operand returns null", () => {
        const clue: LogicGridClueNormalized = {
          ...VALID_ORDERED_CROSS,
          operands: [VALID_ORDERED_CROSS.operands[0]],
        };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
      });

      it("three operands return null", () => {
        const clue: LogicGridClueNormalized = {
          ...VALID_ORDERED_CROSS,
          operands: [...VALID_ORDERED_CROSS.operands, { categoryId: "room", entry: "Library" }],
        };
        expect(deriveLogicGridTeachingGuide(CATEGORIES, clue)).toBeNull();
      });

      it("a missing clue id returns null", () => {
        const { id: _omit, ...rest } = VALID_ORDERED_CROSS;
        expect(deriveLogicGridTeachingGuide(CATEGORIES, rest as unknown as LogicGridClueNormalized)).toBeNull();
      });
    });
  }
});
