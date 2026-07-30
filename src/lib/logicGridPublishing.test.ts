import { validateLogicGridForPublication, LOGIC_GRID_PLACEHOLDER_ANSWER } from "./logicGridPublishing";
import {
  MIDNIGHT_EXHIBITION_DRAFT_DATA,
  MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION,
} from "./logicGridDrafts/midnightExhibition";

function cloneDraft(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(MIDNIGHT_EXHIBITION_DRAFT_DATA));
}

describe("LOGIC_GRID_PLACEHOLDER_ANSWER", () => {
  it("is the exact placeholder constant", () => {
    expect(LOGIC_GRID_PLACEHOLDER_ANSWER).toBe("__LOGIC_GRID__");
  });
});

describe("validateLogicGridForPublication — ready case (frozen Midnight Exhibition draft)", () => {
  it("returns valid:true with normalized data, solution, and matching witness", () => {
    const result = validateLogicGridForPublication(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("expected valid result");

    expect(result.normalized).toBeTruthy();
    expect(result.normalized.solution).toBeTruthy();
    expect(result.normalized.solution).toEqual(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
    expect(result.witness).toEqual(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
  });
});

describe("validateLogicGridForPublication — missing solution", () => {
  it("fails even though the clue set remains unique, because publication requires a stored answer key", () => {
    const draft = cloneDraft();
    delete draft.solution;
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    expect(result.error).toContain("Logic Grid publication validation failed");
  });
});

describe("validateLogicGridForPublication — incorrect authored solution", () => {
  it("fails with the exact authored-solution mismatch error", () => {
    const draft = cloneDraft();
    // Structurally valid, still bijective, but wrong: swap Jordan/Theo's room+object.
    draft.solution = {
      Maya: { room: "Observatory", time: "8:00", object: "Brass Compass" },
      Jordan: { room: "Gallery", time: "8:30", object: "Red Journal" },
      Lena: { room: "Vault", time: "9:30", object: "Silver Key" },
      Theo: { room: "Library", time: "9:00", object: "Glass Eye" },
    };
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    expect(result.error).toBe(
      "Authored Logic Grid solution does not match the unique clue-derived solution."
    );
    expect(result.uniquenessStatus).toBe("unique");
  });
});

describe("validateLogicGridForPublication — ambiguous clues", () => {
  it("fails with uniquenessStatus 'ambiguous' when a required clue is removed", () => {
    const draft = cloneDraft();
    draft.clues = (draft.clues as Array<{ id: string }>).filter(
      (c) => c.id !== "midnight-07-library-after-maya"
    );
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    expect(result.uniquenessStatus).toBe("ambiguous");
    expect(result.error).toBe("Logic Grid clue set is ambiguous and cannot be published.");
  });
});

describe("validateLogicGridForPublication — contradictory clues", () => {
  it("fails with uniquenessStatus 'contradictory' when a clue contradicts an existing relationship", () => {
    const draft = cloneDraft();
    const contradiction = {
      id: "midnight-08-contradiction",
      text: "Maya did not carry the Brass Compass.",
      type: "notSame",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Brass Compass" },
      ],
    };
    draft.clues = [...(draft.clues as unknown[]), contradiction];
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    expect(result.uniquenessStatus).toBe("contradictory");
    expect(result.error).toBe("Logic Grid clue set is contradictory and cannot be published.");
  });
});

describe("validateLogicGridForPublication — unsupported textOnly clue", () => {
  it("fails as unsupported when a structured clue is replaced with a legacy string, without parsing it", () => {
    const draft = cloneDraft();
    const clues = draft.clues as unknown[];
    clues[0] = "Maya carried the Brass Compass, or so everyone believed at first.";
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    expect(result.uniquenessStatus).toBe("unsupported");
    expect(result.error).toBe(
      "Logic Grid publication requires exactly one solution derived entirely from structured clues."
    );
  });
});

describe("validateLogicGridForPublication — malformed data", () => {
  it("fails for null data", () => {
    const result = validateLogicGridForPublication(null);
    expect(result.valid).toBe(false);
  });

  it("fails for missing categories", () => {
    const draft = cloneDraft();
    delete (draft as Record<string, unknown>).categories;
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
  });

  it("fails for missing clues", () => {
    const draft = cloneDraft();
    delete (draft as Record<string, unknown>).clues;
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
  });

  it("fails for an invalid (non-bijective) solution", () => {
    const draft = cloneDraft();
    draft.solution = {
      Maya: { room: "Observatory", time: "8:00", object: "Brass Compass" },
      Jordan: { room: "Observatory", time: "8:30", object: "Glass Eye" },
      Lena: { room: "Vault", time: "9:30", object: "Silver Key" },
      Theo: { room: "Gallery", time: "9:00", object: "Red Journal" },
    };
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
  });

  it("fails for a duplicate clue ID", () => {
    const draft = cloneDraft();
    const clues = draft.clues as Array<{ id: string }>;
    clues[1] = { ...clues[1], id: clues[0].id };
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
  });

  it("fails for an unknown operand entry", () => {
    const draft = cloneDraft();
    const clues = draft.clues as Array<{ operands: Array<{ entry: string }> }>;
    clues[0].operands[1].entry = "Not A Real Object";
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
  });
});

describe("validateLogicGridForPublication — input safety", () => {
  it("does not mutate the draft input", () => {
    const draft = cloneDraft();
    const snapshot = JSON.parse(JSON.stringify(draft));
    validateLogicGridForPublication(draft);
    expect(draft).toEqual(snapshot);
  });

  it("does not mutate the frozen draft module export", () => {
    const snapshot = JSON.parse(JSON.stringify(MIDNIGHT_EXHIBITION_DRAFT_DATA));
    validateLogicGridForPublication(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    expect(MIDNIGHT_EXHIBITION_DRAFT_DATA).toEqual(snapshot);
  });

  it("returned witnesses across repeated calls do not share mutable state", () => {
    const first = validateLogicGridForPublication(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    if (!first.valid) throw new Error("expected valid result");
    (first.witness as Record<string, unknown>).Maya = { room: "Vault", time: "9:30", object: "Silver Key" };

    const second = validateLogicGridForPublication(MIDNIGHT_EXHIBITION_DRAFT_DATA);
    if (!second.valid) throw new Error("expected valid result");
    expect(second.witness).toEqual(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
  });

  it("error messages never contain the expected solution serialized as JSON", () => {
    const draft = cloneDraft();
    delete draft.solution;
    const result = validateLogicGridForPublication(draft);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("expected invalid result");
    const solutionJson = JSON.stringify(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
    expect(result.error).not.toContain(solutionJson);
    expect(result.error).not.toContain("Silver Key");
  });
});
