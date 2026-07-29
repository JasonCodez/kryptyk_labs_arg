import {
  stripLogicGridSolution,
  validateLogicGridPuzzleData,
  type LogicGridDataInput,
} from "./logicGridCore";

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

function baseData(overrides: Partial<LogicGridDataInput> = {}): LogicGridDataInput {
  return {
    intro: "Four guests entered the Midnight Exhibition.",
    categories: CATEGORIES,
    clues: ["Maya did not enter the Vault."],
    solution: SOLUTION,
    ...overrides,
  };
}

describe("validateLogicGridPuzzleData — legacy string clues", () => {
  it("converts a plain string clue into a textOnly structured clue with a deterministic id", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: ["Maya did not enter the Vault."] }));
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues).toEqual([
      { id: "clue-1", text: "Maya did not enter the Vault.", type: "textOnly", operands: [] },
    ]);
  });

  it("assigns clue-N ids based on source position, including across skipped blanks", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: ["First clue.", "  ", "Third clue."] }));
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues.map((c) => c.id)).toEqual(["clue-1", "clue-3"]);
  });

  it("trims whitespace from legacy clue text", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: ["  Padded clue.  "] }));
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues[0].text).toBe("Padded clue.");
  });

  it("silently drops blank legacy strings without invalidating the puzzle", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: ["Real clue.", "", "   "] }));
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues).toHaveLength(1);
  });

  it("rejects a puzzle whose clues are all blank", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: ["", "   "] }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid requires at least one clue.");
  });

  it("rejects when clues is not an array", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: "not an array" }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid requires puzzleData.clues.");
  });

  it("rejects when clues is missing entirely", () => {
    const { clues: _omit, ...rest } = baseData();
    const result = validateLogicGridPuzzleData(rest);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid requires puzzleData.clues.");
  });
});

describe("validateLogicGridPuzzleData — structured clue general rules", () => {
  it("accepts an explicit id and does not overwrite it", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ id: "custom-id", text: "Custom clue.", type: "textOnly", operands: [] }] })
    );
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues[0].id).toBe("custom-id");
  });

  it("rejects a clue that is not a string or object", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: [42] }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: invalid clue.");
  });

  it("rejects a clue that is null", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: [null] }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: invalid clue.");
  });

  it("rejects a structured clue with blank text", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ text: "  ", type: "textOnly", operands: [] }] })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: text is required.");
  });

  it("rejects a structured clue with a blank explicit id", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ id: "  ", text: "Some clue.", type: "textOnly", operands: [] }] })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: id cannot be blank.");
  });

  it("rejects an unknown clue type", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ text: "Some clue.", type: "madeUp", operands: [] }] })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: unknown clue type.");
  });

  it("rejects a missing clue type on a structured object", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: [{ text: "Some clue.", operands: [] }] }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: unknown clue type.");
  });

  it("rejects operands that are not a list", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ text: "Some clue.", type: "textOnly", operands: "nope" }] })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: operands must be a list.");
  });

  it("rejects the wrong operand count for a type", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "same",
            operands: [{ categoryId: "person", entry: "Maya" }],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: same clues require exactly 2 operands.");
  });

  it("rejects an operand referencing an unknown category", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "same",
            operands: [
              { categoryId: "nope", entry: "Maya" },
              { categoryId: "room", entry: "Library" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: operand references an unknown category.");
  });

  it("rejects an operand referencing an unknown entry", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "same",
            operands: [
              { categoryId: "person", entry: "Nobody" },
              { categoryId: "room", entry: "Library" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: operand references an unknown entry.");
  });

  it("rejects an invalid (non-object) operand", () => {
    const result = validateLogicGridPuzzleData(
      baseData({ clues: [{ text: "Some clue.", type: "same", operands: ["x", "y"] }] })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: invalid operand.");
  });

  it("rejects an array used as a clue", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: [["not", "a", "clue"]] }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: invalid clue.");
  });

  it("rejects an array used as an operand", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "same",
            operands: [["person", "Maya"], { categoryId: "room", entry: "Library" }],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: invalid operand.");
  });

  it("rejects duplicate operands within the same clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "room", entry: "Library" },
              { categoryId: "room", entry: "Library" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: operands must be unique.");
  });

  it("rejects two explicit duplicate ids, blaming the later (colliding) clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          { id: "duplicate-marker-id", text: "First.", type: "textOnly", operands: [] },
          { id: "duplicate-marker-id", text: "Second.", type: "textOnly", operands: [] },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 2: id duplicates an earlier clue id.");
    expect(result.error).not.toContain("duplicate-marker-id");
  });

  it("rejects an explicit id colliding with a later legacy clue's generated id, blaming the later clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          { id: "clue-2", text: "First.", type: "textOnly", operands: [] },
          "Second clue text.",
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 2: id duplicates an earlier clue id.");
  });

  it("rejects a later explicit id colliding with an earlier legacy clue's generated id, blaming the later clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: ["First clue text.", { id: "clue-1", text: "Second.", type: "textOnly", operands: [] }],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 2: id duplicates an earlier clue id.");
  });

  it("strips unknown fields from a structured clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Some clue.",
            type: "textOnly",
            operands: [],
            debugNotes: "private author note",
            solutionHint: "Maya",
          },
        ],
      })
    );
    expect(result.valid).toBe(true);
    const clue = result.normalized!.clues[0] as unknown as Record<string, unknown>;
    expect(Object.keys(clue).sort()).toEqual(["id", "operands", "text", "type"]);
  });

  it("does not mutate the raw input data", () => {
    const raw = baseData({
      clues: [{ text: "Some clue.", type: "textOnly", operands: [] }],
    });
    const snapshot = JSON.parse(JSON.stringify(raw));
    validateLogicGridPuzzleData(raw);
    expect(raw).toEqual(snapshot);
  });

  it("a single malformed structured clue invalidates the whole puzzle rather than downgrading to textOnly", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          "A valid legacy clue.",
          { text: "Broken clue.", type: "same", operands: [{ categoryId: "person", entry: "Maya" }] },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 2: same clues require exactly 2 operands.");
  });
});

describe("validateLogicGridPuzzleData — same / notSame", () => {
  for (const type of ["same", "notSame"] as const) {
    it(`accepts a valid ${type} clue across two different categories`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              operands: [
                { categoryId: "person", entry: "Maya" },
                { categoryId: "room", entry: "Library" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized!.clues[0]).toEqual({
        id: "clue-1",
        text: `${type} clue.`,
        type,
        operands: [
          { categoryId: "person", entry: "Maya" },
          { categoryId: "room", entry: "Library" },
        ],
      });
    });

    it(`rejects a ${type} clue whose operands share a category`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              operands: [
                { categoryId: "person", entry: "Maya" },
                { categoryId: "person", entry: "Jordan" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe(`Logic grid clue 1: ${type} operands must be from different categories.`);
    });
  }
});

describe("validateLogicGridPuzzleData — ordered relationship types", () => {
  for (const type of ["before", "after", "immediatelyBefore", "immediatelyAfter"] as const) {
    it(`accepts a valid ${type} clue with cross-category operands`, () => {
      // "Jordan arrived immediately before the guest carrying the Red Journal." — the two
      // operands are a person and an object, compared along the "time" ordered category.
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "time",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "object", entry: "Red Journal" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized!.clues[0]).toEqual({
        id: "clue-1",
        text: `${type} clue.`,
        type,
        orderedCategoryId: "time",
        operands: [
          { categoryId: "person", entry: "Jordan" },
          { categoryId: "object", entry: "Red Journal" },
        ],
      });
    });

    it(`accepts a valid ${type} clue with same-category operands`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "time",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "person", entry: "Maya" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized!.clues[0]).toEqual({
        id: "clue-1",
        text: `${type} clue.`,
        type,
        orderedCategoryId: "time",
        operands: [
          { categoryId: "person", entry: "Jordan" },
          { categoryId: "person", entry: "Maya" },
        ],
      });
    });

    it(`rejects a ${type} clue with a missing orderedCategoryId`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "person", entry: "Maya" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Logic grid clue 1: orderedCategoryId references an unknown category.");
    });

    it(`rejects a ${type} clue with an unknown orderedCategoryId`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "nope",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "person", entry: "Maya" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Logic grid clue 1: orderedCategoryId references an unknown category.");
    });

    it(`rejects a ${type} clue whose operand 1 belongs to the ordered category`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "person",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "object", entry: "Red Journal" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        `Logic grid clue 1: ordered operands cannot belong to the ordered category.`
      );
    });

    it(`rejects a ${type} clue whose operand 2 belongs to the ordered category`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "object",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "object", entry: "Red Journal" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        `Logic grid clue 1: ordered operands cannot belong to the ordered category.`
      );
    });

    it(`rejects a ${type} clue whose two operands are an exact duplicate`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({
          clues: [
            {
              text: `${type} clue.`,
              type,
              orderedCategoryId: "time",
              operands: [
                { categoryId: "person", entry: "Jordan" },
                { categoryId: "person", entry: "Jordan" },
              ],
            },
          ],
        })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Logic grid clue 1: operands must be unique.");
    });
  }
});

describe("validateLogicGridPuzzleData — orderedCategoryId only applies to ordered types", () => {
  const NON_ORDERED_FIXTURES: Record<string, Record<string, unknown>> = {
    textOnly: { text: "Plain clue.", type: "textOnly", operands: [] },
    same: {
      text: "Same clue.",
      type: "same",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "room", entry: "Library" },
      ],
    },
    notSame: {
      text: "notSame clue.",
      type: "notSame",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "room", entry: "Library" },
      ],
    },
    eitherOr: {
      text: "eitherOr clue.",
      type: "eitherOr",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    },
  };

  for (const [type, fixture] of Object.entries(NON_ORDERED_FIXTURES)) {
    it(`rejects a nonblank orderedCategoryId on a ${type} clue`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({ clues: [{ ...fixture, orderedCategoryId: "time" }] })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Logic grid clue 1: orderedCategoryId is only valid for ordered clue types."
      );
    });

    it(`accepts and normalizes away a blank orderedCategoryId on a ${type} clue`, () => {
      const result = validateLogicGridPuzzleData(
        baseData({ clues: [{ ...fixture, orderedCategoryId: "   " }] })
      );
      expect(result.valid).toBe(true);
      expect("orderedCategoryId" in result.normalized!.clues[0]).toBe(false);
    });
  }
});

describe("validateLogicGridPuzzleData — eitherOr", () => {
  it("accepts a valid eitherOr clue", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Maya carried the Silver Key or the Red Journal.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "object", entry: "Silver Key" },
              { categoryId: "object", entry: "Red Journal" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues[0]).toEqual({
      id: "clue-1",
      text: "Maya carried the Silver Key or the Red Journal.",
      type: "eitherOr",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    });
  });

  it("rejects eitherOr alternatives from different categories", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Bad eitherOr.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "object", entry: "Silver Key" },
              { categoryId: "room", entry: "Library" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: eitherOr alternatives must be from the same category.");
  });

  it("rejects eitherOr alternatives that match the subject's category", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Bad eitherOr.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "person", entry: "Jordan" },
              { categoryId: "person", entry: "Lena" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Logic grid clue 1: eitherOr alternatives must differ from the subject's category."
    );
  });

  it("rejects eitherOr alternatives that are the same entry", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Bad eitherOr.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "object", entry: "Silver Key" },
              { categoryId: "object", entry: "Silver Key" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    // Duplicate-operand detection fires before the alternatives-differ check.
    expect(result.error).toBe("Logic grid clue 1: operands must be unique.");
  });

  it("rejects the wrong number of operands for eitherOr", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Bad eitherOr.",
            type: "eitherOr",
            operands: [
              { categoryId: "person", entry: "Maya" },
              { categoryId: "object", entry: "Silver Key" },
            ],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: eitherOr clues require exactly 3 operands.");
  });
});

describe("validateLogicGridPuzzleData — textOnly", () => {
  it("rejects a textOnly structured clue that supplies operands", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
        clues: [
          {
            text: "Not really text only.",
            type: "textOnly",
            operands: [{ categoryId: "person", entry: "Maya" }],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid clue 1: textOnly clues require exactly 0 operands.");
  });

  it("accepts a textOnly structured clue with an omitted operands field", () => {
    const result = validateLogicGridPuzzleData(baseData({ clues: [{ text: "Fine.", type: "textOnly" }] }));
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues[0].operands).toEqual([]);
  });
});

describe("validateLogicGridPuzzleData — mixed legacy and structured clues", () => {
  it("normalizes a mix of legacy strings and structured clues together, preserving source order", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
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
          "Theo did not carry the Silver Key.",
        ],
      })
    );
    expect(result.valid).toBe(true);
    expect(result.normalized!.clues.map((c) => c.id)).toEqual(["clue-1", "clue-2", "clue-3"]);
    expect(result.normalized!.clues[0].type).toBe("textOnly");
    expect(result.normalized!.clues[1].type).toBe("same");
    expect(result.normalized!.clues[2].type).toBe("textOnly");
  });
});

describe("validateLogicGridPuzzleData — category and solution validation is preserved", () => {
  it("still rejects too few categories", () => {
    const result = validateLogicGridPuzzleData(baseData({ categories: CATEGORIES.slice(0, 2) }));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid must have between 3 and 6 categories.");
  });

  it("still rejects a missing solution when required", () => {
    const { solution: _omit, ...rest } = baseData();
    const result = validateLogicGridPuzzleData(rest);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Logic grid requires puzzleData.solution.");
  });

  it("still validates a correct full puzzle including structured clues", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
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
      })
    );
    expect(result.valid).toBe(true);
    expect(result.normalized!.solution).toEqual(SOLUTION);
  });

  it("allows requireSolution: false to skip solution validation for structured-clue data", () => {
    const { solution: _omit, ...rest } = baseData({
      clues: [{ text: "Some clue.", type: "textOnly", operands: [] }],
    });
    const result = validateLogicGridPuzzleData(rest, { requireSolution: false });
    expect(result.valid).toBe(true);
    expect(result.normalized!.solution).toBeUndefined();
  });
});

describe("stripLogicGridSolution", () => {
  it("returns exactly {intro, categories, clues} with no solution key", () => {
    const result = validateLogicGridPuzzleData(
      baseData({
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
      })
    );
    expect(result.valid).toBe(true);
    const stripped = stripLogicGridSolution(result.normalized!);
    expect(Object.keys(stripped).sort()).toEqual(["categories", "clues", "intro"]);
    expect((stripped as { solution?: unknown }).solution).toBeUndefined();
    expect(stripped.clues).toEqual([
      { id: "clue-1", text: "Maya did not enter the Vault.", type: "textOnly", operands: [] },
      {
        id: "clue-2",
        text: "The Library visitor arrived at 8:00.",
        type: "same",
        operands: [
          { categoryId: "room", entry: "Library" },
          { categoryId: "time", entry: "8:00" },
        ],
      },
    ]);
  });

  it("reconstructs each clue explicitly (a mutation to the returned clue does not affect the source)", () => {
    const result = validateLogicGridPuzzleData(baseData());
    const stripped = stripLogicGridSolution(result.normalized!);
    (stripped.clues[0] as { text: string }).text = "mutated";
    expect(result.normalized!.clues[0].text).not.toBe("mutated");
  });

  it("omits orderedCategoryId from clue types that don't use it", () => {
    const result = validateLogicGridPuzzleData(baseData());
    const stripped = stripLogicGridSolution(result.normalized!);
    expect("orderedCategoryId" in stripped.clues[0]).toBe(false);
  });
});
