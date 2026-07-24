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
    team: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userPuzzleProgress: {
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/teams/[id]/stats", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    team: { findUnique: jest.Mock; findMany: jest.Mock };
    userPuzzleProgress: { findMany: jest.Mock };
  };

  const MEMBER = {
    userId: "member-1",
    role: "admin",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: "member-1", name: "Member One", image: null, email: "member1@example.test" },
  };

  function makeTeam(overrides: Partial<{ isPublic: boolean; members: unknown[] }> = {}) {
    return {
      id: "team-1",
      name: "Test Team",
      isPublic: overrides.isPublic ?? true,
      members: overrides.members ?? [MEMBER],
    };
  }

  async function callRoute(teamId = "team-1") {
    const request = new NextRequest(`http://localhost:3000/api/teams/${teamId}/stats`);
    const response = await GET(request, { params: Promise.resolve({ id: teamId }) });
    const body = await response.json();
    return { response, body };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.team.findMany.mockResolvedValue([]);
    mockedPrisma.userPuzzleProgress.findMany.mockResolvedValue([]);
  });

  test("missing team returns 404", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(null);

    const { response, body } = await callRoute("nonexistent");

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
    expect(mockedPrisma.userPuzzleProgress.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.team.findMany).not.toHaveBeenCalled();
  });

  test("anonymous public-team request is allowed", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.error).toBeUndefined();
  });

  test("authenticated non-member public-team request is allowed", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "outsider@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    const { response } = await callRoute();

    expect(response.status).toBe(200);
  });

  test("anonymous private-team request returns 403", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  test("authenticated private-team non-member returns 403", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "outsider@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  test("authenticated private-team member is allowed", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "member1@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.error).toBeUndefined();
  });

  test("rejected private-team requests do not call progress aggregation queries", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    await callRoute();

    expect(mockedPrisma.userPuzzleProgress.findMany).not.toHaveBeenCalled();
  });

  test("rejected private-team requests do not load all teams for rank calculation", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "outsider@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    await callRoute();

    expect(mockedPrisma.team.findMany).not.toHaveBeenCalled();
  });

  test("public success response retains the existing response shape", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));
    mockedPrisma.team.findMany.mockResolvedValueOnce([
      { id: "team-1", members: [{ userId: "member-1", joinedAt: MEMBER.joinedAt }] },
    ]);
    mockedPrisma.userPuzzleProgress.findMany.mockResolvedValueOnce([
      {
        userId: "member-1",
        pointsEarned: 25,
        solvedAt: new Date("2026-01-05T00:00:00.000Z"),
        puzzle: { id: "p1", title: "Puzzle", puzzleType: "sudoku", difficulty: "easy" },
      },
    ]);

    const { body } = await callRoute();

    expect(Object.keys(body).sort()).toEqual(
      ["rank", "totalTeams", "totalEarnedPoints", "totalPuzzlesSolved", "avgPointsPerMember", "memberCount", "topContributors", "recentActivity"].sort()
    );
    expect(body.rank).toBe(1);
    expect(body.totalTeams).toBe(1);
    expect(body.totalEarnedPoints).toBe(25);
    expect(body.memberCount).toBe(1);
    expect(body.topContributors[0].userId).toBe("member-1");
  });

  test("member success response retains the existing response shape", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "member1@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));
    mockedPrisma.team.findMany.mockResolvedValueOnce([
      { id: "team-1", members: [{ userId: "member-1", joinedAt: MEMBER.joinedAt }] },
    ]);
    mockedPrisma.userPuzzleProgress.findMany.mockResolvedValueOnce([]);

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.topContributors).toEqual([
      { userId: "member-1", name: "Member One", image: null, role: "admin", joinedAt: MEMBER.joinedAt.toISOString(), earnedPoints: 0, puzzlesSolved: 0 },
    ]);
  });

  test("no member email address appears in the returned stats payload", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "member1@example.test" } } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));
    mockedPrisma.team.findMany.mockResolvedValueOnce([
      { id: "team-1", members: [{ userId: "member-1", joinedAt: MEMBER.joinedAt }] },
    ]);
    mockedPrisma.userPuzzleProgress.findMany.mockResolvedValueOnce([]);

    const { body } = await callRoute();

    expect(JSON.stringify(body)).not.toContain("member1@example.test");
    expect(JSON.stringify(body)).not.toMatch(/email/i);
  });
});
