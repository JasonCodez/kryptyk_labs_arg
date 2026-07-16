import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { POST } from "./route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/notification-service", () => ({ notifyPuzzleRelease: jest.fn() }));
jest.mock("@/lib/detectiveCase", () => ({ getDetectiveCaseData: jest.fn() }));
jest.mock("@/lib/gridlockFile", () => ({ getGridlockFileData: jest.fn() }));
jest.mock("@/lib/parasiteCode", () => ({ getParasiteCodeData: jest.fn() }));
jest.mock("@/lib/vault", () => ({ getVaultPuzzleData: jest.fn() }));
jest.mock("@/lib/wordSearchCore", () => ({ validateWordSearchPuzzleData: jest.fn() }));
jest.mock("@/lib/crosswordCore", () => ({ validateCrosswordPuzzleData: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    puzzleCategory: { findFirst: jest.fn(), create: jest.fn() },
    puzzle: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    dailyPuzzleSlot: { upsert: jest.fn() },
    puzzleSchedule: { upsert: jest.fn() },
    jigsawPuzzle: { findUnique: jest.fn() },
  },
}));

const mockedGetServerSession = getServerSession as jest.Mock;
const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
};

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/puzzles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetServerSession.mockResolvedValue({ user: { email: "admin@example.test" } });
  db.user.findUnique.mockResolvedValue({ role: "admin" });
});

describe("POST /api/admin/puzzles — jigsaw grid validation", () => {
  test.each([
    ["rectangular 3x4", { gridRows: 3, gridCols: 4 }],
    ["rectangular 4x6", { gridRows: 4, gridCols: 6 }],
    ["unsupported square size 1x1", { gridRows: 1, gridCols: 1 }],
    ["unsupported square size 16x16", { gridRows: 16, gridCols: 16 }],
    ["non-numeric rows", { gridRows: "abc", gridCols: 4 }],
  ])("rejects %s", async (_name, puzzleData) => {
    const response = await POST(postRequest({ title: "Test Jigsaw", puzzleType: "jigsaw", puzzleData }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Jigsaw grids must be square. Choose 2×2 through 15×15.");
  });

  test.each([2, 3, 4, 5, 6, 10, 15])("does not reject a square %dx%d grid at the validation step", async (size) => {
    const response = await POST(postRequest({ title: "Test Jigsaw", puzzleType: "jigsaw", puzzleData: { gridRows: size, gridCols: size } }));
    // A valid grid size must pass the square/size check — it may still fail later for
    // unrelated reasons in this minimal mock (e.g. category creation), but never with the
    // grid-shape error.
    if (response.status === 400) {
      const json = await response.json();
      expect(json.error).not.toBe("Jigsaw grids must be square. Choose 2×2 through 15×15.");
    }
  });
});
