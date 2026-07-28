import type { LogicGridCategoryNormalized } from "@/lib/logicGridCore";
import {
  applyLogicGridCellMark,
  deriveLogicGridState,
  getLogicGridCellKey,
  getNextLogicGridCellMark,
  normalizeLogicGridCellMarks,
  type LogicGridCellMarks,
} from "./logicGridGame";

const CATEGORIES: LogicGridCategoryNormalized[] = [
  { id: "person", name: "Guests", entries: ["Maya", "Jordan", "Lena", "Theo"] },
  { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
  { id: "time", name: "Arrival Times", entries: ["8:00", "8:30", "9:00", "9:30"] },
  { id: "object", name: "Objects", entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"] },
];

describe("getLogicGridCellKey", () => {
  test("returns the correct canonical key", () => {
    expect(getLogicGridCellKey(CATEGORIES, "person", "Maya", "room", "Observatory")).toBe(
      "person::Maya::room::Observatory"
    );
  });

  test("reversed category arguments normalize to the same key", () => {
    const forward = getLogicGridCellKey(CATEGORIES, "person", "Maya", "room", "Observatory");
    const reversed = getLogicGridCellKey(CATEGORIES, "room", "Observatory", "person", "Maya");
    expect(reversed).toBe(forward);
  });

  test("same-category pairing returns null", () => {
    expect(getLogicGridCellKey(CATEGORIES, "person", "Maya", "person", "Jordan")).toBeNull();
  });

  test("unknown category returns null", () => {
    expect(getLogicGridCellKey(CATEGORIES, "person", "Maya", "ghost", "X")).toBeNull();
  });

  test("unknown entry returns null", () => {
    expect(getLogicGridCellKey(CATEGORIES, "person", "Nobody", "room", "Observatory")).toBeNull();
  });
});

describe("getNextLogicGridCellMark", () => {
  test("follows exactly: undefined -> cross -> check -> undefined", () => {
    expect(getNextLogicGridCellMark(undefined)).toBe("cross");
    expect(getNextLogicGridCellMark("cross")).toBe("check");
    expect(getNextLogicGridCellMark("check")).toBeUndefined();
  });
});

describe("normalizeLogicGridCellMarks", () => {
  test("valid marks survive", () => {
    const input = { "person::Maya::room::Observatory": "check" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual(input);
  });

  test("invalid mark values drop", () => {
    const input = { "person::Maya::room::Observatory": "maybe" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual({});
  });

  test("invalid keys drop", () => {
    const input = { "not-a-real-key": "check", "person::Maya": "cross" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual({});
  });

  test("reversed noncanonical keys drop", () => {
    const input = { "room::Observatory::person::Maya": "check" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual({});
  });

  test("unknown categories drop", () => {
    const input = { "ghost::X::room::Observatory": "check" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual({});
  });

  test("unknown entries drop", () => {
    const input = { "person::Nobody::room::Observatory": "check" };
    expect(normalizeLogicGridCellMarks(input, CATEGORIES)).toEqual({});
  });

  test("does not mutate input", () => {
    const input = { "person::Maya::room::Observatory": "check" as const };
    const original = JSON.parse(JSON.stringify(input));
    normalizeLogicGridCellMarks(input, CATEGORIES);
    expect(input).toEqual(original);
  });

  test("non-object input returns an empty object", () => {
    expect(normalizeLogicGridCellMarks("nope", CATEGORIES)).toEqual({});
    expect(normalizeLogicGridCellMarks(null, CATEGORIES)).toEqual({});
    expect(normalizeLogicGridCellMarks([{ a: "check" }], CATEGORIES)).toEqual({});
  });
});

describe("applyLogicGridCellMark — cross move", () => {
  test("only the selected cell changes", () => {
    const result = applyLogicGridCellMark(CATEGORIES, {}, "person", "Maya", "room", "Observatory", "cross");
    expect(result.marks).toEqual({ "person::Maya::room::Observatory": "cross" });
    expect(result.changedKeys).toEqual(["person::Maya::room::Observatory"]);
  });

  test("no automatic elimination occurs", () => {
    const result = applyLogicGridCellMark(CATEGORIES, {}, "person", "Maya", "room", "Observatory", "cross");
    expect(result.autoEliminatedCount).toBe(0);
  });

  test("unrelated marks remain untouched", () => {
    const existing: LogicGridCellMarks = { "person::Jordan::room::Library": "check" };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "cross");
    expect(result.marks["person::Jordan::room::Library"]).toBe("check");
  });
});

describe("applyLogicGridCellMark — clear move", () => {
  test("only the selected cell is removed", () => {
    const existing: LogicGridCellMarks = {
      "person::Maya::room::Observatory": "cross",
      "person::Jordan::room::Library": "check",
    };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", undefined);
    expect(result.marks).toEqual({ "person::Jordan::room::Library": "check" });
    expect(result.changedKeys).toEqual(["person::Maya::room::Observatory"]);
  });

  test("unrelated marks remain", () => {
    const existing: LogicGridCellMarks = {
      "person::Maya::room::Observatory": "check",
      "person::Jordan::room::Library": "check",
    };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", undefined);
    expect(result.marks["person::Jordan::room::Library"]).toBe("check");
  });

  test("input marks are not mutated", () => {
    const existing: LogicGridCellMarks = { "person::Maya::room::Observatory": "cross" };
    const original = { ...existing };
    applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", undefined);
    expect(existing).toEqual(original);
  });
});

describe("applyLogicGridCellMark — check propagation", () => {
  test("selected cell becomes check; row and column become cross; unrelated blocks untouched", () => {
    const existing: LogicGridCellMarks = {
      "person::Jordan::time::8:00": "check", // unrelated person-vs-time block
    };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "check");

    expect(result.marks["person::Maya::room::Observatory"]).toBe("check");
    // Row: Maya vs other rooms -> cross
    expect(result.marks["person::Maya::room::Library"]).toBe("cross");
    expect(result.marks["person::Maya::room::Vault"]).toBe("cross");
    expect(result.marks["person::Maya::room::Gallery"]).toBe("cross");
    // Column: other guests vs Observatory -> cross
    expect(result.marks["person::Jordan::room::Observatory"]).toBe("cross");
    expect(result.marks["person::Lena::room::Observatory"]).toBe("cross");
    expect(result.marks["person::Theo::room::Observatory"]).toBe("cross");
    // Unrelated pair block preserved
    expect(result.marks["person::Jordan::time::8:00"]).toBe("check");
  });

  test("an existing conflicting check in the row/column becomes cross", () => {
    const existing: LogicGridCellMarks = { "person::Maya::room::Library": "check" };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "check");
    expect(result.marks["person::Maya::room::Library"]).toBe("cross");
  });

  test("already-cross cells are not counted again and not re-added to changedKeys", () => {
    const existing: LogicGridCellMarks = { "person::Maya::room::Library": "cross" };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "check");
    expect(result.changedKeys).not.toContain("person::Maya::room::Library");
  });

  test("autoEliminatedCount reflects only newly-crossed cells, not the selected cell", () => {
    // Fresh grid: row has 3 others, column has 3 others = 6 auto-eliminations.
    const result = applyLogicGridCellMark(CATEGORIES, {}, "person", "Maya", "room", "Observatory", "check");
    expect(result.autoEliminatedCount).toBe(6);
  });

  test("autoEliminatedCount excludes cells that were already cross", () => {
    const existing: LogicGridCellMarks = {
      "person::Maya::room::Library": "cross",
      "person::Jordan::room::Observatory": "cross",
    };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "check");
    // 6 total row+column others minus the 2 already-cross = 4 newly eliminated.
    expect(result.autoEliminatedCount).toBe(4);
  });

  test("changedKeys is deterministic across repeated calls", () => {
    const first = applyLogicGridCellMark(CATEGORIES, {}, "person", "Maya", "room", "Observatory", "check");
    const second = applyLogicGridCellMark(CATEGORIES, {}, "person", "Maya", "room", "Observatory", "check");
    expect(second.changedKeys).toEqual(first.changedKeys);
  });

  test("does not mutate currentMarks", () => {
    const existing: LogicGridCellMarks = { "person::Maya::room::Library": "check" };
    const original = { ...existing };
    applyLogicGridCellMark(CATEGORIES, existing, "person", "Maya", "room", "Observatory", "check");
    expect(existing).toEqual(original);
  });

  test("invalid category/entry inputs return an unchanged copy with no changed keys", () => {
    const existing: LogicGridCellMarks = { "person::Maya::room::Library": "check" };
    const result = applyLogicGridCellMark(CATEGORIES, existing, "person", "Nobody", "room", "Observatory", "check");
    expect(result.marks).toEqual(existing);
    expect(result.marks).not.toBe(existing);
    expect(result.changedKeys).toEqual([]);
    expect(result.autoEliminatedCount).toBe(0);
  });
});

describe("deriveLogicGridState", () => {
  test("computes the correct total required facts", () => {
    const state = deriveLogicGridState(CATEGORIES, {});
    // 4 primary entries x 3 non-primary categories
    expect(state.totalFacts).toBe(12);
  });

  test("empty grid gives zero progress", () => {
    const state = deriveLogicGridState(CATEGORIES, {});
    expect(state.confirmedFacts).toBe(0);
    expect(state.progressPercent).toBe(0);
    expect(state.complete).toBe(false);
  });

  test("one valid primary confirmation increments one fact", () => {
    const marks: LogicGridCellMarks = { "person::Maya::room::Observatory": "check" };
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.confirmedFacts).toBe(1);
    expect(state.answer.Maya.room).toBe("Observatory");
  });

  test("non-primary-versus-non-primary checks do not affect progress", () => {
    const marks: LogicGridCellMarks = { "room::Observatory::time::8:00": "check" };
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.confirmedFacts).toBe(0);
  });

  test("multiple checks in one primary pairing do not count", () => {
    const marks: LogicGridCellMarks = {
      "person::Maya::room::Observatory": "check",
      "person::Maya::room::Library": "check",
    };
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.confirmedFacts).toBe(0);
    expect(state.answer.Maya.room).toBeUndefined();
  });

  test("complete primary mapping produces complete: true", () => {
    const marks: LogicGridCellMarks = {};
    const people = ["Maya", "Jordan", "Lena", "Theo"];
    const rooms = ["Observatory", "Library", "Vault", "Gallery"];
    const times = ["8:00", "8:30", "9:00", "9:30"];
    const objects = ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"];
    people.forEach((person, i) => {
      marks[`person::${person}::room::${rooms[i]}`] = "check";
      marks[`person::${person}::time::${times[i]}`] = "check";
      marks[`person::${person}::object::${objects[i]}`] = "check";
    });
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.complete).toBe(true);
    expect(state.confirmedFacts).toBe(12);
  });

  test("answer format matches the server contract", () => {
    const marks: LogicGridCellMarks = { "person::Maya::room::Observatory": "check" };
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.answer).toEqual({
      Maya: { room: "Observatory" },
      Jordan: {},
      Lena: {},
      Theo: {},
    });
  });

  test("case rows preserve category and primary-entry order", () => {
    const marks: LogicGridCellMarks = {
      "person::Jordan::room::Library": "check",
      "person::Jordan::time::8:00": "check",
      "person::Maya::object::Silver Key": "check",
    };
    const state = deriveLogicGridState(CATEGORIES, marks);
    expect(state.caseRows.map((r) => r.primaryEntry)).toEqual(["Maya", "Jordan", "Lena", "Theo"]);

    const jordanRow = state.caseRows.find((r) => r.primaryEntry === "Jordan")!;
    expect(jordanRow.facts.map((f) => f.categoryId)).toEqual(["room", "time"]);
    expect(jordanRow.facts[0]).toEqual({ categoryId: "room", categoryName: "Rooms", value: "Library" });

    const mayaRow = state.caseRows.find((r) => r.primaryEntry === "Maya")!;
    expect(mayaRow.facts).toEqual([{ categoryId: "object", categoryName: "Objects", value: "Silver Key" }]);
  });

  test("does not require or reference any solution data", () => {
    const state = deriveLogicGridState(CATEGORIES, {});
    expect(state).not.toHaveProperty("solution");
  });
});
