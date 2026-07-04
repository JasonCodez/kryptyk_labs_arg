import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { GET } from "./route";

jest.mock("@/lib/requireAuthenticatedUser", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/dailyPuzzle", () => ({
  ...jest.requireActual("@/lib/dailyPuzzle"),
  getTodayDayNumber: jest.fn(() => 96),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    dailyPuzzleSlot: { findUnique: jest.fn() },
    puzzle: { findUnique: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  dailyPuzzleSlot: { findUnique: jest.Mock };
  puzzle: { findUnique: jest.Mock };
};
const mockedRequireAuthenticatedUser = requireAuthenticatedUser as jest.MockedFunction<
  typeof requireAuthenticatedUser
>;

const params = (type: string) => ({ params: Promise.resolve({ type }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireAuthenticatedUser.mockResolvedValue({ id: "user-1", name: "Player", email: "player@example.com" });
});

test("rejects an unknown puzzle type", async () => {
  const res = await GET(new NextRequest("http://localhost/api/daily/nope/content"), params("nope"));
  expect(res.status).toBe(400);
});

test("requires authentication — no content leaks to guests", async () => {
  mockedRequireAuthenticatedUser.mockResolvedValueOnce(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any
  );
  const res = await GET(new NextRequest("http://localhost/api/daily/sudoku/content"), params("sudoku"));
  expect(res.status).toBe(401);
  expect(mockedPrisma.dailyPuzzleSlot.findUnique).not.toHaveBeenCalled();
});

test("reports unavailable when no slot is scheduled for today", async () => {
  mockedPrisma.dailyPuzzleSlot.findUnique.mockResolvedValueOnce(null);
  const res = await GET(new NextRequest("http://localhost/api/daily/sudoku/content"), params("sudoku"));
  const json = await res.json();
  expect(json.available).toBe(false);
  expect(json.dayNumber).toBe(96);
});

test("sudoku: returns grid + solution directly", async () => {
  mockedPrisma.dailyPuzzleSlot.findUnique.mockResolvedValueOnce({ puzzleId: "puzzle-1" });
  mockedPrisma.puzzle.findUnique.mockResolvedValueOnce({
    id: "puzzle-1",
    sudoku: { puzzleGrid: "[[...]]", solutionGrid: "[[...]]", difficulty: "medium" },
  });

  const res = await GET(new NextRequest("http://localhost/api/daily/sudoku/content"), params("sudoku"));
  const json = await res.json();

  expect(json).toEqual({
    available: true,
    dayNumber: 96,
    puzzleId: "puzzle-1",
    puzzleGrid: "[[...]]",
    solutionGrid: "[[...]]",
    difficulty: "medium",
  });
});

test("crossword: only resolves puzzleId, no content payload", async () => {
  mockedPrisma.dailyPuzzleSlot.findUnique.mockResolvedValueOnce({ puzzleId: "puzzle-2" });

  const res = await GET(new NextRequest("http://localhost/api/daily/crossword/content"), params("crossword"));
  const json = await res.json();

  expect(json).toEqual({ available: true, dayNumber: 96, puzzleId: "puzzle-2" });
  expect(mockedPrisma.puzzle.findUnique).not.toHaveBeenCalled();
});

test("jigsaw: returns puzzleId plus image/grid config", async () => {
  mockedPrisma.dailyPuzzleSlot.findUnique.mockResolvedValueOnce({ puzzleId: "puzzle-3" });
  mockedPrisma.puzzle.findUnique.mockResolvedValueOnce({
    id: "puzzle-3",
    jigsaw: { imageUrl: "https://example.com/a.png", gridRows: 3, gridCols: 4, snapTolerance: 12, rotationEnabled: false },
  });

  const res = await GET(new NextRequest("http://localhost/api/daily/jigsaw/content"), params("jigsaw"));
  const json = await res.json();

  expect(json).toEqual({
    available: true,
    dayNumber: 96,
    puzzleId: "puzzle-3",
    imageUrl: "https://example.com/a.png",
    gridRows: 3,
    gridCols: 4,
    snapTolerance: 12,
    rotationEnabled: false,
  });
});
