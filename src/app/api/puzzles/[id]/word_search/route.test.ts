import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { POST } from "./route";
import { awardSeasonXp } from "@/lib/seasonXp";

jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {
  puzzle: { findUnique: jest.fn() },
  userPuzzleProgress: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  puzzleSubmission: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  user: { update: jest.fn(), findUnique: jest.fn() },
  globalLeaderboard: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
} }));
jest.mock("@/lib/requireAuthenticatedUser", () => ({ requireAuthenticatedUser: jest.fn(async () => ({ id: "user-1" })) }));
jest.mock("@/lib/requestSecurity", () => ({ validateSameOrigin: jest.fn(() => null) }));
jest.mock("@/lib/getXpMultiplier", () => ({ getXpMultiplier: jest.fn(async () => 1) }));
jest.mock("@/lib/seasonXp", () => ({ awardSeasonXp: jest.fn(async () => undefined) }));

const db = prisma as unknown as {
  puzzle: { findUnique: jest.Mock };
  userPuzzleProgress: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  puzzleSubmission: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  user: { update: jest.Mock; findUnique: jest.Mock };
  globalLeaderboard: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
};

const grid = [
  ["C", "A", "T"],
  ["D", "O", "G"],
  ["X", "X", "X"],
];

beforeEach(() => {
  jest.clearAllMocks();
  db.puzzle.findUnique.mockResolvedValue({ puzzleType: "word_search", data: { grid, words: ["CAT", "DOG"] }, xpReward: 50, solutions: [{ points: 100 }] });
  // Deliberately stale reads model two final requests racing before either sees solved=true.
  db.userPuzzleProgress.findUnique.mockResolvedValue({ id: "progress-1", solved: false });
  db.puzzleSubmission.findFirst.mockResolvedValue(null);
  db.puzzleSubmission.create.mockResolvedValue({ id: "submission" });
  db.puzzleSubmission.findMany.mockResolvedValue([{ answer: "CAT" }, { answer: "DOG" }]);
  db.userPuzzleProgress.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  db.userPuzzleProgress.update.mockResolvedValue({});
  db.user.findUnique.mockResolvedValue({ xp: 0 });
  db.user.update.mockResolvedValue({});
  db.globalLeaderboard.findFirst.mockResolvedValue({ id: "leaderboard-1" });
  db.globalLeaderboard.update.mockResolvedValue({});
});

function finalRequest() {
  return new NextRequest("http://localhost/api/puzzles/puzzle-1/word_search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ word: "DOG", cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }], allFoundWords: ["CAT", "DOG"] }),
  });
}

test("concurrent final selections can award catalog points and XP only once", async () => {
  const context = { params: Promise.resolve({ id: "puzzle-1" }) };
  const [first, second] = await Promise.all([POST(finalRequest(), context), POST(finalRequest(), context)]);
  expect(first.status).toBe(200); expect(second.status).toBe(200);
  expect(db.userPuzzleProgress.updateMany).toHaveBeenCalledTimes(2);
  expect(db.userPuzzleProgress.update).toHaveBeenCalledTimes(1);
  expect(db.globalLeaderboard.update).toHaveBeenCalledTimes(1);
  expect(awardSeasonXp).toHaveBeenCalledTimes(1);
});
