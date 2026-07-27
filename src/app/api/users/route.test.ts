import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { GET } from "./route";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userSeasonPass: {
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/users", () => {
  const mockedPrisma = prisma as unknown as {
    user: { findMany: jest.Mock; count: jest.Mock };
    userSeasonPass: { findMany: jest.Mock };
  };

  const ALPHA = {
    id: "player-1",
    name: "Alpha Player",
    email: "alpha.private@example.test",
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    totalPoints: 120,
    achievements: [{ id: "achievement-1" }],
    teams: [{ id: "team-1" }],
    followers: [{ id: "follower-1" }],
    solvedPuzzles: [{ id: "solve-1" }],
  };

  const BRAVO = {
    id: "player-2",
    name: "Bravo Player",
    email: "bravo.private@example.test",
    image: "https://example.test/bravo.png",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    totalPoints: 40,
    achievements: [],
    teams: [],
    followers: [],
    solvedPuzzles: [],
  };

  async function callRoute(query = "search=&sortBy=name&limit=20&skip=0") {
    const request = new NextRequest(`http://localhost:3000/api/users?${query}`);
    const response = await GET(request);
    const body = await response.json();
    return { response, body };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.user.findMany.mockResolvedValue([ALPHA, BRAVO]);
    mockedPrisma.user.count.mockResolvedValue(2);
    mockedPrisma.userSeasonPass.findMany.mockResolvedValue([]);
  });

  test("standard response is email-free and preserves public fields", async () => {
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(2);

    const [alpha, bravo] = body.users;
    expect(alpha.id).toBe("player-1");
    expect(alpha.name).toBe("Alpha Player");
    expect(alpha.image).toBeNull();
    expect(alpha.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(alpha.isPremium).toBe(false);
    expect(alpha.stats).toEqual({
      puzzlesSolved: 1,
      totalPoints: 120,
      achievementsCount: 1,
      teamsCount: 1,
      followers: 1,
    });
    expect(bravo.image).toBe("https://example.test/bravo.png");

    for (const user of body.users) {
      expect(user).not.toHaveProperty("email");
    }
    expect(JSON.stringify(body)).not.toContain("alpha.private@example.test");
    expect(JSON.stringify(body)).not.toContain("bravo.private@example.test");
  });

  test("Prisma selection excludes email", async () => {
    await callRoute();

    expect(mockedPrisma.user.findMany).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.user.findMany.mock.calls[0][0];
    const select = call.select;

    expect(select).toMatchObject({
      id: true,
      name: true,
      image: true,
      createdAt: true,
    });
    expect(select).not.toHaveProperty("email");
  });

  test("search uses display name only", async () => {
    await callRoute("search=alpha&sortBy=name&limit=20&skip=0");

    const call = mockedPrisma.user.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { name: { contains: "alpha", mode: "insensitive" } },
    ]);
    expect(call.where.OR).not.toContainEqual(
      expect.objectContaining({ email: expect.anything() })
    );

    // The existing internal eligibility filter (excluding accounts with no
    // email at all, e.g. system accounts) is not a public email search and
    // must remain unchanged by this pass.
    expect(call.where.NOT).toEqual({ email: null });
  });

  test("premium mapping remains intact", async () => {
    mockedPrisma.userSeasonPass.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);

    const { body } = await callRoute();

    const alpha = body.users.find((u: any) => u.id === "player-1");
    const bravo = body.users.find((u: any) => u.id === "player-2");
    expect(alpha.isPremium).toBe(true);
    expect(bravo.isPremium).toBe(false);
  });

  test("sortBy=points sorts players from highest to lowest points", async () => {
    const { body } = await callRoute("search=&sortBy=points&limit=20&skip=0");

    expect(body.users.map((u: any) => u.id)).toEqual(["player-1", "player-2"]);
    expect(body.users[0].stats.totalPoints).toBeGreaterThanOrEqual(body.users[1].stats.totalPoints);
  });

  test("error response remains safe", async () => {
    mockedPrisma.user.findMany.mockRejectedValueOnce(
      new Error("db exploded, leaked alpha.private@example.test")
    );

    const { response, body } = await callRoute();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch players" });
    expect(JSON.stringify(body)).not.toContain("db exploded");
    expect(JSON.stringify(body)).not.toContain("alpha.private@example.test");
  });
});
