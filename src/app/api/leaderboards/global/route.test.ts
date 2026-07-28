import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { GET } from "./route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userSeasonPass: {
      findMany: jest.fn(),
    },
    userPuzzleProgress: {
      groupBy: jest.fn(),
    },
  },
}));

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/leaderboards/global");
}

function contaminatedUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "u1",
    name: "Alpha",
    image: null,
    totalPoints: 220,
    purchasedPoints: 170,
    activeFlair: "none",
    email: "u1.private@example.test",
    role: "user",
    provider: "credentials",
    token: "secret-token",
    isHidden: false,
    isBot: false,
    unknownField: "leak-value",
    nested: { email: "nested.private@example.test" },
    ...overrides,
  };
}

describe("GET /api/leaderboards/global", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    userSeasonPass: { findMany: jest.Mock };
    userPuzzleProgress: { groupBy: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("missing identity returns 401 with no Prisma query", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("direct session-ID request skips email lookup and drives userRank", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "viewer-1", email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "viewer-1", name: "Me", image: null, totalPoints: 100, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(body.userRank).toEqual(expect.objectContaining({ userId: "viewer-1" }));
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("email fallback viewer resolves ID with an ID-only lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "viewer-1" });
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "viewer-1", name: "Me", image: null, totalPoints: 100, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "viewer.private@example.test" },
      select: { id: true },
    });
    expect(body.userRank).toEqual(expect.objectContaining({ userId: "viewer-1" }));
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("unresolved email fallback returns 404 with no downstream queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.userPuzzleProgress.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.userSeasonPass.findMany).not.toHaveBeenCalled();
  });

  test("Global user query filters and selection are narrow", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([]);

    await GET(buildRequest());

    const call = mockedPrisma.user.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ isHidden: false, isBot: false, role: { not: "admin" } });
    expect(call.select).toEqual({
      id: true,
      name: true,
      image: true,
      totalPoints: true,
      purchasedPoints: true,
      activeFlair: true,
    });
    expect(JSON.stringify(call.select)).not.toMatch(/email|role|isHidden|isBot/i);
  });

  test("contaminated user serializer strips private and unknown fields", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([contaminatedUser()]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries).toEqual([
      {
        userId: "u1",
        userName: "Alpha",
        userImage: null,
        activeFlair: "none",
        isPremium: false,
        puzzlesSolved: 0,
        totalPoints: 50,
        rank: 1,
      },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/private@example\.test/);
    expect(JSON.stringify(body)).not.toMatch(/"provider"|"token"|"unknownField"|leak-value/);
  });

  test("unexpected hidden, bot, and admin rows are dropped and excluded downstream", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "public-1", name: "Public", image: null, totalPoints: 100, purchasedPoints: 0, activeFlair: "none" },
      { id: "hidden-1", name: "Hidden", image: null, totalPoints: 500, purchasedPoints: 0, activeFlair: "none", isHidden: true },
      { id: "bot-1", name: "Bot", image: null, totalPoints: 500, purchasedPoints: 0, activeFlair: "none", isBot: true },
      { id: "admin-1", name: "Admin", image: null, totalPoints: 500, purchasedPoints: 0, activeFlair: "none", role: "admin" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries.map((e: { userId: string }) => e.userId)).toEqual(["public-1"]);
    expect(body.entries[0].rank).toBe(1);
    expect(body.userRank).toBeNull();

    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).toEqual(["public-1"]);
    const premiumCall = mockedPrisma.userSeasonPass.findMany.mock.calls[0][0];
    expect(premiumCall.where.userId.in).toEqual(["public-1"]);
  });

  test("malformed user rows are dropped while the valid player remains", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      null,
      "invalid",
      { id: "", name: "Blank", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
      { id: "bad-name", name: 42, image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
      { id: "bad-image", name: "Name", image: 42, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
      { id: "bad-total", name: "Name", image: null, totalPoints: "10", purchasedPoints: 0, activeFlair: "none" },
      { id: "bad-purchased", name: "Name", image: null, totalPoints: 10, purchasedPoints: "0", activeFlair: "none" },
      { id: "bad-flair", name: "Name", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: 42 },
      { id: "valid-1", name: "Valid", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries.map((e: { userId: string }) => e.userId)).toEqual(["valid-1"]);
    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).toEqual(["valid-1"]);
  });

  test("duplicate mocked users collapse to one entry and one downstream ID", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "dup-1", name: "First", image: null, totalPoints: 100, purchasedPoints: 0, activeFlair: "none" },
      { id: "dup-1", name: "Second", image: null, totalPoints: 900, purchasedPoints: 0, activeFlair: "none" },
      { id: "other-1", name: "Other", image: null, totalPoints: 50, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries.map((e: { userId: string }) => e.userId)).toEqual(["dup-1", "other-1"]);
    expect(body.entries.find((e: { userId: string }) => e.userId === "dup-1")).toEqual(
      expect.objectContaining({ userName: "First", totalPoints: 100 })
    );
    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).toEqual(["dup-1", "other-1"]);
  });

  test("no safe users skips downstream queries and returns an empty leaderboard", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      null,
      { id: "hidden-1", name: "Hidden", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none", isHidden: true },
      { id: "bot-1", name: "Bot", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none", isBot: true },
      { id: "admin-1", name: "Admin", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none", role: "admin" },
    ]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ entries: [], userRank: null });
    expect(mockedPrisma.userPuzzleProgress.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.userSeasonPass.findMany).not.toHaveBeenCalled();
  });

  test("solved-count rows are validated before affecting puzzlesSolved", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "valid-1", name: "Valid", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([
      { userId: "valid-1", _count: { _all: 5 } },
      { userId: "unrelated-1", _count: { _all: 99 } },
      { userId: "", _count: { _all: 3 } },
      { userId: "valid-1-negative", _count: { _all: -1 } },
      { userId: "valid-1-noninteger", _count: { _all: 1.5 } },
      { userId: "valid-1-infinite", _count: { _all: Infinity } },
      null,
    ]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries[0]).toEqual(expect.objectContaining({ userId: "valid-1", puzzlesSolved: 5 }));
  });

  test("premium rows are validated before affecting isPremium", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "valid-1", name: "Valid", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([
      { userId: "valid-1" },
      { userId: "unrelated-1" },
      { userId: "" },
      null,
    ]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries[0]).toEqual(expect.objectContaining({ userId: "valid-1", isPremium: true }));
  });

  test("earned points, ranking, and puzzle count reflect existing formula", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alpha", image: null, totalPoints: 220, purchasedPoints: 170, activeFlair: "none" },
      { id: "u2", name: "Beta", image: null, totalPoints: 130, purchasedPoints: 120, activeFlair: "none" },
      { id: "u3", name: "Gamma", image: null, totalPoints: 900, purchasedPoints: 890, activeFlair: "none" },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([
      { userId: "u1", _count: { _all: 12 } },
      { userId: "u2", _count: { _all: 3 } },
    ]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries[0]).toEqual(
      expect.objectContaining({ userId: "u1", totalPoints: 50, puzzlesSolved: 12, rank: 1 })
    );
    expect(body.entries[1]).toEqual(
      expect.objectContaining({ userId: "u2", totalPoints: 10, puzzlesSolved: 3, rank: 2 })
    );
    // u3 has a huge raw totalPoints but almost all of it purchased, so earned points is lowest.
    expect(body.entries[2]).toEqual(
      expect.objectContaining({ userId: "u3", totalPoints: 10, puzzlesSolved: 0, rank: 3 })
    );
  });

  test.each([
    ["crown", "👑"],
    ["fire", "🔥"],
    ["lightning", "⚡"],
    ["warz_legend", "⚔️🏆"],
    ["none", "none"],
    [null, "none"],
    ["🎯", "🎯"],
    ["mystery-flair", "mystery-flair"],
  ])("flair %p resolves to %p", async (flair, expected) => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alpha", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: flair },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries[0].activeFlair).toBe(expected);
  });

  test("filtered or absent current player results in a null userRank", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "hidden-1" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "public-1", name: "Public", image: null, totalPoints: 10, purchasedPoints: 0, activeFlair: "none" },
      { id: "hidden-1", name: "Hidden", image: null, totalPoints: 500, purchasedPoints: 0, activeFlair: "none", isHidden: true },
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.userRank).toBeNull();
  });

  test("top-100 response contains exactly 100 entries and preserves a rank-101 userRank", async () => {
    const users = Array.from({ length: 101 }, (_, i) => ({
      id: `u${i}`,
      name: `Player ${i}`,
      image: null,
      // Descending totalPoints so u0 ranks 1st ... u100 ranks 101st (last).
      totalPoints: 1000 - i,
      purchasedPoints: 0,
      activeFlair: "none",
    }));
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "u100" } } as any);
    mockedPrisma.user.findMany.mockResolvedValueOnce(users);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(body.entries).toHaveLength(100);
    expect(body.entries.map((e: { userId: string }) => e.userId)).toEqual(
      users.slice(0, 100).map((u) => u.id)
    );
    expect(body.entries.find((e: { userId: string }) => e.userId === "u100")).toBeUndefined();
    expect(body.userRank).toEqual(expect.objectContaining({ userId: "u100", rank: 101 }));
  });

  test("internal failure returns a safe 500 without leaking the raw error", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.user.findMany.mockRejectedValueOnce(new Error("db exploded for leak@example.test"));

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch leaderboard" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
