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
      findUnique: jest.fn(),
    },
    teamInvite: {
      findMany: jest.fn(),
    },
  },
}));

const RAW_INVITATION = {
  id: "inv-1",
  teamId: "team-1",
  userId: "player-1",
  invitedBy: "admin-1",
  status: "pending",
  expiresAt: new Date("2099-01-07T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  email: "root.private@example.test",
  user: {
    id: "player-1",
    name: "Invitee",
    email: "invitee.private@example.test",
    image: null,
  },
  team: {
    id: "team-1",
    name: "Alpha Team",
    description: "A team",
    email: "team.private@example.test",
    members: [
      {
        id: "member-row-1",
        email: "member-row.private@example.test",
        user: {
          id: "member-1",
          name: "Member One",
          email: "member.private@example.test",
          image: null,
        },
      },
    ],
  },
};

describe("GET /api/teams/invitations", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock };
    teamInvite: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("filters out self-submitted applications from invitation list", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "u1", email: "player@example.com" } } as any);
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.teamInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          status: "pending",
          NOT: { invitedBy: "u1" },
        }),
      })
    );
  });

  test("direct session-ID request uses the ID without a requester lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "player-1", email: "player.private@example.test" },
    } as any);
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.teamInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "player-1",
          status: "pending",
          NOT: { invitedBy: "player-1" },
        }),
      })
    );
  });

  test("email fallback resolves the requester ID with an ID-only selection", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "player-1@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "player-1" });
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "player-1@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.teamInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "player-1",
          NOT: { invitedBy: "player-1" },
        }),
      })
    );
  });

  test("missing identity returns 401 without any lookup or query", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.teamInvite.findMany).not.toHaveBeenCalled();
  });

  test("unresolved email fallback returns 404 without an invitation query", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "ghost@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockedPrisma.teamInvite.findMany).not.toHaveBeenCalled();
  });

  test("query selection excludes email and the redundant root user relation", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    await GET(request);

    const call = mockedPrisma.teamInvite.findMany.mock.calls[0][0];
    expect(call.include.user).toBeUndefined();
    expect(call.include.team.select).toEqual(
      expect.objectContaining({ id: true, name: true, description: true })
    );
    expect(call.include.team.select.members.select).toEqual(
      expect.objectContaining({
        id: true,
        user: { select: { id: true, name: true, image: true } },
      })
    );
    expect(JSON.stringify(call.include.team.select.members.select.user.select)).not.toMatch(/email/i);
  });

  test("serializer allowlist strips private fields from a contaminated fixture", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([RAW_INVITATION]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      {
        id: "inv-1",
        teamId: "team-1",
        status: "pending",
        expiresAt: "2099-01-07T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        team: {
          id: "team-1",
          name: "Alpha Team",
          description: "A team",
          members: [
            {
              id: "member-row-1",
              user: { id: "member-1", name: "Member One", image: null },
            },
          ],
        },
      },
    ]);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/private@example\.test/);
    expect(serialized).not.toMatch(/"userId"/);
    expect(serialized).not.toMatch(/"invitedBy"/);
  });

  test("malformed member rows are dropped while valid members and order are preserved", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([
      {
        ...RAW_INVITATION,
        team: {
          ...RAW_INVITATION.team,
          members: [
            { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
            { id: "member-row-bad", user: null },
            { id: null, user: { id: "member-3", name: "Member Three", image: null } },
          ],
        },
      },
    ]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].team.members).toEqual([
      { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
    ]);
  });

  test("multiple invitations preserve Prisma order", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    const first = { ...RAW_INVITATION, id: "inv-1" };
    const second = { ...RAW_INVITATION, id: "inv-2" };
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([first, second]);

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(body.map((inv: { id: string }) => inv.id)).toEqual(["inv-1", "inv-2"]);
  });

  test("internal failure returns a safe 500 without leaking the raw error", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findMany.mockRejectedValueOnce(
      new Error("db exploded for leak@example.test")
    );

    const request = new NextRequest("http://localhost:3000/api/teams/invitations");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch invitations" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
