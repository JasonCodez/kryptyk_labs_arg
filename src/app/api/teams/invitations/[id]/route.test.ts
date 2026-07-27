import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { notifyTeamUpdate } from "@/lib/notification-service";
import { POST } from "./route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(),
}));

jest.mock("@/lib/notification-service", () => ({
  notifyTeamUpdate: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    teamInvite: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
  },
}));

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/teams/invitations/inv-1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/teams/invitations/[id]", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedValidateSameOrigin = validateSameOrigin as jest.MockedFunction<typeof validateSameOrigin>;
  const mockedNotifyTeamUpdate = notifyTeamUpdate as jest.MockedFunction<typeof notifyTeamUpdate>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock };
    teamInvite: { findUnique: jest.Mock; update: jest.Mock };
    teamMember: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    team: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidateSameOrigin.mockReturnValue(null);
  });

  function pendingInvitation(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "inv-1",
      teamId: "team-1",
      userId: "player-1",
      invitedBy: "admin-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 86400000),
      ...overrides,
    };
  }

  test("rejects accepting a self-submitted application through invitation endpoint", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "u1", email: "player@example.com" } } as any);

    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce({
      id: "inv-1",
      teamId: "team-1",
      userId: "u1",
      invitedBy: "u1",
      status: "pending",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/application/i);
    expect(mockedPrisma.teamInvite.update).not.toHaveBeenCalled();
    expect(mockedPrisma.teamMember.create).not.toHaveBeenCalled();
  });

  test("same-origin rejection is returned first with no session lookup or Prisma call", async () => {
    const sameOriginResponse = NextResponse.json({ error: "Bad origin" }, { status: 403 });
    mockedValidateSameOrigin.mockReturnValueOnce(sameOriginResponse);

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));

    expect(response).toBe(sameOriginResponse);
    expect(mockedGetServerSession).not.toHaveBeenCalled();
    expect(mockedPrisma.teamInvite.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("direct session-ID acceptance uses the ID with no requester lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "player-1", name: "Alpha Player", email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);
    mockedPrisma.team.findUnique.mockResolvedValueOnce({ name: "Alpha Team" });

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Invitation accepted", teamId: "team-1" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { teamId_userId: { teamId: "team-1", userId: "player-1" } },
    });
    expect(mockedPrisma.teamMember.create).toHaveBeenCalledWith({
      data: { teamId: "team-1", userId: "player-1", role: "member" },
    });

    const serialized = JSON.stringify(mockedNotifyTeamUpdate.mock.calls[0]);
    expect(serialized).not.toMatch(/alpha\.private@example\.test/);
    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
  });

  test("email fallback acceptance resolves ID via an ID-only lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { name: "Alpha Player", email: "player-1@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "player-1" });
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);
    mockedPrisma.team.findUnique.mockResolvedValueOnce({ name: "Alpha Team" });

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "player-1@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { teamId_userId: { teamId: "team-1", userId: "player-1" } },
    });

    const messages = mockedNotifyTeamUpdate.mock.calls[0][1] as { updateMessage: string };
    expect(messages.updateMessage).not.toMatch(/@/);
  });

  test("named notification uses the session name", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "player-1", name: "Alpha Player" },
    } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);
    mockedPrisma.team.findUnique.mockResolvedValueOnce({ name: "Alpha Team" });

    await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));

    const call = mockedNotifyTeamUpdate.mock.calls[0][1] as { updateMessage: string; updateTitle: string };
    expect(call.updateMessage).toBe("Alpha Player has joined the team!");
    expect(call.updateTitle).toBe("New Team Member");
  });

  test("trimmed-name notification strips surrounding whitespace", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "player-1", name: "  Alpha Player  " },
    } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);
    mockedPrisma.team.findUnique.mockResolvedValueOnce({ name: "Alpha Team" });

    await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));

    const call = mockedNotifyTeamUpdate.mock.calls[0][1] as { updateMessage: string };
    expect(call.updateMessage).toBe("Alpha Player has joined the team!");
  });

  test.each([null, undefined, "", "   "])(
    "nameless notification (%p) falls back to 'A player' with no email leak",
    async (name) => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: "player-1", name, email: "nameless.private@example.test" },
      } as any);
      mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
      mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);
      mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "player-1" }]);
      mockedPrisma.team.findUnique.mockResolvedValueOnce({ name: "Alpha Team" });

      const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
      const body = await response.json();

      const call = mockedNotifyTeamUpdate.mock.calls[0][1] as {
        updateMessage: string;
        updateTitle: string;
      };
      expect(call.updateMessage).toBe("A player has joined the team!");
      expect(call.updateTitle).not.toMatch(/nameless\.private@example\.test/);
      expect(JSON.stringify(mockedNotifyTeamUpdate.mock.calls[0])).not.toMatch(
        /nameless\.private@example\.test/
      );
      expect(JSON.stringify(body)).not.toMatch(/nameless\.private@example\.test/);
    }
  );

  test("decline updates status, creates no member, and sends no notification", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "decline" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Invitation declined" });
    expect(mockedPrisma.teamInvite.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "declined" },
    });
    expect(mockedPrisma.teamMember.create).not.toHaveBeenCalled();
    expect(mockedNotifyTeamUpdate).not.toHaveBeenCalled();
  });

  test("invitation belonging to another player returns 403", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "someone-else" } } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "This invitation is not for you" });
  });

  test("expired invitation returns 400", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(
      pendingInvitation({ expiresAt: new Date(Date.now() - 1000) })
    );

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invitation has expired" });
  });

  test("existing membership returns 400", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findUnique.mockResolvedValueOnce(pendingInvitation());
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ id: "member-1" });

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "You are already a member of this team" });
  });

  test("missing identity returns 401", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.teamInvite.findUnique).not.toHaveBeenCalled();
  });

  test("unresolved email fallback returns 404", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockedPrisma.teamInvite.findUnique).not.toHaveBeenCalled();
  });

  test("internal failure returns a safe 500", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "player-1" } } as any);
    mockedPrisma.teamInvite.findUnique.mockRejectedValueOnce(
      new Error("db exploded for leak@example.test")
    );

    const response = await POST(buildRequest({ invitationId: "inv-1", action: "accept" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to process invitation" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
