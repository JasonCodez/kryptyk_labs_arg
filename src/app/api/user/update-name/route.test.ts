import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { POST } from "./route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/requestSecurity", () => ({
  validateSameOrigin: jest.fn(() => null),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockedValidateSameOrigin = jest.requireMock("@/lib/requestSecurity").validateSameOrigin as jest.Mock;
const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/user/update-name", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSession(userId = "user-1") {
  mockedGetServerSession.mockResolvedValue({ user: { id: userId, email: "player@example.test" } } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedValidateSameOrigin.mockReturnValue(null);
});

describe("POST /api/user/update-name", () => {
  it("1. unauthorized request returns 401", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const response = await POST(makeRequest({ name: "Newbie" }));
    expect(response.status).toBe(401);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("2. same-origin failure happens before any database mutation", async () => {
    const blocked = new Response(JSON.stringify({ error: "Cross-site request blocked" }), { status: 403 });
    mockedValidateSameOrigin.mockReturnValue(blocked as never);
    mockSession();

    const response = await POST(makeRequest({ name: "Newbie" }));
    expect(response.status).toBe(403);
    expect(mockedGetServerSession).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("3. missing name returns 400", async () => {
    mockSession();
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("4. whitespace-only name returns 400", async () => {
    mockSession();
    const response = await POST(makeRequest({ name: "   " }));
    expect(response.status).toBe(400);
  });

  it("5. shared display-name validation is enforced (invalid characters)", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    const response = await POST(makeRequest({ name: "bad name!" }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  it("6. case-insensitive duplicate returns 409", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue({ id: "user-2", name: "TAKENNAME" });
    const response = await POST(makeRequest({ name: "takenname" }));
    expect(response.status).toBe(409);
    expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: "takenname", mode: "insensitive" },
        id: { not: "user-1" },
      },
    });
  });

  it("7. a null-name OAuth user can set an initial name", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "user-1", name: "FreshName", nameChanged: false });

    const response = await POST(makeRequest({ name: "FreshName" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toEqual({ id: "user-1", name: "FreshName", nameChanged: false });
  });

  it("8. initial assignment persists nameChanged as false", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "", nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "user-1", name: "FreshName", nameChanged: false });

    await POST(makeRequest({ name: "FreshName" }));

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "FreshName", nameChanged: false },
      select: { id: true, name: true, nameChanged: true },
    });
  });

  it("9. a named user's first rename sets nameChanged to true", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "OldName", nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "user-1", name: "NewName", nameChanged: true });

    const response = await POST(makeRequest({ name: "NewName" }));
    const body = await response.json();

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "NewName", nameChanged: true },
      select: { id: true, name: true, nameChanged: true },
    });
    expect(body.user.nameChanged).toBe(true);
  });

  it("10. an already-renamed user receives 403", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "OldName", nameChanged: true });

    const response = await POST(makeRequest({ name: "NewName" }));
    expect(response.status).toBe(403);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("11. Prisma lookup and update use the authenticated user's ID, not the request body", async () => {
    mockSession("session-user-id");
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "session-user-id", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "session-user-id", name: "Chosen", nameChanged: false });

    await POST(makeRequest({ name: "Chosen", id: "attacker-controlled-id" }));

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "session-user-id" },
      select: { id: true, name: true, nameChanged: true },
    });
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-user-id" } })
    );
  });

  it("12. the success response contains no email", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "user-1", name: "FreshName", nameChanged: false });

    const response = await POST(makeRequest({ name: "FreshName" }));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("player@example.test");
    expect(body.user).not.toHaveProperty("email");
  });

  it("13. unrelated request properties are ignored", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockResolvedValue({ id: "user-1", name: "FreshName", nameChanged: false });

    await POST(makeRequest({ name: "FreshName", role: "admin", betaApproved: true, email: "hacker@example.test" }));

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "FreshName", nameChanged: false },
      select: { id: true, name: true, nameChanged: true },
    });
  });

  it("14. a Prisma unique conflict on update produces a safe duplicate response", async () => {
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const response = await POST(makeRequest({ name: "RaceName" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("This display name is already taken");
  });

  it("15. other Prisma failures return a generic 500 without leaking details", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockSession();
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: null, nameChanged: false });
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    mockedPrisma.user.update.mockRejectedValue(new Error("connection pool exhausted at 10.0.0.4:5432"));

    const response = await POST(makeRequest({ name: "SafeName" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to update name");
    expect(JSON.stringify(body)).not.toContain("10.0.0.4");
    consoleSpy.mockRestore();
  });
});
