import {
  buildJigsawEdges,
  calculateJigsawCompletion,
  clampGroupToStage,
  jigsawGenerationSeed,
  shuffledJigsawIds,
  uniqueLooseGroupIds,
} from "./jigsawCore";

describe("jigsawCore", () => {
  test("seeded edges and tray order are deterministic and valid", () => {
    const firstEdges = [...buildJigsawEdges(4, 6, "same").entries()];
    const secondEdges = [...buildJigsawEdges(4, 6, "same").entries()];
    expect(secondEdges).toEqual(firstEdges);
    expect(shuffledJigsawIds(4, 6, "same")).toEqual(shuffledJigsawIds(4, 6, "same"));
    expect(new Set(shuffledJigsawIds(4, 6, "same")).size).toBe(24);

    const map = new Map(firstEdges);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const edge = map.get(`${row}-${col}`)!;
        if (row > 0) expect(edge.top).toBe(-map.get(`${row - 1}-${col}`)!.bottom);
        if (col > 0) expect(edge.left).toBe(-map.get(`${row}-${col - 1}`)!.right);
      }
    }
  });

  test("daily days produce different arrangements", () => {
    const dailyOne = jigsawGenerationSeed({ mode: "daily", puzzleId: "p", dailyDayNumber: 1 });
    const dailyTwo = jigsawGenerationSeed({ mode: "daily", puzzleId: "p", dailyDayNumber: 2 });
    expect(shuffledJigsawIds(6, 8, dailyOne)).not.toEqual(shuffledJigsawIds(6, 8, dailyTwo));
  });

  test("both players in a Warz challenge derive an identical seeded layout", () => {
    // Both the challenger and the opponent pass `shared:${puzzle.id}` as puzzleInstanceId
    // (see WarzPlayBoard.tsx) since the challenger plays before a challenge record/id exists.
    const challengerSeed = jigsawGenerationSeed({ mode: "warz", puzzleId: "p", puzzleInstanceId: "shared:p" });
    const opponentSeed = jigsawGenerationSeed({ mode: "warz", puzzleId: "p", puzzleInstanceId: "shared:p" });
    expect(challengerSeed).toBe(opponentSeed);
    expect(shuffledJigsawIds(6, 8, challengerSeed)).toEqual(shuffledJigsawIds(6, 8, opponentSeed));
    expect([...buildJigsawEdges(6, 8, challengerSeed).entries()]).toEqual([...buildJigsawEdges(6, 8, opponentSeed).entries()]);
  });

  test("Warz challenges for different puzzles still diverge", () => {
    const seedP = jigsawGenerationSeed({ mode: "warz", puzzleId: "p", puzzleInstanceId: "shared:p" });
    const seedQ = jigsawGenerationSeed({ mode: "warz", puzzleId: "q", puzzleInstanceId: "shared:q" });
    expect(shuffledJigsawIds(6, 8, seedP)).not.toEqual(shuffledJigsawIds(6, 8, seedQ));
  });

  test("completion and loose-group calculation do not duplicate groups", () => {
    const pieces = [
      { groupId: "0-0", snapped: false },
      { groupId: "0-0", snapped: false },
      { groupId: "0-1", snapped: false },
    ];
    expect(uniqueLooseGroupIds(pieces, ["0-1"])).toEqual(["0-1", "0-0"]);
    expect(calculateJigsawCompletion(pieces, [])).toEqual({ solved: false, placedPieces: 0 });
    expect(calculateJigsawCompletion(pieces.map((piece) => ({ ...piece, groupId: "0-0", snapped: true })), [])).toEqual({ solved: true, placedPieces: 3 });
  });

  describe("clampGroupToStage", () => {
    const PW = 80, PH = 80, STAGE_W = 640, STAGE_H = 800;

    test("a group already inside the stage is unchanged", () => {
      const members = [{ id: "a", x: 100, y: 100 }, { id: "b", x: 180, y: 100 }];
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      expect(result.get("a")).toEqual({ x: 100, y: 100 });
      expect(result.get("b")).toEqual({ x: 180, y: 100 });
    });

    test("a group below the stage is shifted upward as one unit", () => {
      const members = [{ id: "a", x: 100, y: 760 }, { id: "b", x: 100, y: 840 }];
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      // group spans y:760..920 (height 160); must end with bottom == STAGE_H == 800
      expect(result.get("a")!.y).toBeCloseTo(640);
      expect(result.get("b")!.y).toBeCloseTo(720);
      expect(result.get("b")!.y + PH).toBeCloseTo(STAGE_H);
      // x untouched
      expect(result.get("a")!.x).toBe(100);
    });

    test("a group beyond the left edge is shifted right as one unit", () => {
      const members = [{ id: "a", x: -50, y: 200 }, { id: "b", x: 30, y: 200 }];
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      expect(result.get("a")!.x).toBe(0);
      expect(result.get("b")!.x).toBe(80);
      expect(result.get("a")!.y).toBe(200);
    });

    test("a group beyond the right edge is shifted left as one unit", () => {
      const members = [{ id: "a", x: 600, y: 200 }, { id: "b", x: 680, y: 200 }];
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      // group right edge (680+80=760) must clamp to STAGE_W (640)
      expect(result.get("b")!.x + PW).toBeCloseTo(STAGE_W);
      expect(result.get("a")!.x).toBeCloseTo(result.get("b")!.x - 80);
    });

    test("a multi-piece group preserves all relative offsets", () => {
      const members = [
        { id: "a", x: 610, y: 770 },
        { id: "b", x: 690, y: 770 },
        { id: "c", x: 610, y: 850 },
      ];
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      const a = result.get("a")!, b = result.get("b")!, c = result.get("c")!;
      expect(b.x - a.x).toBe(80);
      expect(b.y - a.y).toBe(0);
      expect(c.x - a.x).toBe(0);
      expect(c.y - a.y).toBe(80);
    });

    test("a group larger than an available axis is handled predictably without NaN", () => {
      const members = [{ id: "a", x: 50, y: 50 }, { id: "b", x: 50 + 700, y: 50 }]; // spans 750px on a 640 stage
      const result = clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      expect(Number.isFinite(result.get("a")!.x)).toBe(true);
      expect(Number.isFinite(result.get("b")!.x)).toBe(true);
      expect(result.get("a")!.x).toBe(0); // anchored to the near edge, not centered/NaN
      expect(result.get("b")!.x - result.get("a")!.x).toBe(700); // relative offset still preserved
    });

    test("inputs remain immutable", () => {
      const members = [{ id: "a", x: -20, y: -20 }];
      const frozen = JSON.parse(JSON.stringify(members));
      clampGroupToStage(members, PW, PH, STAGE_W, STAGE_H);
      expect(members).toEqual(frozen);
    });
  });
});
