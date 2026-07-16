/** @jest-environment jsdom */

import {
  jigsawStorageKey,
  restoreJigsawProgress,
  serializeJigsawProgress,
  validateJigsawSave,
  type JigsawPersistablePiece,
} from "./jigsawPersistence";

const basePieces: JigsawPersistablePiece[] = [
  { id: "0-0", row: 0, col: 0, correct: { x: 10, y: 10 }, pos: { x: 10, y: 10 }, groupId: "0-0", snapped: false, z: 1 },
  { id: "0-1", row: 0, col: 1, correct: { x: 110, y: 10 }, pos: { x: 110, y: 10 }, groupId: "0-1", snapped: false, z: 1 },
  { id: "1-0", row: 1, col: 0, correct: { x: 10, y: 110 }, pos: { x: 10, y: 110 }, groupId: "1-0", snapped: false, z: 1 },
  { id: "1-1", row: 1, col: 1, correct: { x: 110, y: 110 }, pos: { x: 110, y: 110 }, groupId: "1-1", snapped: false, z: 1 },
];

function restore(scope: "catalog" | "daily" | "none", day?: number) {
  return restoreJigsawProgress({ storage: localStorage, scope, puzzleId: "p", dailyDayNumber: day, signature: "sig", basePieces, stageWidth: 300, stageHeight: 300 });
}

describe("jigsawPersistence", () => {
  beforeEach(() => localStorage.clear());

  test("uses isolated versioned keys and disables Warz persistence", () => {
    expect(jigsawStorageKey("catalog", "p")).toBe("jigsaw-progress:v2:catalog:p");
    expect(jigsawStorageKey("daily", "p", 42)).toBe("jigsaw-progress:v2:daily:42:p");
    expect(jigsawStorageKey("daily", "p")).toBeNull();
    expect(jigsawStorageKey("none", "p")).toBeNull();
  });

  test("restores a valid save with elapsed time, groups, and coordinates", () => {
    const pieces = basePieces.map((piece) => ({ ...piece, pos: { x: piece.correct.x + 12, y: piece.correct.y + 8 } }));
    const save = serializeJigsawProgress({ signature: "sig", pieces, tray: ["0-0", "0-1", "1-0", "1-1"], elapsedMs: 12_345, savedAt: 100 });
    localStorage.setItem(jigsawStorageKey("catalog", "p")!, JSON.stringify(save));
    const result = restore("catalog");
    expect(result?.progress.elapsedMs).toBe(12_345);
    expect(result?.pieces[0].pos).toEqual({ x: 22, y: 18 });
  });

  test("new saves are version 3 and carry no zoom field", () => {
    const save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 0 });
    expect(save.version).toBe(3);
    expect(save).not.toHaveProperty("zoom");
  });

  test("accepts a version-2 save with a zoom field, ignores the zoom, and rewrites it as version 3", () => {
    const v3Save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 5_000 });
    const v2Payload = { ...v3Save, version: 2, zoom: 1.5 };
    localStorage.setItem(jigsawStorageKey("catalog", "p")!, JSON.stringify(v2Payload));
    const result = restore("catalog");
    expect(result?.progress.version).toBe(3);
    expect(result?.progress).not.toHaveProperty("zoom");
    expect(result?.progress.elapsedMs).toBe(5_000);
    expect(result?.pieces).toHaveLength(4);
  });

  test("same-day Daily restores but another day, Catalog and Warz cannot seed it", () => {
    const save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 10 });
    localStorage.setItem(jigsawStorageKey("daily", "p", 42)!, JSON.stringify(save));
    expect(restore("daily", 42)).not.toBeNull();
    expect(restore("daily", 43)).toBeNull();
    expect(restore("catalog")).toBeNull();
    expect(restore("none")).toBeNull();
  });

  test("migrates the old key only for Catalog", () => {
    const legacy = serializeJigsawProgress({ signature: "old", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 20 });
    const oldPayload = { ...legacy } as Partial<typeof legacy>;
    delete oldPayload.version;
    delete oldPayload.signature;
    localStorage.setItem("jigsaw-progress-p", JSON.stringify(oldPayload));
    expect(restore("daily", 42)).toBeNull();
    expect(localStorage.getItem("jigsaw-progress-p")).not.toBeNull();
    expect(restore("catalog")).not.toBeNull();
    expect(localStorage.getItem("jigsaw-progress-p")).toBeNull();
    expect(localStorage.getItem(jigsawStorageKey("catalog", "p")!)).not.toBeNull();
  });

  test.each([
    ["wrong signature", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, signature: "wrong" })],
    ["missing piece", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, pieces: { ...save.pieces, "1-1": undefined } })],
    ["duplicate tray", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, tray: ["0-0", "0-0"] })],
    ["invalid group", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, pieces: { ...save.pieces, "0-0": { ...save.pieces["0-0"], groupId: "missing" } } })],
    ["non-finite coordinate", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, pieces: { ...save.pieces, "0-0": { ...save.pieces["0-0"], relX: Number.NaN } } })],
    ["impossible disconnected group", (save: ReturnType<typeof serializeJigsawProgress>) => ({ ...save, pieces: { ...save.pieces, "0-0": { ...save.pieces["0-0"], groupId: "0-0" }, "1-1": { ...save.pieces["1-1"], groupId: "0-0" } }, tray: ["0-0", "0-1", "1-0"] })],
  ])("rejects %s", (_name, mutate) => {
    const save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 0 });
    expect(validateJigsawSave({ value: mutate(save), signature: "sig", basePieces, stageWidth: 300, stageHeight: 300 })).toBeNull();
  });

  test("clamps harmless loose coordinates", () => {
    const save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 0 });
    save.pieces["0-0"].relX = 100_000;
    const result = validateJigsawSave({ value: save, signature: "sig", basePieces, stageWidth: 300, stageHeight: 300 });
    expect(result?.pieces[0].pos.x).toBe(300);
  });

  test("changing grid size (e.g. legacy 3x4 -> 4x4) invalidates the old save and starts fresh", () => {
    // Simulate a legacy 3x4 grid's saved pieces (12 pieces).
    const threeByFourPieces: JigsawPersistablePiece[] = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        threeByFourPieces.push({ id: `${r}-${c}`, row: r, col: c, correct: { x: c * 100, y: r * 100 }, pos: { x: c * 100, y: r * 100 }, groupId: `${r}-${c}`, snapped: false, z: 1 });
      }
    }
    const legacySave = serializeJigsawProgress({ signature: "sig-3x4", pieces: threeByFourPieces, tray: threeByFourPieces.map((piece) => piece.id), elapsedMs: 999 });
    localStorage.setItem(jigsawStorageKey("catalog", "p")!, JSON.stringify(legacySave));

    // The puzzle has since been fixed to a square 4x4 grid (16 pieces) — jigsawPuzzleSignature
    // includes rows/cols, so the signature is always different once the grid size changes.
    const fourByFourBase: JigsawPersistablePiece[] = [];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        fourByFourBase.push({ id: `${r}-${c}`, row: r, col: c, correct: { x: c * 80, y: r * 80 }, pos: { x: c * 80, y: r * 80 }, groupId: `${r}-${c}`, snapped: false, z: 1 });
      }
    }
    const result = restoreJigsawProgress({ storage: localStorage, scope: "catalog", puzzleId: "p", signature: "sig-4x4", basePieces: fourByFourBase, stageWidth: 640, stageHeight: 640 });
    expect(result).toBeNull(); // must never restore 12-piece progress into a 16-piece puzzle
  });

  test("a square puzzle whose grid size did not change still restores valid progress", () => {
    const save = serializeJigsawProgress({ signature: "sig", pieces: basePieces, tray: basePieces.map((piece) => piece.id), elapsedMs: 42 });
    localStorage.setItem(jigsawStorageKey("catalog", "p")!, JSON.stringify(save));
    const result = restore("catalog");
    expect(result).not.toBeNull();
    expect(result?.progress.elapsedMs).toBe(42);
  });
});
