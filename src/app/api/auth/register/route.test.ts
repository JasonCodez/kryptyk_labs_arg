import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { isAllowedDisplayName } from "@/lib/display-name-validator";
import { POST } from "./route";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    verificationToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/requestSecurity", () => ({
  enforceRateLimit: jest.fn(),
  getClientAddress: jest.fn(() => "127.0.0.1"),
}));

jest.mock("@/lib/display-name-validator", () => ({
  isAllowedDisplayName: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: { hash: jest.fn() },
}));

const db = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  verificationToken: { deleteMany: jest.Mock; create: jest.Mock };
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevRequireVerification = process.env.REQUIRE_EMAIL_VERIFICATION;

  beforeEach(() => {
    jest.clearAllMocks();
    // Non-production, no explicit verification requirement -> dev flow (auto-verified, no email sent).
    Reflect.set(process.env, "NODE_ENV", "test");
    delete process.env.REQUIRE_EMAIL_VERIFICATION;

    (enforceRateLimit as jest.Mock).mockResolvedValue(null);
    (isAllowedDisplayName as jest.Mock).mockReturnValue({ ok: true });
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-password");

    db.user.findUnique.mockResolvedValue(null); // no existing user with this email
    db.user.findFirst.mockResolvedValue(null); // display name not taken
    db.user.count.mockResolvedValue(0);
    db.user.create.mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New Player",
      emailVerified: new Date(),
    });
  });

  afterAll(() => {
    Reflect.set(process.env, "NODE_ENV", prevEnv);
    if (prevRequireVerification === undefined) {
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    } else {
      process.env.REQUIRE_EMAIL_VERIFICATION = prevRequireVerification;
    }
  });

  test("a brand-new signup pre-claims its starting level so the level-up slot machine doesn't fire", async () => {
    const response = await POST(
      request({ name: "New Player", email: "new@example.com", password: "password123" }),
    );

    expect(response.status).toBe(201);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ levelRewardClaimed: 1 }),
      }),
    );
  });
});
