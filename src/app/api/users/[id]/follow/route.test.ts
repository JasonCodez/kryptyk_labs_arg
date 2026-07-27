import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin } from "@/lib/requestSecurity";
import { createNotification } from "@/lib/notification-service";
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
  createNotification: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    follow: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

function buildRequest(action: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/users/target-1/follow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

function context(id = "target-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/users/[id]/follow", () => {
  const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
  const mockedValidateSameOrigin = validateSameOrigin as jest.MockedFunction<typeof validateSameOrigin>;
  const mockedCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;
  const mockedPrisma = prisma as unknown as {
    user: { findUnique: jest.Mock };
    follow: { create: jest.Mock; delete: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidateSameOrigin.mockReturnValue(null);
  });

  test("same-origin rejection is returned first with no session lookup or Prisma call", async () => {
    const sameOriginResponse = NextResponse.json({ error: "Bad origin" }, { status: 403 });
    mockedValidateSameOrigin.mockReturnValueOnce(sameOriginResponse);

    const response = await POST(buildRequest("follow"), context());

    expect(response).toBe(sameOriginResponse);
    expect(mockedGetServerSession).not.toHaveBeenCalled();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("direct session-ID follow uses the ID with only a target lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "requester-1", name: "Alpha Player", email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.create.mockResolvedValueOnce({});

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Successfully followed user" });

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "target-1" },
      select: { id: true },
    });

    expect(mockedPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "requester-1", followingId: "target-1" },
    });

    expect(JSON.stringify(body)).not.toMatch(/alpha\.private@example\.test/);
    expect(JSON.stringify(mockedCreateNotification.mock.calls)).not.toMatch(
      /alpha\.private@example\.test/
    );
  });

  test("email fallback follow resolves ID via an ID-only lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { name: "Alpha Player", email: "alpha.private@example.test" },
    } as any);
    mockedPrisma.user.findUnique
      .mockResolvedValueOnce({ id: "requester-1" })
      .mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.create.mockResolvedValueOnce({});

    const response = await POST(buildRequest("follow"), context());

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: "alpha.private@example.test" },
      select: { id: true },
    });
    expect(mockedPrisma.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: "target-1" },
      select: { id: true },
    });
    expect(mockedPrisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: "requester-1", followingId: "target-1" },
    });

    const serialized = JSON.stringify(mockedCreateNotification.mock.calls);
    expect(serialized).not.toMatch(/alpha\.private@example\.test/);
  });

  test("missing identity returns 401 with no Prisma calls", async () => {
    mockedGetServerSession.mockResolvedValueOnce(null);

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("unresolved email fallback returns 404 with no target lookup or mutation", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { email: "ghost@example.test" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("self-follow is rejected before the target lookup", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "target-1", name: "Alpha Player" },
    } as any);

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Cannot follow yourself" });
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("missing target returns 404 with no mutation or notification", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "requester-1" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Target user not found" });
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("named notification uses the exact expected payload", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "requester-1", name: "Alpha Player" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.create.mockResolvedValueOnce({});

    await POST(buildRequest("follow"), context());

    expect(mockedCreateNotification).toHaveBeenCalledWith({
      userId: "target-1",
      type: "system",
      title: "New Follower!",
      message: "Alpha Player started following you!",
      icon: "👥",
      relatedId: "requester-1",
    });
  });

  test("trimmed-name notification strips surrounding whitespace", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "requester-1", name: "  Alpha Player  " },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.create.mockResolvedValueOnce({});

    await POST(buildRequest("follow"), context());

    const call = mockedCreateNotification.mock.calls[0][0] as { message: string };
    expect(call.message).toBe("Alpha Player started following you!");
  });

  test.each([null, undefined, "", "   "])(
    "nameless notification (%p) falls back to 'A player' with no email leak",
    async (name) => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: "requester-1", name, email: "nameless.private@example.test" },
      } as any);
      mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
      mockedPrisma.follow.create.mockResolvedValueOnce({});

      const response = await POST(buildRequest("follow"), context());
      const body = await response.json();

      const call = mockedCreateNotification.mock.calls[0][0] as {
        title: string;
        message: string;
      };
      expect(call.message).toBe("A player started following you!");
      expect(call.title).not.toMatch(/nameless\.private@example\.test/);
      expect(JSON.stringify(mockedCreateNotification.mock.calls)).not.toMatch(
        /nameless\.private@example\.test/
      );
      expect(JSON.stringify(body)).not.toMatch(/nameless\.private@example\.test/);
    }
  );

  test("notification failure remains best-effort", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: "requester-1", name: "Alpha Player" },
    } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.create.mockResolvedValueOnce({});
    mockedCreateNotification.mockRejectedValueOnce(new Error("notification service down"));

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Successfully followed user" });
    expect(mockedPrisma.follow.create).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  test("unfollow uses the compound key and sends no notification", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "requester-1" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });
    mockedPrisma.follow.delete.mockResolvedValueOnce({});

    const response = await POST(buildRequest("unfollow"), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Successfully unfollowed user" });
    expect(mockedPrisma.follow.delete).toHaveBeenCalledWith({
      where: {
        followerId_followingId: { followerId: "requester-1", followingId: "target-1" },
      },
    });
    expect(mockedCreateNotification).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
  });

  test("invalid action returns 400 with no mutation or notification", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "requester-1" } } as any);
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ id: "target-1" });

    const response = await POST(buildRequest("delete-everything"), context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid action" });
    expect(mockedPrisma.follow.create).not.toHaveBeenCalled();
    expect(mockedPrisma.follow.delete).not.toHaveBeenCalled();
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("internal failure returns a safe 500 without leaking the raw error", async () => {
    mockedGetServerSession.mockResolvedValueOnce({ user: { id: "requester-1" } } as any);
    mockedPrisma.user.findUnique.mockRejectedValueOnce(
      new Error("db exploded for leak@example.test")
    );

    const response = await POST(buildRequest("follow"), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to update follow status" });
    expect(JSON.stringify(body)).not.toMatch(/leak@example\.test/);
  });
});
