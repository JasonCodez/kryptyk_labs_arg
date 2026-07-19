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
      create: jest.fn(),
    },
  },
}));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};

function request() {
  return new NextRequest("http://localhost/api/user/info", { method: "GET" });
}

describe("GET /api/user/info", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: "oauth-new@example.com", name: "OAuth Player", image: null },
    });
    db.user.findUnique.mockResolvedValue(null); // no existing row -> auto-provisioning path
  });

  test("auto-provisioning a new OAuth user pre-claims its starting level", async () => {
    db.user.create.mockResolvedValueOnce({
      id: "user-2",
      role: "PLAYER",
      image: null,
      nameChanged: false,
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ levelRewardClaimed: 1 }),
      }),
    );
  });
});
