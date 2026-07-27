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
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
    },
    userSeasonPass: {
      findMany: jest.fn(),
    },
    userPuzzleProgress: {
      groupBy: jest.fn(),
    },
  },
}));

function safeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "u1",
    name: "Alpha",
    image: null,
    totalPoints: 140,
    purchasedPoints: 130,
    activeFlair: "none",
    email: "leaked.private@example.test",
    role: "admin",
    provider: "credentials",
    token: "secret-token",
    isHidden: false,
    isBot: false,
    ...overrides,
  };
}

describe("GET /api/leaderboards/following", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    follow: { findMany: jest.Mock };
    userSeasonPass: { findMany: jest.Mock };
    userPuzzleProgress: { groupBy: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("missing identity returns 401 with no Prisma calls", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.userPuzzleProgress.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.userSeasonPass.findMany).not.toHaveBeenCalled();
  });

  test("direct session-ID request skips email lookup and drives all queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "viewer-1", email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "viewer-1" })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ followerId: "viewer-1" }) })
    );
    expect(body.entries[0].isCurrentUser).toBe(true);
    expect(body.userRank).toEqual(body.entries[0]);
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("email fallback resolves ID with an ID-only lookup and drives downstream queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    mockedPrisma.follow.findMany.mockResolvedValueOnce([{ followingId: "u2" }]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "u1" }),
      safeUser({ id: "u2", name: "Beta" }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "viewer.private@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ followerId: "u1" }) })
    );
    expect(body.entries.find((e: any) => e.userId === "u1").isCurrentUser).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("unresolved email fallback returns 404 with no downstream queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockedPrisma.follow.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.userPuzzleProgress.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.userSeasonPass.findMany).not.toHaveBeenCalled();
  });

  test("follow query filters hidden and bot followed users with a narrow select", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([]);

    await GET();

    const call = mockedPrisma.follow.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      followerId: "viewer-1",
      following: { isHidden: false, isBot: false },
    });
    expect(call.select).toEqual({ followingId: true });
    expect(JSON.stringify(call.select)).not.toMatch(/email/i);
  });

  test("malformed and duplicate follow rows are excluded, valid IDs preserve first-seen order", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      null,
      "invalid",
      { followingId: "" },
      {},
      { followingId: "u2" },
      { followingId: "u3" },
      { followingId: "u2" },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "viewer-1" }),
      safeUser({ id: "u2", name: "Beta" }),
      safeUser({ id: "u3", name: "Gamma" }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    const userQueryCall = mockedPrisma.user.findMany.mock.calls[0][0];
    expect(userQueryCall.where.id.in).toEqual(["viewer-1", "u2", "u3"]);
    expect(body.followingCount).toBe(2);
  });

  test("user query allowlist filters visibility and selects exactly the allowed fields", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([{ followingId: "u2" }]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([]);

    await GET();

    const call = mockedPrisma.user.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      id: { in: ["viewer-1", "u2"] },
      isHidden: false,
      isBot: false,
    });
    expect(call.select).toEqual({
      id: true,
      name: true,
      image: true,
      totalPoints: true,
      purchasedPoints: true,
      activeFlair: true,
    });
  });

  test("contaminated user rows are serialized down to the public allowlist", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "viewer-1" })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body.entries[0]).sort()).toEqual(
      [
        "userId",
        "userName",
        "userImage",
        "activeFlair",
        "isPremium",
        "puzzlesSolved",
        "totalPoints",
        "rank",
        "isCurrentUser",
      ].sort()
    );
    expect(JSON.stringify(body)).not.toMatch(/leaked\.private@example\.test/);
    expect(JSON.stringify(body)).not.toMatch(/"role"|"provider"|"token"/);
  });

  test("unexpected hidden and bot rows are dropped from entries and downstream queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      { followingId: "u2" },
      { followingId: "u-hidden" },
      { followingId: "u-bot" },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "viewer-1" }),
      safeUser({ id: "u2", name: "Beta" }),
      safeUser({ id: "u-hidden", name: "Hidden", isHidden: true }),
      safeUser({ id: "u-bot", name: "Bot", isBot: true }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    const ids = body.entries.map((e: any) => e.userId);
    expect(ids).toEqual(["viewer-1", "u2"]);
    expect(ids).not.toContain("u-hidden");
    expect(ids).not.toContain("u-bot");

    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).not.toContain("u-hidden");
    expect(solvedCall.where.userId.in).not.toContain("u-bot");

    const premiumCall = mockedPrisma.userSeasonPass.findMany.mock.calls[0][0];
    expect(premiumCall.where.userId.in).not.toContain("u-hidden");
    expect(premiumCall.where.userId.in).not.toContain("u-bot");

    expect(body.followingCount).toBe(1);
  });

  test("unrelated user rows outside relevantIds are dropped", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "viewer-1" }),
      safeUser({ id: "unrelated-user", name: "Unrelated", email: "unrelated.private@example.test" }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries.map((e: any) => e.userId)).toEqual(["viewer-1"]);

    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).not.toContain("unrelated-user");
    expect(JSON.stringify(body)).not.toMatch(/unrelated\.private@example\.test/);
    expect(body.followingCount).toBe(0);
  });

  test("malformed user rows are dropped and only the valid user drives downstream queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      null,
      "invalid",
      safeUser({ id: "" }),
      safeUser({ id: "bad-name", name: 42 }),
      safeUser({ id: "bad-image", image: 42 }),
      safeUser({ id: "bad-points", totalPoints: "NaN" }),
      safeUser({ id: "bad-purchased", purchasedPoints: null }),
      safeUser({ id: "bad-flair", activeFlair: 42 }),
      safeUser({ id: "viewer-1" }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.map((e: any) => e.userId)).toEqual(["viewer-1"]);

    const solvedCall = mockedPrisma.userPuzzleProgress.groupBy.mock.calls[0][0];
    expect(solvedCall.where.userId.in).toEqual(["viewer-1"]);
  });

  test("no safe users skips downstream queries and returns an empty leaderboard", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([{ followingId: "u2" }]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "u2", isHidden: true }),
      safeUser({ id: "unrelated", email: "unrelated.private@example.test" }),
      null,
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ entries: [], userRank: null, followingCount: 0 });
    expect(mockedPrisma.userPuzzleProgress.groupBy).not.toHaveBeenCalled();
    expect(mockedPrisma.userSeasonPass.findMany).not.toHaveBeenCalled();
  });

  test("solved-count rows are validated before affecting puzzlesSolved", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "viewer-1" })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([
      { userId: "viewer-1", _count: { _all: 5 } },
      { userId: "unrelated-id", _count: { _all: 99 } },
      { userId: "", _count: { _all: 3 } },
      { userId: "viewer-1", _count: { _all: -1 } },
      { userId: "viewer-1", _count: { _all: 1.5 } },
      null,
    ]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries[0].puzzlesSolved).toBe(5);
  });

  test("premium rows are validated before affecting isPremium", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "viewer-1" })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([
      { userId: "viewer-1" },
      { userId: "unrelated-id" },
      { userId: "" },
      null,
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries[0].isPremium).toBe(true);
  });

  test("earned points and ranking are computed and sorted correctly", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([{ followingId: "u2" }]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "viewer-1", totalPoints: 140, purchasedPoints: 130 }),
      safeUser({ id: "u2", name: "Beta", totalPoints: 300, purchasedPoints: 50 }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries[0]).toEqual(
      expect.objectContaining({ userId: "u2", totalPoints: 250, rank: 1 })
    );
    expect(body.entries[1]).toEqual(
      expect.objectContaining({ userId: "viewer-1", totalPoints: 10, rank: 2 })
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
    ["unknown-value", "unknown-value"],
  ])("flair %p resolves to %p", async (flair, expected) => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "viewer-1", activeFlair: flair })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries[0].activeFlair).toBe(expected);
  });

  test("current-user rank matches the safe current-player entry, or null if absent", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([{ followingId: "u2" }]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([safeUser({ id: "u2", name: "Beta" })]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.entries[0].isCurrentUser).toBe(false);
    expect(body.userRank).toBeNull();
  });

  test("visible following count excludes hidden, bot, malformed, unrelated, self, and duplicate rows", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      { followingId: "u2" },
      { followingId: "u2" },
      { followingId: "viewer-1" },
      { followingId: "u-hidden" },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      safeUser({ id: "viewer-1" }),
      safeUser({ id: "u2", name: "Beta" }),
      safeUser({ id: "u-hidden", isHidden: true }),
    ]);
    mockedPrisma.userPuzzleProgress.groupBy.mockResolvedValueOnce([]);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(body.followingCount).toBe(1);
  });

  test("internal failure returns a safe 500 without leaking the raw error", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockRejectedValueOnce(
      new Error("db exploded for leak@example.test")
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch leaderboard" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
