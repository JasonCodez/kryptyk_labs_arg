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
    follow: {
      findMany: jest.fn(),
    },
  },
}));

function buildRequest(cursor?: string) {
  const url = cursor
    ? `http://localhost:3000/api/users/profile-1/followers?cursor=${encodeURIComponent(cursor)}`
    : "http://localhost:3000/api/users/profile-1/followers";
  return new NextRequest(url);
}

function context(id = "profile-1") {
  return { params: Promise.resolve({ id }) };
}

function followRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "follow-row-1",
    follower: {
      id: "follower-1",
      name: "Alpha Follower",
      image: null,
      email: "alpha.private@example.test",
      role: "admin",
    },
    ...overrides,
  };
}

describe("GET /api/users/[id]/followers", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock };
    follow: { findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("anonymous public request returns visible users with no viewer flags", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([followRow()]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledTimes(1);
    expect(body.users).toEqual([
      { id: "follower-1", name: "Alpha Follower", image: null, isSelf: false, isFollowing: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
  });

  test("direct session-ID request skips email lookup and computes flags", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "viewer-1", email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.follow.findMany
      .mockResolvedValueOnce([followRow({ follower: { id: "viewer-1", name: "Me", image: null } })])
      .mockResolvedValueOnce([{ followingId: "viewer-1" }]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { followerId: "viewer-1", followingId: { in: ["viewer-1"] } },
        select: { followingId: true },
      })
    );
    expect(body.users[0]).toEqual({
      id: "viewer-1",
      name: "Me",
      image: null,
      isSelf: true,
      isFollowing: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("email fallback viewer resolves ID with an ID-only lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "viewer-1" });
    mockedPrisma.follow.findMany
      .mockResolvedValueOnce([followRow()])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "viewer.private@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.follow.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { followerId: "viewer-1", followingId: { in: ["follower-1"] } },
      })
    );
    expect(body.users[0].isSelf).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("unresolved email fallback behaves anonymously", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([followRow()]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledTimes(1);
    expect(body.users[0].isSelf).toBe(false);
    expect(body.users[0].isFollowing).toBe(false);
  });

  test("hidden filtering happens in the Prisma query with a narrow select", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([]);

    await GET(buildRequest(), context());

    const call = mockedPrisma.follow.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      followingId: "profile-1",
      follower: { isHidden: false },
    });
    expect(call.select.follower.select).toEqual({ id: true, name: true, image: true });
    expect(JSON.stringify(call.select.follower.select)).not.toMatch(/email|isHidden/i);
  });

  test("serializer strips private and unknown fields from a contaminated row", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      {
        id: "follow-row-1",
        userId: "leak-1",
        invitedBy: "leak-2",
        follower: {
          id: "follower-1",
          name: "Alpha Follower",
          image: null,
          email: "alpha.private@example.test",
          role: "admin",
          provider: "credentials",
          token: "secret-token",
        },
      },
    ]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users).toEqual([
      { id: "follower-1", name: "Alpha Follower", image: null, isSelf: false, isFollowing: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
    expect(JSON.stringify(body)).not.toMatch(/"role"|"provider"|"token"|"userId"|"invitedBy"/);
  });

  test("unexpected hidden row is dropped as defense in depth", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      followRow({ id: "follow-row-1", follower: { id: "follower-1", name: "Visible", image: null } }),
      followRow({
        id: "follow-row-2",
        follower: { id: "follower-2", name: "Hidden", image: null, isHidden: true },
      }),
    ]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users.map((u: { id: string }) => u.id)).toEqual(["follower-1"]);
  });

  test("malformed rows are dropped while valid rows are preserved in order", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      null,
      "invalid",
      { id: "follow-row-missing", follower: null },
      { id: "follow-row-blank-id", follower: { id: "", name: "Blank", image: null } },
      { id: "follow-row-bad-name", follower: { id: "f-bad-name", name: 42, image: null } },
      { id: "follow-row-bad-image", follower: { id: "f-bad-image", name: "Name", image: 42 } },
      { id: "follow-row-1", follower: { id: "follower-1", name: "First", image: null } },
      { id: "follow-row-2", follower: { id: "follower-2", name: "Second", image: null } },
    ]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users.map((u: { id: string }) => u.id)).toEqual(["follower-1", "follower-2"]);
  });

  test("pagination returns exactly 30 users and the expected cursor", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: `follow-row-${i}`,
      follower: { id: `follower-${i}`, name: `Player ${i}`, image: null },
    }));
    mockedPrisma.follow.findMany.mockResolvedValueOnce(rows);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users).toHaveLength(30);
    expect(body.users.map((u: { id: string }) => u.id)).toEqual(
      rows.slice(0, 30).map((r) => r.follower.id)
    );
    expect(body.nextCursor).toBe("follow-row-29");
  });

  test("pagination returns null cursor when 30 or fewer rows are visible", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `follow-row-${i}`,
      follower: { id: `follower-${i}`, name: `Player ${i}`, image: null },
    }));
    mockedPrisma.follow.findMany.mockResolvedValueOnce(rows);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users).toHaveLength(30);
    expect(body.nextCursor).toBeNull();
  });

  test("internal failure returns a safe 500 without leaking the raw error", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockRejectedValueOnce(
      new Error("db exploded for leak@example.test")
    );

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch followers" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
