import {
  buildJigsawEdges,
  calculateJigsawCompletion,
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
});
