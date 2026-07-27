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
    teamMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    teamInvite: {
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/teams/[id]/applications", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock };
    teamMember: { findUnique: jest.Mock; findMany: jest.Mock };
    teamInvite: { findMany: jest.Mock };
  };

  const APPLICATION_ROW = {
    id: "app-1",
    teamId: "team-1",
    userId: "applicant-1",
    invitedBy: "applicant-1",
    status: "pending",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      id: "applicant-1",
      name: "Alpha Applicant",
      email: "alpha.private@example.test",
      image: null,
    },
  };

  const INVITATION_ROW = {
    id: "inv-1",
    teamId: "team-1",
    userId: "invited-1",
    invitedBy: "admin-1",
    status: "pending",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    user: {
      id: "invited-1",
      name: "Invited User",
      email: "invited.private@example.test",
      image: null,
    },
  };

  function expectNoApplicantEmails(body: unknown) {
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("alpha.private@example.test");

    for (const application of body as any[]) {
      if (application.user) {
        expect(application.user).not.toHaveProperty("email");
      }
    }
  }

  async function callRoute(teamId = "team-1") {
    const request = new NextRequest(`http://localhost:3000/api/teams/${teamId}/applications`);
    const response = await GET(request, { params: Promise.resolve({ id: teamId }) });
    const body = await response.json();
    return { response, body };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.teamMember.findMany.mockResolvedValue([]);
    mockedPrisma.teamInvite.findMany.mockResolvedValue([APPLICATION_ROW]);
  });

  test("direct session-ID admin: 200, no requester lookup, applications returned email-free", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "admin-1", email: "admin.private@example.test" },
    } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { teamId_userId: { teamId: "team-1", userId: "admin-1" } },
    });
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("app-1");
    expect(body[0].userId).toBe("applicant-1");
    expect(body[0].user).toEqual({ id: "applicant-1", name: "Alpha Applicant", image: null });
    expect(body[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expectNoApplicantEmails(body);
  });

  test("direct session-ID moderator: 200 with the same email-free payload", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "mod-1", email: "mod.private@example.test" },
    } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "mod-1", role: "moderator" });

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expectNoApplicantEmails(body);
  });

  test("email fallback admin: fallback selects only { id: true } and authorization uses the resolved ID", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "admin.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "admin-1" });
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "admin.private@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { teamId_userId: { teamId: "team-1", userId: "admin-1" } },
    });
    expectNoApplicantEmails(body);
  });

  test("missing identity: 401 Unauthorized, no Prisma user lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const { response, body } = await callRoute();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("unresolved fallback user: 404 User not found", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const { response, body } = await callRoute();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
  });

  test("ordinary team member: 403 Forbidden, pending-application query not called", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "member-1", email: "member@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "member-1", role: "member" });

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(mockedPrisma.teamInvite.findMany).not.toHaveBeenCalled();
  });

  test("team nonmember: 403 Forbidden", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "outsider-1", email: "outsider@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce(null);

    const { response, body } = await callRoute();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
  });

  test("existing members remain excluded from the pending-invite query", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "admin-1", email: "admin@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });
    mockedPrisma.teamMember.findMany.mockResolvedValueOnce([{ userId: "existing-member-1" }, { userId: "existing-member-2" }]);

    await callRoute();

    const call = mockedPrisma.teamInvite.findMany.mock.calls[0][0];
    expect(call.where.NOT).toEqual({ userId: { in: ["existing-member-1", "existing-member-2"] } });
  });

  test("only self-submitted rows are returned, leader-sent invitations are excluded", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "admin-1", email: "admin@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([APPLICATION_ROW, INVITATION_ROW]);

    const { body } = await callRoute();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("app-1");
  });

  test("Prisma applicant selection excludes email", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "admin-1", email: "admin@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });

    await callRoute();

    expect(mockedPrisma.teamInvite.findMany).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.teamInvite.findMany.mock.calls[0][0];
    const userSelect = call.include.user.select;

    expect(userSelect).toMatchObject({ id: true, name: true, image: true });
    expect(userSelect).not.toHaveProperty("email");
  });

  test("serializer strips an unexpected email even when mocked data includes it", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "admin-1", email: "admin@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });
    mockedPrisma.teamInvite.findMany.mockResolvedValueOnce([APPLICATION_ROW]);

    const { body } = await callRoute();

    expect(body[0].user.name).toBe("Alpha Applicant");
    expect(body[0].user.image).toBeNull();
    expect(body[0].user.id).toBe("applicant-1");
    expect(body[0].user).not.toHaveProperty("email");
    expect(JSON.stringify(body)).not.toContain("alpha.private@example.test");
  });

  test("internal failure returns 500 with no raw error or email details", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "admin-1", email: "admin@example.test" } } as any);
    mockedPrisma.teamMember.findUnique.mockResolvedValueOnce({ teamId: "team-1", userId: "admin-1", role: "admin" });
    mockedPrisma.teamInvite.findMany.mockRejectedValueOnce(
      new Error("db exploded, leaked alpha.private@example.test")
    );

    const { response, body } = await callRoute();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch applications" });
    expect(JSON.stringify(body)).not.toContain("db exploded");
    expect(JSON.stringify(body)).not.toContain("alpha.private@example.test");
  });
});
