import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { GET } from "./route";

jest.mock("@/lib/requireAuthenticatedUser", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    puzzleWarzChallenge: { findUnique: jest.fn() },
  },
}));

const db = prisma as unknown as {
  puzzleWarzChallenge: { findUnique: jest.Mock };
};

const mockedRequireAuthenticatedUser = requireAuthenticatedUser as jest.MockedFunction<
  typeof requireAuthenticatedUser
>;

function getRequest() {
  return new NextRequest("http://localhost/api/warz/challenge-1");
}

function params(id = "challenge-1") {
  return { params: Promise.resolve({ id }) };
}

function baseChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    status: "IN_PROGRESS",
    challengerTime: 42,
    challengerId: "challenger-1",
    opponentId: "opponent-1",
    puzzle: {
      id: "puzzle-1",
      title: "Test Puzzle",
      difficulty: "medium",
      puzzleType: "word_search",
      data: { grid: [["A"]], words: ["A"] },
      sudoku: null,
      jigsaw: null,
    },
    challenger: { id: "challenger-1", name: "Challenger", image: null, level: 1 },
    opponent: { id: "opponent-1", name: "Opponent", image: null, level: 1 },
    winner: null,
    invitedUser: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireAuthenticatedUser.mockResolvedValue({
    id: "opponent-1",
    name: "Opponent",
    email: "opponent@example.test",
  });
});

describe("GET /api/warz/[id]", () => {
  test("unauthenticated request retains current behavior", async () => {
    const { NextResponse } = await import("next/server");
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockedRequireAuthenticatedUser.mockResolvedValue(unauthorized);

    const response = await GET(getRequest(), params());
    expect(response.status).toBe(401);
    expect(db.puzzleWarzChallenge.findUnique).not.toHaveBeenCalled();
  });

  test("missing challenge retains current behavior", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(null);

    const response = await GET(getRequest(), params());
    expect(response.status).toBe(404);
  });

  test("challenger time remains hidden before completion", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({ status: "IN_PROGRESS", challengerTime: 99 })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.challengerTime).toBeNull();
  });

  test("challenger time is revealed after completion", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({ status: "COMPLETED", challengerTime: 99 })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.challengerTime).toBe(99);
  });

  test("data-based puzzle returns sanitized data", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({
        puzzle: {
          id: "puzzle-1",
          title: "Word Search",
          difficulty: "medium",
          puzzleType: "word_search",
          data: { grid: [["A"]], words: ["A"] },
          sudoku: null,
          jigsaw: null,
        },
      })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.data).toEqual({ grid: [["A"]], words: ["A"] });
  });

  test("hidden word raw word is absent and wordLength is present", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({
        puzzle: {
          id: "puzzle-1",
          title: "Hidden Word",
          difficulty: "medium",
          puzzleType: "word_crack",
          data: { word: "SECRET", hint: "a hint" },
          sudoku: null,
          jigsaw: null,
        },
      })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.data.word).toBeUndefined();
    expect(json.challenge.puzzle.data.wordLength).toBe(6);
  });

  test("sudoku challenge returns exact puzzleGrid and solutionGrid", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({
        puzzle: {
          id: "puzzle-1",
          title: "Sudoku",
          difficulty: "medium",
          puzzleType: "sudoku",
          data: null,
          sudoku: { puzzleGrid: "1,2,3", solutionGrid: "3,2,1" },
          jigsaw: null,
        },
      })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.sudoku).toEqual({ puzzleGrid: "1,2,3", solutionGrid: "3,2,1" });
  });

  test("jigsaw challenge returns exact jigsaw fields", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      baseChallenge({
        puzzle: {
          id: "puzzle-1",
          title: "Jigsaw",
          difficulty: "medium",
          puzzleType: "jigsaw",
          data: null,
          sudoku: null,
          jigsaw: {
            imageUrl: "https://example.test/image.png",
            gridRows: 4,
            gridCols: 5,
            snapTolerance: 12,
            rotationEnabled: true,
          },
        },
      })
    );

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.jigsaw).toEqual({
      imageUrl: "https://example.test/image.png",
      gridRows: 4,
      gridCols: 5,
      snapTolerance: 12,
      rotationEnabled: true,
    });
  });

  test("non-sudoku challenge safely returns sudoku: null", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(baseChallenge());

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.sudoku).toBeNull();
  });

  test("non-jigsaw challenge safely returns jigsaw: null", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(baseChallenge());

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(json.challenge.puzzle.jigsaw).toBeNull();
  });

  test("no additional unrelated puzzle fields appear", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(baseChallenge());

    const response = await GET(getRequest(), params());
    const json = await response.json();
    expect(Object.keys(json.challenge.puzzle).sort()).toEqual(
      ["id", "title", "difficulty", "puzzleType", "data", "sudoku", "jigsaw"].sort()
    );
  });

  test("finds challenge by the correct query and calls it with expected selection shape", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(baseChallenge());

    await GET(getRequest(), params("challenge-1"));
    expect(db.puzzleWarzChallenge.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "challenge-1" } })
    );
  });
});
