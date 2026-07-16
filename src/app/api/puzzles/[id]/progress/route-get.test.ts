import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { GET } from "./route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/requestSecurity", () => ({ validateSameOrigin: jest.fn(() => null) }));
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    userPuzzleProgress: { findUnique: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  userPuzzleProgress: { findUnique: jest.Mock };
};
const mockedSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSession.mockResolvedValue({ user: { email: "fresh@example.test" } });
  mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-fresh", email: "fresh@example.test" });
  mockedPrisma.userPuzzleProgress.findUnique.mockResolvedValue(null);
});

test("GET returns identity-complete default progress for a new player", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/puzzles/puzzle-fresh/progress"),
    { params: Promise.resolve({ id: "puzzle-fresh" }) },
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toMatchObject({
    id: null,
    userId: "user-fresh",
    puzzleId: "puzzle-fresh",
    solved: false,
    solvedAt: null,
    attempts: 0,
    failedAttempts: 0,
    successfulAttempts: 0,
    pointsEarned: 0,
    totalTimeSpent: 0,
    completionPercentage: 0,
    lastAttemptAt: null,
    averageTimePerAttempt: null,
    currentSessionStart: null,
    sudokuStartedAt: null,
    sudokuExpiresAt: null,
    sudokuLockedAt: null,
    sudokuLockReason: null,
    sessionLogs: [],
    partProgress: [],
  });
});
