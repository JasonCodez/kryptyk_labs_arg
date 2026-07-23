import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { POST } from "./route";

jest.mock("@/lib/requireAuthenticatedUser", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    puzzleWarzChallenge: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    userPuzzleProgress: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const db = prisma as unknown as {
  puzzleWarzChallenge: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  userPuzzleProgress: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; update: jest.Mock };
  notification: { create: jest.Mock };
  $transaction: jest.Mock;
};

const mockedRequireAuthenticatedUser = requireAuthenticatedUser as jest.MockedFunction<
  typeof requireAuthenticatedUser
>;
const mockedValidateSameOrigin = validateSameOrigin as jest.MockedFunction<typeof validateSameOrigin>;

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/warz/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function openChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    puzzleId: "puzzle-1",
    status: "OPEN",
    expiresAt: new Date(Date.now() + 60_000),
    challengerId: "challenger-1",
    challengerWager: 50,
    invitedUserId: null,
    ...overrides,
  };
}

function updatedChallenge(puzzleOverrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    status: "IN_PROGRESS",
    opponentId: "opponent-1",
    puzzle: {
      id: "puzzle-1",
      title: "Test Puzzle",
      difficulty: "medium",
      puzzleType: "word_search",
      data: { grid: [["A"]], words: ["A"] },
      sudoku: null,
      jigsaw: null,
      ...puzzleOverrides,
    },
    challenger: { id: "challenger-1", name: "Challenger", image: null, level: 1 },
    opponent: { id: "opponent-1", name: "Opponent", image: null, level: 1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedValidateSameOrigin.mockReturnValue(null);
  mockedRequireAuthenticatedUser.mockResolvedValue({
    id: "opponent-1",
    name: "Opponent",
    email: "opponent@example.test",
  });
  db.puzzleWarzChallenge.findUnique.mockResolvedValue(openChallenge());
  db.puzzleWarzChallenge.findFirst.mockResolvedValue(null);
  db.userPuzzleProgress.findUnique.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ totalPoints: 100 });
  db.notification.create.mockResolvedValue({});
  db.$transaction.mockResolvedValue([{}, updatedChallenge()]);
});

describe("POST /api/warz/accept", () => {
  test("existing unauthenticated rejection", async () => {
    const { NextResponse } = await import("next/server");
    mockedRequireAuthenticatedUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(401);
  });

  test("existing challenge-not-open rejection", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(openChallenge({ status: "IN_PROGRESS" }));

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(409);
  });

  test("existing expired rejection", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      openChallenge({ expiresAt: new Date(Date.now() - 60_000) })
    );

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(409);
  });

  test("existing own-challenge rejection", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      openChallenge({ challengerId: "opponent-1" })
    );

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(400);
  });

  test("existing private-invitation rejection", async () => {
    db.puzzleWarzChallenge.findUnique.mockResolvedValue(
      openChallenge({ invitedUserId: "someone-else" })
    );

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(403);
  });

  test("existing insufficient-points rejection", async () => {
    db.user.findUnique.mockResolvedValue({ totalPoints: 10 });

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(400);
  });

  test("successful acceptance retains exact input contract and atomic wager deduction", async () => {
    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const transactionArg = db.$transaction.mock.calls[0][0];
    expect(Array.isArray(transactionArg)).toBe(true);
    expect(transactionArg).toHaveLength(2);
  });

  test("successful acceptance retains IN_PROGRESS status and authoritative opponent", async () => {
    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    const json = await response.json();
    expect(json.challenge.status).toBe("IN_PROGRESS");
    expect(json.challenge.opponent.id).toBe("opponent-1");
  });

  test("data-based puzzle returns sanitized data", async () => {
    db.$transaction.mockResolvedValue([{}, updatedChallenge()]);

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    const json = await response.json();
    expect(json.challenge.puzzle.data).toEqual({ grid: [["A"]], words: ["A"] });
  });

  test("hidden word raw word is absent and wordLength remains present", async () => {
    db.$transaction.mockResolvedValue([
      {},
      updatedChallenge({ puzzleType: "word_crack", data: { word: "SECRET", hint: "a hint" } }),
    ]);

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    const json = await response.json();
    expect(json.challenge.puzzle.data.word).toBeUndefined();
    expect(json.challenge.puzzle.data.wordLength).toBe(6);
  });

  test("sudoku acceptance response contains exact sudoku payload", async () => {
    db.$transaction.mockResolvedValue([
      {},
      updatedChallenge({
        puzzleType: "sudoku",
        data: null,
        sudoku: { puzzleGrid: "1,2,3", solutionGrid: "3,2,1" },
      }),
    ]);

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    const json = await response.json();
    expect(json.challenge.puzzle.sudoku).toEqual({ puzzleGrid: "1,2,3", solutionGrid: "3,2,1" });
  });

  test("jigsaw acceptance response contains exact jigsaw payload", async () => {
    db.$transaction.mockResolvedValue([
      {},
      updatedChallenge({
        puzzleType: "jigsaw",
        data: null,
        jigsaw: {
          imageUrl: "https://example.test/image.png",
          gridRows: 4,
          gridCols: 5,
          snapTolerance: 12,
          rotationEnabled: true,
        },
      }),
    ]);

    const response = await POST(postRequest({ challengeId: "challenge-1" }));
    const json = await response.json();
    expect(json.challenge.puzzle.jigsaw).toEqual({
      imageUrl: "https://example.test/image.png",
      gridRows: 4,
      gridCols: 5,
      snapTolerance: 12,
      rotationEnabled: true,
    });
  });

  test("no additional point deduction and no second transaction", async () => {
    await POST(postRequest({ challengeId: "challenge-1" }));
    expect(db.user.update).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totalPoints: { decrement: 50 } } })
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
