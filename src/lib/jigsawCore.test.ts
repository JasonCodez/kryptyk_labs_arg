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

  test("daily days and Warz instances produce different arrangements", () => {
    const dailyOne = jigsawGenerationSeed({ mode: "daily", puzzleId: "p", dailyDayNumber: 1 });
    const dailyTwo = jigsawGenerationSeed({ mode: "daily", puzzleId: "p", dailyDayNumber: 2 });
    const warzOne = jigsawGenerationSeed({ mode: "warz", puzzleId: "p", puzzleInstanceId: "round-1" });
    const warzTwo = jigsawGenerationSeed({ mode: "warz", puzzleId: "p", puzzleInstanceId: "round-2" });
    expect(shuffledJigsawIds(6, 8, dailyOne)).not.toEqual(shuffledJigsawIds(6, 8, dailyTwo));
    expect(shuffledJigsawIds(6, 8, warzOne)).not.toEqual(shuffledJigsawIds(6, 8, warzTwo));
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
