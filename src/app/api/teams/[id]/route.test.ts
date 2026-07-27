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
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe("GET /api/teams/[id]", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    team: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  const ALPHA = {
    id: "member-row-1",
    teamId: "team-1",
    userId: "user-1",
    role: "admin",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      id: "user-1",
      name: "Alpha Player",
      email: "alpha.private@example.test",
      image: null,
    },
  };

  const BRAVO = {
    id: "member-row-2",
    teamId: "team-1",
    userId: "user-2",
    role: "member",
    joinedAt: new Date("2026-01-02T00:00:00.000Z"),
    user: {
      id: "user-2",
      name: "Bravo Player",
      email: "bravo.private@example.test",
      image: "https://example.test/bravo.png",
    },
  };

  function makeTeam(overrides: Partial<{ isPublic: boolean; members: unknown[] }> = {}) {
    return {
      id: "team-1",
      name: "Test Team",
      description: "A team",
      isPublic: overrides.isPublic ?? true,
      activeTheme: "default",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      members: overrides.members ?? [ALPHA, BRAVO],
    };
  }

  async function callRoute(teamId = "team-1") {
    const request = new NextRequest(`http://localhost:3000/api/teams/${teamId}`);
    const response = await GET(request, { params: Promise.resolve({ id: teamId }) });
    const body = await response.json();
    return { response, body };
  }

  function expectNoMemberEmails(body: unknown) {
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("alpha.private@example.test");
    expect(serialized).not.toContain("bravo.private@example.test");

    for (const member of (body as any).members) {
      expect(member.user).not.toHaveProperty("email");
    }
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("public team — anonymous viewer receives no member emails", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.members).toHaveLength(2);
    expect(body.members[0].user).toEqual({ id: "user-1", name: "Alpha Player", image: null });
    expect(body.members[0].role).toBe("admin");
    expect(body.members[1].user).toEqual({ id: "user-2", name: "Bravo Player", image: "https://example.test/bravo.png" });
    expectNoMemberEmails(body);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("public team — authenticated member receives no member emails and needs no requester lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expectNoMemberEmails(body);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("public team — authenticated nonmember receives the same safe response", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "outsider-1", email: "outsider@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.members).toHaveLength(2);
    expectNoMemberEmails(body);
  });

  test("private team — direct session ID member is authorized without a requester lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expectNoMemberEmails(body);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("private team — email fallback resolves the requester ID and selects only id", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1" });

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "alpha.private@example.test" },
      select: { id: true },
    });
    expectNoMemberEmails(body);
  });

  test("private team — unauthenticated request returns 403", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(JSON.stringify(body)).not.toMatch(/email/i);
  });

  test("private team — unresolved authenticated user returns 403 with no team data", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "ghost@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(body.members).toBeUndefined();
  });

  test("private team — authenticated nonmember returns 403 with no team data", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "outsider-1", email: "outsider@example.test" },
    } as any);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: false }));

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(body.members).toBeUndefined();
  });

  test("missing team returns 404", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(null);

    const { response, body } = await callRoute("nonexistent");

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Team not found" });
  });

  test("internal failure returns 500 with no raw error details", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockRejectedValueOnce(new Error("db exploded"));

    const { response, body } = await callRoute();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch team" });
    expect(JSON.stringify(body)).not.toContain("db exploded");
  });

  test("team lookup selects only id, name, and image on the nested member user", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.team.findUnique.mockResolvedValueOnce(makeTeam({ isPublic: true }));

    await callRoute();

    expect(mockedPrisma.team.findUnique).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.team.findUnique.mock.calls[0][0];
    const userSelect = call.include.members.include.user.select;

    expect(userSelect).toMatchObject({ id: true, name: true, image: true });
    expect(userSelect).not.toHaveProperty("email");
  });
});
