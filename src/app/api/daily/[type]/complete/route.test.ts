import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { calcLevel } from "@/lib/levels";
import { awardSeasonXp } from "@/lib/seasonXp";
import { POST, GET } from "./route";

jest.mock("@/lib/requireAuthenticatedUser", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(),
}));

jest.mock("@/lib/levels", () => ({
  calcLevel: jest.fn(),
}));

jest.mock("@/lib/seasonXp", () => ({
  awardSeasonXp: jest.fn(),
}));

jest.mock("@/lib/dailyPuzzle", () => ({
  ...jest.requireActual("@/lib/dailyPuzzle"),
  getTodayDayNumber: jest.fn(() => 96),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    dailyPuzzleRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    globalLeaderboard: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockedPrisma = prisma as unknown as {
  dailyPuzzleRecord: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  user: { findUnique: jest.Mock; update: jest.Mock };
  globalLeaderboard: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

const mockedRequireAuthenticatedUser = requireAuthenticatedUser as jest.MockedFunction<
  typeof requireAuthenticatedUser
>;
const mockedValidateSameOrigin = validateSameOrigin as jest.MockedFunction<typeof validateSameOrigin>;
const mockedCalcLevel = calcLevel as jest.MockedFunction<typeof calcLevel>;
const mockedAwardSeasonXp = awardSeasonXp as jest.MockedFunction<typeof awardSeasonXp>;

const params = (type: string) => ({ params: Promise.resolve({ type }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockedValidateSameOrigin.mockReturnValue(null);
  mockedRequireAuthenticatedUser.mockResolvedValue({ id: "user-1", name: "Player", email: "player@example.com" });
  mockedCalcLevel.mockReturnValue({ level: 3, title: "Solver", currentXp: 0, nextLevelXp: 100, progress: 0 });
  mockedAwardSeasonXp.mockResolvedValue(undefined as unknown as void);
});

describe("POST /api/daily/[type]/complete", () => {
  test("rejects an unknown puzzle type before touching the DB", async () => {
    const req = new NextRequest("http://localhost/api/daily/not-a-type/complete", { method: "POST" });
    const res = await POST(req, params("not-a-type"));
    expect(res.status).toBe(400);
    expect(mockedPrisma.dailyPuzzleRecord.findUnique).not.toHaveBeenCalled();
  });

  test("first-ever completion: streak=1, day-1 reward, no shield consumed", async () => {
    mockedPrisma.dailyPuzzleRecord.findUnique.mockResolvedValueOnce(null); // not already recorded
    mockedPrisma.dailyPuzzleRecord.findFirst.mockResolvedValueOnce(null); // no prior record at all
    mockedPrisma.dailyPuzzleRecord.create.mockResolvedValueOnce({});
    mockedPrisma.dailyPuzzleRecord.findMany.mockResolvedValueOnce([{ dayNumber: 96 }]); // today's just-created row
    mockedPrisma.globalLeaderboard.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ xp: 0 });

    const req = new NextRequest("http://localhost/api/daily/sudoku/complete", { method: "POST" });
    const res = await POST(req, params("sudoku"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.shieldUsed).toBe(false);
    expect(json.reward).toEqual({ points: 50, xp: 25, streakDay: 1 });
    expect(mockedPrisma.dailyPuzzleRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", puzzleType: "sudoku", won: true, shieldUsed: false }),
    });
    expect(mockedPrisma.globalLeaderboard.create).toHaveBeenCalledWith({
      data: { userId: "user-1", totalPoints: 50 },
    });
  });

  test("already completed today: short-circuits without re-awarding", async () => {
    mockedPrisma.dailyPuzzleRecord.findUnique.mockResolvedValueOnce({ shieldUsed: false });

    const req = new NextRequest("http://localhost/api/daily/crossword/complete", { method: "POST" });
    const res = await POST(req, params("crossword"));
    const json = await res.json();

    expect(json.message).toBe("Already recorded");
    expect(mockedPrisma.dailyPuzzleRecord.create).not.toHaveBeenCalled();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  test("1-day gap consumes a streak shield and inserts a synthetic gap-day record", async () => {
    mockedPrisma.dailyPuzzleRecord.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.dailyPuzzleRecord.findFirst.mockResolvedValueOnce({ dayNumber: 94 }); // gap of 2 -> missed day 95
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ streakShields: 1 }); // shield-balance check
    mockedPrisma.$transaction.mockResolvedValueOnce([{}, {}]);
    mockedPrisma.dailyPuzzleRecord.create.mockResolvedValueOnce({});
    mockedPrisma.dailyPuzzleRecord.findMany.mockResolvedValueOnce([{ dayNumber: 96 }, { dayNumber: 95 }, { dayNumber: 94 }]);
    mockedPrisma.globalLeaderboard.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ xp: 100 }); // xp lookup for reward award

    const req = new NextRequest("http://localhost/api/daily/word_search/complete", { method: "POST" });
    const res = await POST(req, params("word_search"));
    const json = await res.json();

    expect(json.shieldUsed).toBe(true);
    expect(json.reward.streakDay).toBe(3); // day 94, synthetic 95, real 96 = 3-day streak
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
  });
});

describe("GET /api/daily/[type]/complete", () => {
  test("rejects an unknown puzzle type", async () => {
    const res = await GET(new NextRequest("http://localhost/api/daily/nope/complete"), params("nope"));
    expect(res.status).toBe(400);
  });

  test("reports independent streak/status per type", async () => {
    mockedPrisma.dailyPuzzleRecord.findUnique.mockResolvedValueOnce(null); // not completed today
    mockedPrisma.dailyPuzzleRecord.findMany.mockResolvedValueOnce([{ dayNumber: 95 }, { dayNumber: 94 }]);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ streakShields: 2, skipTokens: 1 });

    const res = await GET(new NextRequest("http://localhost/api/daily/jigsaw/complete"), params("jigsaw"));
    const json = await res.json();

    expect(json.completedToday).toBe(false);
    expect(json.streak).toBe(2);
    expect(json.streakShields).toBe(2);
    expect(json.skipTokens).toBe(1);
  });
});
