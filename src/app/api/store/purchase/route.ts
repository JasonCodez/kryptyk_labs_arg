import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/requireAuthenticatedUser";
import { validateSameOrigin } from "@/lib/requestSecurity";

/**
 * POST /api/store/purchase
 * Body: { itemKey: string }
 *
 * Deducts points, grants item or increments quantity.
 * For warz_slot: increments warzChallengeSlots (capped at maxTotal).
 */
export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) return sameOriginError;

    const currentUser = await requireAuthenticatedUser();
    if (currentUser instanceof NextResponse) return currentUser;

    const { itemKey } = (await request.json()) as { itemKey: string };
    if (!itemKey) return NextResponse.json({ error: "itemKey required" }, { status: 400 });

    const item = await prisma.storeItem.findUnique({ where: { key: itemKey } });
    // isExclusive items (season-pass rewards, slot-machine prizes) are grant-only —
    // they must never be purchasable directly, even by POSTing a known key.
    if (!item || !item.isActive || item.isExclusive) {
      return NextResponse.json({ error: "Item not found or unavailable" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        totalPoints: true,
        purchasedPoints: true,
        warzChallengeSlots: true,
        streakShields: true,
        hintTokens: true,
        skipTokens: true,
        warzRematchTokens: true,
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.totalPoints < item.price) {
      return NextResponse.json({ error: "Insufficient points balance" }, { status: 400 });
    }

    // Check if non-consumable is already owned
    if (!item.isConsumable) {
      const existing = await prisma.userInventory.findUnique({
        where: { userId_itemId: { userId: currentUser.id, itemId: item.id } },
      });
      if (existing && existing.quantity > 0) {
        return NextResponse.json({ error: "You already own this item" }, { status: 409 });
      }
    }

    // Special cap check for warz_slot
    if (itemKey === "warz_slot") {
      const max = (item.metadata as { maxTotal?: number } | null)?.maxTotal ?? 10;
      if (user.warzChallengeSlots >= max) {
        return NextResponse.json({ error: `Maximum of ${max} Warz slots reached` }, { status: 400 });
      }
    }

    // Build user update
    const userUpdate: Record<string, unknown> = {
      totalPoints: { decrement: item.price },
      // Keep leaderboard-earned points stable when spending in the store.
      // Any ranking formula based on totalPoints - purchasedPoints stays unchanged.
      purchasedPoints: { decrement: item.price },
    };

    if (itemKey === "streak_shield") userUpdate.streakShields = { increment: 1 };
    else if (itemKey === "hint_token" || itemKey === "hint_pack_3" || itemKey === "hint_pack_5" || itemKey === "hint_pack_10") {
      const count = (item.metadata as { count?: number } | null)?.count ?? 1;
      userUpdate.hintTokens = { increment: count };
    }
    else if (itemKey === "skip_token") userUpdate.skipTokens = { increment: 1 };
    else if (itemKey === "warz_slot") userUpdate.warzChallengeSlots = { increment: 1 };
    else if (itemKey === "warz_rematch") userUpdate.warzRematchTokens = { increment: 1 };
    else if (itemKey === "xp_boost_24h") {
      // Stack: if boost already active, extend from current expiry; otherwise start from now
      const now = Date.now();
      const freshUser = await prisma.user.findUnique({ where: { id: currentUser.id }, select: { xpBoostExpiresAt: true } });
      const base = freshUser?.xpBoostExpiresAt && freshUser.xpBoostExpiresAt.getTime() > now
        ? freshUser.xpBoostExpiresAt.getTime()
        : now;
      userUpdate.xpBoostExpiresAt = new Date(base + 24 * 60 * 60 * 1000);
    }
    else if (itemKey === "streak_recovery") { /* inventory record is enough; consumed via /api/store/use/streak-recovery */ }
    else if (itemKey === "triple_or_nothing") userUpdate.tripleOrNothingTokens = { increment: 1 };

    await prisma.$transaction([
      // Deduct points + update counters
      prisma.user.update({
        where: { id: currentUser.id },
        data: userUpdate,
      }),
      // Upsert inventory record
      ...(item.isConsumable
        ? [
            prisma.userInventory.upsert({
              where: { userId_itemId: { userId: currentUser.id, itemId: item.id } },
              update: { quantity: { increment: 1 } },
              create: { userId: currentUser.id, itemId: item.id, quantity: 1 },
            }),
          ]
        : [
            prisma.userInventory.upsert({
              where: { userId_itemId: { userId: currentUser.id, itemId: item.id } },
              update: { quantity: 1 },
              create: { userId: currentUser.id, itemId: item.id, quantity: 1 },
            }),
          ]),
    ]);

    return NextResponse.json({ success: true, message: `Purchased: ${item.name}` });
  } catch (err) {
    console.error("[STORE PURCHASE]", err);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
