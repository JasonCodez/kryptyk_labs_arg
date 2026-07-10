import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { POST } from "./route";
import { GET as getTeamStats } from "../../teams/[id]/stats/route";

jest.mock("@/lib/requireAuthenticatedUser", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    storeItem: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userInventory: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userPuzzleProgress: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("POST /api/store/purchase", () => {
  const mockedPrisma = prisma as unknown as {
    storeItem: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    userInventory: { findUnique: jest.Mock; upsert: jest.Mock };
    team: { findUnique: jest.Mock; findMany: jest.Mock };
    userPuzzleProgress: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const mockedRequireAuthenticatedUser = requireAuthenticatedUser as jest.MockedFunction<
    typeof requireAuthenticatedUser
  >;
  const mockedValidateSameOrigin = validateSameOrigin as jest.MockedFunction<typeof validateSameOrigin>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidateSameOrigin.mockReturnValue(null);
  });

  test("deducts spendable balance without changing leaderboard-earned points math", async () => {
    mockedRequireAuthenticatedUser.mockResolvedValueOnce({
      id: "user-1",
      name: "Player",
      email: "player@example.com",
    });

    mockedPrisma.storeItem.findUnique.mockResolvedValueOnce({
      id: "item-1",
      key: "hint_token",
      name: "Hint Token",
      isActive: true,
      isConsumable: true,
      price: 50,
      metadata: { count: 1 },
    });

    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      totalPoints: 200,
      purchasedPoints: 125,
      warzChallengeSlots: 1,
      streakShields: 0,
      hintTokens: 0,
      skipTokens: 0,
      warzRematchTokens: 0,
    });

    mockedPrisma.user.update.mockReturnValue({});
    mockedPrisma.userInventory.upsert.mockReturnValue({});
    mockedPrisma.$transaction.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/store/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemKey: "hint_token" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "Purchased: Hint Token" });

    expect(mockedPrisma.user.findUnique.mock.calls[0][0].select).toMatchObject({
      totalPoints: true,
      purchasedPoints: true,
    });

    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          totalPoints: { decrement: 50 },
          purchasedPoints: { decrement: 50 },
          hintTokens: { increment: 1 },
        }),
      })
    );

    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("keeps team stats totalEarnedPoints unchanged before vs after a store purchase", async () => {
    let wallet = {
      totalPoints: 500,
      purchasedPoints: 320,
    };

    mockedRequireAuthenticatedUser.mockResolvedValue({
      id: "user-1",
      name: "Player",
      email: "player@example.com",
    });

    mockedPrisma.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      key: "hint_token",
      name: "Hint Token",
      isActive: true,
      isConsumable: true,
      price: 50,
      metadata: { count: 1 },
    });

    mockedPrisma.user.findUnique.mockImplementation(async () => ({
      totalPoints: wallet.totalPoints,
      purchasedPoints: wallet.purchasedPoints,
      warzChallengeSlots: 1,
      streakShields: 0,
      hintTokens: 0,
      skipTokens: 0,
      warzRematchTokens: 0,
    }));

    mockedPrisma.user.update.mockImplementation(({ data }: { data: { totalPoints?: { decrement?: number }; purchasedPoints?: { decrement?: number } } }) => {
      wallet = {
        totalPoints: wallet.totalPoints - (data.totalPoints?.decrement ?? 0),
        purchasedPoints: wallet.purchasedPoints - (data.purchasedPoints?.decrement ?? 0),
      };
      return {};
    });

    mockedPrisma.userInventory.upsert.mockReturnValue({});
    mockedPrisma.$transaction.mockResolvedValue([]);

    mockedPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      name: "Alpha",
      isPublic: true,
      members: [
        {
          userId: "user-1",
          role: "member",
          joinedAt: new Date("2026-01-10T00:00:00.000Z"),
          user: { id: "user-1", name: "Player", image: null },
        },
      ],
    });

    mockedPrisma.team.findMany.mockResolvedValue([
      {
        id: "team-1",
        members: [{ userId: "user-1", joinedAt: new Date("2026-01-10T00:00:00.000Z") }],
      },
    ]);

    mockedPrisma.userPuzzleProgress.findMany.mockImplementation(({ select }: { select: Record<string, unknown> }) => {
      if (select?.puzzle) {
        return [
          {
            userId: "user-1",
            pointsEarned: 100,
            solvedAt: new Date("2026-01-05T00:00:00.000Z"),
            puzzle: {
              id: "p-old",
              title: "Old Puzzle",
              puzzleType: "sudoku",
              difficulty: "easy",
            },
          },
          {
            userId: "user-1",
            pointsEarned: 200,
            solvedAt: new Date("2026-01-11T00:00:00.000Z"),
            puzzle: {
              id: "p-new",
              title: "New Puzzle",
              puzzleType: "sudoku",
              difficulty: "medium",
            },
          },
        ];
      }

      return [
        {
          userId: "user-1",
          pointsEarned: 100,
          solvedAt: new Date("2026-01-05T00:00:00.000Z"),
        },
        {
          userId: "user-1",
          pointsEarned: 200,
          solvedAt: new Date("2026-01-11T00:00:00.000Z"),
        },
      ];
    });

    const statsRequest = new NextRequest("http://localhost:3000/api/teams/team-1/stats");

    const beforeStatsResponse = await getTeamStats(statsRequest, {
      params: Promise.resolve({ id: "team-1" }),
    });
    const beforeStatsBody = await beforeStatsResponse.json();

    const purchaseRequest = new NextRequest("http://localhost:3000/api/store/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemKey: "hint_token" }),
    });

    const purchaseResponse = await POST(purchaseRequest);
    const purchaseBody = await purchaseResponse.json();

    const afterStatsResponse = await getTeamStats(statsRequest, {
      params: Promise.resolve({ id: "team-1" }),
    });
    const afterStatsBody = await afterStatsResponse.json();

    expect(beforeStatsResponse.status).toBe(200);
    expect(afterStatsResponse.status).toBe(200);
    expect(purchaseResponse.status).toBe(200);
    expect(purchaseBody).toEqual({ success: true, message: "Purchased: Hint Token" });

    expect(beforeStatsBody.totalEarnedPoints).toBe(200);
    expect(afterStatsBody.totalEarnedPoints).toBe(200);
    expect(afterStatsBody.totalEarnedPoints).toBe(beforeStatsBody.totalEarnedPoints);

    expect(wallet.totalPoints).toBe(450);
    expect(wallet.purchasedPoints).toBe(270);
  });

  test("rejects a direct purchase of an isExclusive item (season-pass / slot-machine grant-only cosmetics)", async () => {
    mockedRequireAuthenticatedUser.mockResolvedValueOnce({
      id: "user-1",
      name: "Player",
      email: "player@example.com",
    });

    mockedPrisma.storeItem.findUnique.mockResolvedValueOnce({
      id: "item-jackpot",
      key: "frame_jackpot_platinum",
      name: "Jackpot Platinum Frame",
      isActive: true,
      isExclusive: true,
      isConsumable: false,
      price: 0,
    });

    const request = new NextRequest("http://localhost/api/store/purchase", {
      method: "POST",
      body: JSON.stringify({ itemKey: "frame_jackpot_platinum" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Item not found or unavailable");
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.userInventory.upsert).not.toHaveBeenCalled();
  });
});
