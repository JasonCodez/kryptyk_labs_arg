import crypto from "crypto";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import {
  rollTier,
  rollPityTier,
  isPityEligible,
  getTierDef,
  PITY_THRESHOLD,
  type SlotTierId,
  type SlotPrizeType,
} from "./tiers";

export interface SlotSpinResult {
  level: number;
  tier: SlotTierId;
  label: string;
  colorKey: SlotTierId;
  prizeType: SlotPrizeType;
  prizeKey?: string;
  prizeAmount?: number;
  pityTriggered: boolean;
}

/**
 * Resolves every unclaimed level-up into its own independent slot spin (replacing the
 * old flat-aggregate grantLevelReward). Server-determines every outcome — the client
 * only ever animates toward a result already decided here, it never rolls anything
 * itself. Uses an interactive transaction so the optimistic-lock check, cosmetic
 * grants, and spin-history log either all commit or none do.
 */
export async function resolveLevelUpSpins(userId: string): Promise<SlotSpinResult[] | null> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { level: true, levelRewardClaimed: true, slotPityCounter: true },
    });
    if (!user) return null;

    const { level, levelRewardClaimed } = user;
    if (level <= levelRewardClaimed) return null;

    const levelsToSpin: number[] = [];
    for (let lv = levelRewardClaimed + 1; lv <= level; lv++) levelsToSpin.push(lv);

    let pityCounter = user.slotPityCounter;
    let totalPoints = 0;
    let totalHintTokens = 0;
    let totalSkipTokens = 0;
    const cosmeticKeys: string[] = [];
    const results: SlotSpinResult[] = [];
    const spinRecords: {
      level: number;
      tier: string;
      prizeType: string;
      prizeKey?: string;
      prizeAmount?: number;
      pityTriggered: boolean;
    }[] = [];

    for (const lv of levelsToSpin) {
      let tier = rollTier(crypto.randomInt(0, 100));
      let pityTriggered = false;

      if (isPityEligible(tier)) {
        pityCounter = 0;
      } else {
        pityCounter++;
        if (pityCounter >= PITY_THRESHOLD) {
          tier = rollPityTier(crypto.randomInt(0, 100));
          pityCounter = 0;
          pityTriggered = true;
        }
      }

      const def = getTierDef(tier);
      const prize = def.resolvePrize(lv);

      totalPoints += prize.points ?? 0;
      totalHintTokens += prize.hintTokens ?? 0;
      totalSkipTokens += prize.skipTokens ?? 0;
      if (prize.itemKey) cosmeticKeys.push(prize.itemKey);

      spinRecords.push({
        level: lv,
        tier,
        prizeType: prize.type,
        prizeKey: prize.itemKey,
        prizeAmount: prize.points,
        pityTriggered,
      });

      results.push({
        level: lv,
        tier,
        label: def.label,
        colorKey: def.colorKey,
        prizeType: prize.type,
        prizeKey: prize.itemKey,
        prizeAmount: prize.points,
        pityTriggered,
      });
    }

    // Optimistic lock: only succeeds if nothing has claimed up to `level` in the meantime.
    const updated = await tx.user.updateMany({
      where: { id: userId, levelRewardClaimed: { lt: level } },
      data: {
        levelRewardClaimed: level,
        slotPityCounter: pityCounter,
        ...(totalPoints > 0 && { totalPoints: { increment: totalPoints } }),
        ...(totalHintTokens > 0 && { hintTokens: { increment: totalHintTokens } }),
        ...(totalSkipTokens > 0 && { skipTokens: { increment: totalSkipTokens } }),
      },
    });

    // A concurrent call already claimed this — bail before granting cosmetics/history.
    if (updated.count === 0) return null;

    for (const itemKey of cosmeticKeys) {
      const item = await tx.storeItem.findUnique({ where: { key: itemKey } });
      if (!item) continue;
      await tx.userInventory.upsert({
        where: { userId_itemId: { userId, itemId: item.id } },
        create: { userId, itemId: item.id, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });
    }

    await tx.slotSpinRecord.createMany({
      data: spinRecords.map((r) => ({ userId, ...r })),
    });

    return results;
  }).then(async (results) => {
    // Fire outside the transaction — a best-effort notification shouldn't hold a DB lock,
    // and only epic/legendary wins get one to avoid spamming a notification per level-up.
    if (results) {
      for (const spin of results) {
        if (spin.tier !== "epic" && spin.tier !== "legendary") continue;
        await createNotification({
          userId,
          type: "slot_win",
          title: spin.tier === "legendary" ? "🎰 Legendary spin!" : "🎰 Epic spin!",
          message: `Your level ${spin.level} slot spin landed on ${spin.label} — check your inventory!`,
          icon: "🎰",
        }).catch(() => {});
      }
    }
    return results;
  });
}
