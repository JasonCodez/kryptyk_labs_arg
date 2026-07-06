import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { GET, PUT } from "./route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(() => null),
}));

jest.mock("@/lib/levels", () => ({
  calcLevel: jest.fn(() => ({
    level: 6,
    title: "Cipher Adept",
    currentXp: 300,
    nextLevelXp: 450,
    progress: 67,
  })),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userPuzzleProgress: {
      count: jest.fn(),
    },
    follow: {
      count: jest.fn(),
    },
  },
}));

describe("GET /api/user/profile", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    userPuzzleProgress: { count: jest.Mock };
    follow: { count: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 when user is not authenticated", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost:3000/api/user/profile");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("returns solved count from solved progress rows, not from points", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "player@example.com" },
    } as any);

    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      name: "Player One",
      email: "player@example.com",
      image: null,
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      xp: 300,
      level: 4,
      xpTitle: "Solver",
      activeTheme: "default",
      activeFrame: "none",
      activeSkin: "default",
      activeFlair: "none",
      activeNameColor: "none",
      activeTitle: "none",
      isFounder: false,
      totalPoints: 260,
      purchasedPoints: 160,
    });

    mockedPrisma.userPuzzleProgress.count.mockResolvedValueOnce(21);

    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u2", totalPoints: 500, purchasedPoints: 0 },
      { id: "u1", totalPoints: 260, purchasedPoints: 160 },
    ]);

    mockedPrisma.follow.count.mockResolvedValueOnce(5); // followers
    mockedPrisma.follow.count.mockResolvedValueOnce(3); // following

    const request = new NextRequest("http://localhost:3000/api/user/profile");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalPoints).toBe(100);
    expect(body.totalPuzzlesSolved).toBe(21);
    expect(body.rank).toBe(2);
    expect(body.social).toEqual({ followers: 5, following: 3 });
  });
});

describe("PUT /api/user/profile", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    userPuzzleProgress: { count: jest.Mock };
    follow: { count: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("saves bio without re-validating an unchanged name, even if it wouldn't pass today's stricter format rules", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "player@example.com" },
    } as any);

    // "Player One" (an OAuth-provided name with a space) predates the
    // alphanumeric-only display name rule and would fail it if re-checked.
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ name: "Player One" });
    mockedPrisma.user.update.mockResolvedValueOnce({
      id: "u1",
      name: "Player One",
      email: "player@example.com",
      image: null,
      bio: "Hello from the puzzle grid!",
      role: "user",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      xp: 300,
      level: 4,
      xpTitle: "Solver",
      activeTheme: "neon",
      activeFrame: "gold",
      activeSkin: "retro",
      activeCompletionAnimation: "confetti",
      activeFlair: "fire",
      activeNameColor: "rainbow",
      activeTitle: "founder",
      isFounder: true,
      totalPoints: 260,
      purchasedPoints: 160,
    });
    mockedPrisma.userPuzzleProgress.count.mockResolvedValueOnce(21);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", totalPoints: 260, purchasedPoints: 160 },
    ]);
    mockedPrisma.follow.count.mockResolvedValueOnce(5);
    mockedPrisma.follow.count.mockResolvedValueOnce(3);

    const request = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "Player One", bio: "Hello from the puzzle grid!" }),
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bio).toBe("Hello from the puzzle grid!");
    // Regression check: saving the profile must not drop cosmetic fields --
    // the client replaces its whole profile state with this response, so a
    // missing activeTheme here previously reset the visible theme to default
    // until the page was refreshed.
    expect(body.activeTheme).toBe("neon");
    expect(body.activeFrame).toBe("gold");
    expect(body.activeSkin).toBe("retro");
    expect(body.activeFlair).toBe("fire");
    expect(body.activeNameColor).toBe("rainbow");
    expect(body.isFounder).toBe(true);
    // The name didn't change, so the uniqueness/format re-check should be skipped entirely.
    expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  test("still validates format when the name actually changes", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "player@example.com" },
    } as any);

    mockedPrisma.user.findUnique.mockResolvedValueOnce({ name: "Player One" });

    const request = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "New Name With Spaces" }),
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/3-16 characters/i);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });
});
