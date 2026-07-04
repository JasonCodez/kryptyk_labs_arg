import crypto from "crypto";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { resolveLevelUpSpins } from "../resolveLevelUpSpins";

// crypto.randomInt has an overloaded (min, max, callback) async signature; cast the spy
// to the plain synchronous (min, max) => number overload actually used in production code.
function spyOnRandomInt() {
  return jest.spyOn(crypto, "randomInt") as unknown as jest.SpyInstance<number, [number, number]>;
}

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    storeItem: {
      findUnique: jest.fn(),
    },
    userInventory: {
      upsert: jest.fn(),
    },
    slotSpinRecord: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/notification-service", () => ({
  createNotification: jest.fn().mockResolvedValue(null),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; updateMany: jest.Mock };
  storeItem: { findUnique: jest.Mock };
  userInventory: { upsert: jest.Mock };
  slotSpinRecord: { createMany: jest.Mock };
  $transaction: jest.Mock;
};
const mockedCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;

beforeEach(() => {
  jest.clearAllMocks();
  // Interactive transactions in prod pass a `tx` client scoped to the transaction;
  // in tests, the mocked prisma object doubles as `tx` since all its methods are mocks.
  mockedPrisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(mockedPrisma));
  mockedCreateNotification.mockResolvedValue(null as never);
});

describe("resolveLevelUpSpins", () => {
  test("returns null when nothing is owed (level === levelRewardClaimed)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 5, levelRewardClaimed: 5, slotPityCounter: 0 });
    const result = await resolveLevelUpSpins("user-1");
    expect(result).toBeNull();
    expect(mockedPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  test("returns null when the user doesn't exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await resolveLevelUpSpins("ghost");
    expect(result).toBeNull();
  });

  test("a single level-up produces exactly one spin record and result", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 6, levelRewardClaimed: 5, slotPityCounter: 0 });
    spyOnRandomInt().mockReturnValueOnce(10); // lands in "common" (0-49)
    mockedPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.slotSpinRecord.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await resolveLevelUpSpins("user-1");

    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({ level: 6, tier: "common", pityTriggered: false });
    expect(mockedPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", levelRewardClaimed: { lt: 6 } },
      data: expect.objectContaining({ levelRewardClaimed: 6, slotPityCounter: 1 }),
    });
    expect(mockedPrisma.slotSpinRecord.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "user-1", level: 6, tier: "common" })],
    });
    // Common tier shouldn't trigger the "epic/legendary only" win notification.
    expect(mockedCreateNotification).not.toHaveBeenCalled();
  });

  test("jumping multiple levels at once produces one independent spin per level", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 8, levelRewardClaimed: 5, slotPityCounter: 0 });
    spyOnRandomInt().mockReturnValueOnce(10).mockReturnValueOnce(60).mockReturnValueOnce(85);
    mockedPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await resolveLevelUpSpins("user-1");

    expect(result).toHaveLength(3);
    expect(result!.map((r) => r.level)).toEqual([6, 7, 8]);
    expect(result!.map((r) => r.tier)).toEqual(["common", "uncommon", "rare"]);
  });

  test("concurrent claim race: bails out without granting cosmetics or writing history", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 6, levelRewardClaimed: 5, slotPityCounter: 0 });
    spyOnRandomInt().mockReturnValueOnce(95); // epic tier -> would grant a cosmetic
    mockedPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 }); // another request won the race

    const result = await resolveLevelUpSpins("user-1");

    expect(result).toBeNull();
    expect(mockedPrisma.storeItem.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.userInventory.upsert).not.toHaveBeenCalled();
    expect(mockedPrisma.slotSpinRecord.createMany).not.toHaveBeenCalled();
  });

  test("epic/legendary tier grants the cosmetic via the existing UserInventory upsert pattern", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 6, levelRewardClaimed: 5, slotPityCounter: 0 });
    spyOnRandomInt().mockReturnValueOnce(95); // epic
    mockedPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    mockedPrisma.storeItem.findUnique.mockResolvedValueOnce({ id: "item-1", key: "frame_jackpot_platinum" });

    const result = await resolveLevelUpSpins("user-1");

    expect(result![0].prizeType).toBe("cosmetic");
    expect(mockedPrisma.userInventory.upsert).toHaveBeenCalledWith({
      where: { userId_itemId: { userId: "user-1", itemId: "item-1" } },
      create: { userId: "user-1", itemId: "item-1", quantity: 1 },
      update: { quantity: { increment: 1 } },
    });
    expect(mockedCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "slot_win" })
    );
  });

  test("pity forces a rare-or-better spin on the 10th consecutive low-tier roll", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ level: 6, levelRewardClaimed: 5, slotPityCounter: 9 });
    // First roll lands common again (would be the 10th consecutive low-tier spin) -> pity forces a reroll.
    spyOnRandomInt().mockReturnValueOnce(10).mockReturnValueOnce(50); // second call = pity reroll (rare/epic/legendary range)
    mockedPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await resolveLevelUpSpins("user-1");

    expect(result![0].pityTriggered).toBe(true);
    expect(["rare", "epic", "legendary"]).toContain(result![0].tier);
    expect(mockedPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", levelRewardClaimed: { lt: 6 } },
      data: expect.objectContaining({ slotPityCounter: 0 }),
    });
  });
});
