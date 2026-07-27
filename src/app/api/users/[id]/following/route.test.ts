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
    ? `http://localhost:3000/api/users/profile-1/following?cursor=${encodeURIComponent(cursor)}`
    : "http://localhost:3000/api/users/profile-1/following";
  return new NextRequest(url);
}

function context(id = "profile-1") {
  return { params: Promise.resolve({ id }) };
}

function followingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "follow-row-1",
    following: {
      id: "following-1",
      name: "Alpha Following",
      image: null,
      email: "alpha.private@example.test",
      role: "admin",
    },
    ...overrides,
  };
}

describe("GET /api/users/[id]/following", () => {
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
    mockedPrisma.follow.findMany.mockResolvedValueOnce([followingRow()]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledTimes(1);
    expect(body.users).toEqual([
      { id: "following-1", name: "Alpha Following", image: null, isSelf: false, isFollowing: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
  });

  test("direct session-ID request skips email lookup and computes flags", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "viewer-1", email: "viewer.private@example.test" },
    } as any);
    mockedPrisma.follow.findMany
      .mockResolvedValueOnce([followingRow({ following: { id: "viewer-1", name: "Me", image: null } })])
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
      .mockResolvedValueOnce([followingRow()])
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
        where: { followerId: "viewer-1", followingId: { in: ["following-1"] } },
      })
    );
    expect(body.users[0].isSelf).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/viewer\.private@example\.test/);
  });

  test("unresolved email fallback behaves anonymously", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { email: "ghost@example.test" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([followingRow()]);

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
      followerId: "profile-1",
      following: { isHidden: false },
    });
    expect(call.select.following.select).toEqual({ id: true, name: true, image: true });
    expect(JSON.stringify(call.select.following.select)).not.toMatch(/email|isHidden/i);
  });

  test("serializer strips private and unknown fields from a contaminated row", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      {
        id: "follow-row-1",
        userId: "leak-1",
        invitedBy: "leak-2",
        following: {
          id: "following-1",
          name: "Alpha Following",
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
      { id: "following-1", name: "Alpha Following", image: null, isSelf: false, isFollowing: false },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
    expect(JSON.stringify(body)).not.toMatch(/"role"|"provider"|"token"|"userId"|"invitedBy"/);
  });

  test("unexpected hidden row is dropped as defense in depth and excluded from the viewer-following query", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany
      .mockResolvedValueOnce([
        followingRow({ id: "follow-row-1", following: { id: "following-visible", name: "Visible", image: null } }),
        followingRow({
          id: "follow-row-2",
          following: { id: "following-hidden", name: "Hidden", image: null, isHidden: true },
        }),
      ])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users.map((u: { id: string }) => u.id)).toEqual(["following-visible"]);

    const viewerFollowCall = mockedPrisma.follow.findMany.mock.calls[1][0];
    expect(viewerFollowCall.where.followingId.in).toEqual(["following-visible"]);
    expect(viewerFollowCall.where.followingId.in).not.toContain("following-hidden");
  });

  test("malformed rows are dropped while valid rows are preserved in order, and excluded from the viewer-following query", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany
      .mockResolvedValueOnce([
        null,
        "invalid",
        { id: "follow-row-missing", following: null },
        { id: "follow-row-blank-id", following: { id: "", name: "Blank", image: null } },
        { id: "follow-row-bad-name", following: { id: "f-bad-name", name: 42, image: null } },
        { id: "follow-row-bad-image", following: { id: "f-bad-image", name: "Name", image: 42 } },
        { id: "follow-row-1", following: { id: "following-1", name: "First", image: null } },
        { id: "follow-row-2", following: { id: "following-2", name: "Second", image: null } },
      ])
      .mockResolvedValueOnce([]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users.map((u: { id: string }) => u.id)).toEqual(["following-1", "following-2"]);

    const viewerFollowCall = mockedPrisma.follow.findMany.mock.calls[1][0];
    expect(viewerFollowCall.where.followingId.in).toEqual(["following-1", "following-2"]);
    expect(viewerFollowCall.where.followingId.in).not.toEqual(
      expect.arrayContaining(["f-bad-name", "f-bad-image", ""])
    );
  });

  test("no viewer-following query runs when every row is malformed or hidden", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "viewer-1" } } as any);
    mockedPrisma.follow.findMany.mockResolvedValueOnce([
      null,
      { id: "follow-row-missing", following: null },
      { id: "follow-row-blank-id", following: { id: "", name: "Blank", image: null } },
      { id: "follow-row-hidden", following: { id: "following-hidden", name: "Hidden", image: null, isHidden: true } },
    ]);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual([]);
    expect(mockedPrisma.follow.findMany).toHaveBeenCalledTimes(1);
  });

  test("pagination returns exactly 30 users and the expected cursor", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: `follow-row-${i}`,
      following: { id: `following-${i}`, name: `Player ${i}`, image: null },
    }));
    mockedPrisma.follow.findMany.mockResolvedValueOnce(rows);

    const response = await GET(buildRequest(), context());
    const body = await response.json();

    expect(body.users).toHaveLength(30);
    expect(body.users.map((u: { id: string }) => u.id)).toEqual(
      rows.slice(0, 30).map((r) => r.following.id)
    );
    expect(body.nextCursor).toBe("follow-row-29");
  });

  test("pagination returns null cursor when 30 or fewer rows are visible", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `follow-row-${i}`,
      following: { id: `following-${i}`, name: `Player ${i}`, image: null },
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
    expect(body).toEqual({ error: "Failed to fetch following" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
