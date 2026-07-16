import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { GET, POST } from "./route";

jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {
  puzzle: { findUnique: jest.fn() },
  userPuzzleProgress: { upsert: jest.fn(), updateMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  puzzleSubmission: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  user: { update: jest.fn(), findUnique: jest.fn() },
  globalLeaderboard: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  userSeasonPass: { findFirst: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
} }));
jest.mock("@/lib/requireAuthenticatedUser", () => ({ requireAuthenticatedUser: jest.fn(async () => ({ id: "user-1" })) }));
jest.mock("@/lib/requestSecurity", () => ({ validateSameOrigin: jest.fn(() => null) }));

type MockDatabase = {
  puzzle: { findUnique: jest.Mock };
  userPuzzleProgress: { upsert: jest.Mock; updateMany: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  puzzleSubmission: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  user: { update: jest.Mock; findUnique: jest.Mock };
  globalLeaderboard: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  userSeasonPass: { findFirst: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};
const db = prisma as unknown as MockDatabase;
const grid = [
  ["C", "A", "T"],
  ["D", "O", "G"],
  ["X", "X", "X"],
];

beforeEach(() => {
  jest.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: (tx: MockDatabase) => unknown) => callback(db));
  db.puzzle.findUnique.mockResolvedValue({ puzzleType: "word_search", data: { grid, words: ["CAT", "DOG"] }, xpReward: 50, solutions: [{ points: 100 }] });
  db.userPuzzleProgress.upsert.mockResolvedValue({ id: "progress-1", solved: false });
  db.userPuzzleProgress.updateMany.mockResolvedValue({ count: 1 });
  db.userPuzzleProgress.update.mockResolvedValue({});
  db.userPuzzleProgress.findUnique.mockResolvedValue({ solved: true });
  db.puzzleSubmission.findFirst.mockResolvedValue(null);
  db.puzzleSubmission.create.mockResolvedValue({ id: "submission" });
  db.puzzleSubmission.findMany.mockResolvedValue([{ answer: "CAT" }, { answer: "DOG" }]);
  db.user.findUnique.mockResolvedValue({ xp: 0, xpBoostExpiresAt: null });
  db.user.update.mockResolvedValue({});
  db.globalLeaderboard.findFirst.mockResolvedValue({ id: "leaderboard-1" });
  db.globalLeaderboard.update.mockResolvedValue({});
  db.userSeasonPass.findFirst.mockResolvedValue(null);
  db.userSeasonPass.update.mockResolvedValue({});
});

function finalRequest() {
  return new NextRequest("http://localhost/api/puzzles/puzzle-1/word_search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ word: "DOG", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }], allFoundWords: ["CAT", "DOG"] }),
  });
}

async function postFinal() {
  return POST(finalRequest(), { params: Promise.resolve({ id: "puzzle-1" }) });
}

test("concurrent final selections award catalog points and XP only once", async () => {
  db.userPuzzleProgress.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  const [first, second] = await Promise.all([postFinal(), postFinal()]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(db.$transaction).toHaveBeenCalledTimes(2);
  expect(db.userPuzzleProgress.update).toHaveBeenCalledTimes(1);
  expect(db.user.update).toHaveBeenCalledTimes(1);
  expect(db.globalLeaderboard.update).toHaveBeenCalledTimes(1);
  expect(await first.json()).toMatchObject({ valid: true, persisted: true, completionCommitted: true });
});

test.each([
  ["PuzzleSubmission create failure", () => db.puzzleSubmission.create.mockRejectedValueOnce(new Error("submission failed"))],
  ["progress update failure", () => db.userPuzzleProgress.updateMany.mockRejectedValueOnce(new Error("progress failed"))],
  ["final reward failure", () => db.user.update.mockRejectedValueOnce(new Error("reward failed"))],
])("%s returns a recoverable non-success response", async (_label, arrange) => {
  arrange();
  const response = await postFinal();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ valid: false, persisted: false, completionCommitted: false, recoverable: true });
});

test("retry after a failed completion transaction commits rewards once", async () => {
  db.user.update.mockRejectedValueOnce(new Error("temporary reward failure")).mockResolvedValue({});
  const failed = await postFinal();
  expect(failed.status).toBe(503);

  const retried = await postFinal();
  expect(retried.status).toBe(200);
  expect(await retried.json()).toMatchObject({ persisted: true, completionCommitted: true });
  expect(db.globalLeaderboard.update).toHaveBeenCalledTimes(1);
});

test("active season XP is part of the completion transaction", async () => {
  db.userSeasonPass.findFirst.mockResolvedValue({
    id: "pass-1",
    seasonXp: 90,
    currentTier: 0,
    season: { tiers: [{ tierNumber: 1, xpRequired: 100 }, { tierNumber: 2, xpRequired: 200 }] },
  });
  const response = await postFinal();
  expect(response.status).toBe(200);
  expect(db.userSeasonPass.update).toHaveBeenCalledWith({ where: { id: "pass-1" }, data: { seasonXp: 140, currentTier: 1 } });
});

test("GET only reports allFound when submissions and durable progress agree", async () => {
  db.puzzleSubmission.findMany.mockResolvedValue([{ answer: "CAT" }, { answer: "DOG" }]);
  db.userPuzzleProgress.findUnique.mockResolvedValue({ solved: false });
  const context = { params: Promise.resolve({ id: "puzzle-1" }) };
  const partial = await GET(new NextRequest("http://localhost/api/puzzles/puzzle-1/word_search"), context);
  expect(await partial.json()).toMatchObject({ foundWords: ["CAT", "DOG"], allFound: false, completionCommitted: false });

  db.userPuzzleProgress.findUnique.mockResolvedValue({ solved: true });
  const complete = await GET(new NextRequest("http://localhost/api/puzzles/puzzle-1/word_search"), context);
  expect(await complete.json()).toMatchObject({ allFound: true, completionCommitted: true });
});
