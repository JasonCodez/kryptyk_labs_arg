import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { PUT } from "./route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/gridlockFile", () => ({ getGridlockFileData: jest.fn() }));
jest.mock("@/lib/parasiteCode", () => ({ getParasiteCodeData: jest.fn() }));
jest.mock("@/lib/vault", () => ({ getVaultPuzzleData: jest.fn() }));
jest.mock("@/lib/wordSearchCore", () => ({ validateWordSearchPuzzleData: jest.fn() }));
jest.mock("@/lib/crosswordCore", () => ({ validateCrosswordPuzzleData: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    puzzle: { findUnique: jest.fn(), update: jest.fn() },
    puzzleCategory: { findFirst: jest.fn(), create: jest.fn() },
    puzzleHint: { deleteMany: jest.fn(), createMany: jest.fn() },
    puzzleSolution: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    jigsawPuzzle: { upsert: jest.fn() },
    dailyPuzzleSlot: { upsert: jest.fn(), deleteMany: jest.fn() },
    puzzleSchedule: { upsert: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  puzzle: { findUnique: jest.Mock; update: jest.Mock };
  puzzleHint: { deleteMany: jest.Mock; createMany: jest.Mock };
  puzzleSolution: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  jigsawPuzzle: { upsert: jest.Mock };
  dailyPuzzleSlot: { upsert: jest.Mock; deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/puzzles/puzzle-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ id: "puzzle-1" }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetServerSession.mockResolvedValue({ user: { email: "admin@example.test" } });
  db.user.findUnique.mockResolvedValue({ role: "admin" });
  db.puzzle.findUnique.mockResolvedValue({ id: "puzzle-1" });
  db.puzzle.update.mockResolvedValue({});
  db.puzzleHint.deleteMany.mockResolvedValue({ count: 0 });
  db.puzzleHint.createMany.mockResolvedValue({ count: 0 });
  db.puzzleSolution.findFirst.mockResolvedValue(null);
  db.puzzleSolution.create.mockResolvedValue({});
  db.jigsawPuzzle.upsert.mockResolvedValue({});
  db.dailyPuzzleSlot.upsert.mockResolvedValue({});
  db.dailyPuzzleSlot.deleteMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
});

describe("PUT /api/admin/puzzles/[id] — jigsaw grid validation", () => {
  // This update path previously had no grid validation at all (silently coerced with
  // fallback defaults), unlike create — these tests guard the fix.
  test.each([
    ["rectangular 3x4", { gridRows: 3, gridCols: 4 }],
    ["rectangular 6x8", { gridRows: 6, gridCols: 8 }],
    ["unsupported square size 1x1", { gridRows: 1, gridCols: 1 }],
    ["unsupported square size 16x16", { gridRows: 16, gridCols: 16 }],
    ["missing grid dimensions", {}],
  ])("rejects %s", async (_name, puzzleData) => {
    const response = await PUT(putRequest({ puzzleType: "jigsaw", puzzleData }), params());
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw grids must be square. Choose 2×2 through 15×15.");
  });

  test.each([2, 3, 4, 5, 6, 10, 15])("does not reject a square %dx%d grid at the validation step", async (size) => {
    const response = await PUT(putRequest({ puzzleType: "jigsaw", puzzleData: { gridRows: size, gridCols: size } }), params());
    if (response.status === 400) {
      const json = await response.json();
      expect(json.error).not.toBe("Jigsaw grids must be square. Choose 2×2 through 15×15.");
    }
  });
});
