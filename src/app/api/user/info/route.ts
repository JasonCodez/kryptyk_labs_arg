import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calcLevel } from "@/lib/levels";

export async function GET(request: NextRequest) {
  try {
    // Use the real NextAuth server session; remove dev-header shortcut.
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt to select `nameChanged` if the schema supports it; fall back
    // to selecting without it so local environments without the migration
    // do not break with a 500.
    let user: any = null;
    try {
      user = await (prisma.user as any).findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true, image: true, nameChanged: true, xp: true, level: true, xpTitle: true, name: true, totalPoints: true, activeFlair: true, activeSkin: true, activeTitle: true, isFounder: true, forumRulesAcceptedAt: true },
      });
    } catch {
      // Fallback to older schema without `nameChanged`
      try {
      user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, role: true, image: true, xp: true, level: true, xpTitle: true, name: true, totalPoints: true, activeFlair: true, activeSkin: true, activeTitle: true, isFounder: true, forumRulesAcceptedAt: true },
        });
      } catch (ee) {
        throw ee;
      }
    }

    if (!user) {
      // Create a lightweight user record; try including `nameChanged` first,
      // fall back if the column doesn't exist.
      try {
        const created = await (prisma.user as any).create({
          data: {
            email: session.user.email,
            name: session.user.name || undefined,
            image: session.user.image || undefined,
            role: 'PLAYER',
            // Starting level is 1 by default; mark it pre-claimed so the level-up
            // slot machine doesn't fire for a level the user never "leveled up" into.
            levelRewardClaimed: 1,
          },
          select: { id: true, role: true, image: true, nameChanged: true },
        });
        return NextResponse.json({ id: created.id, role: created.role, image: created.image, nameChanged: created.nameChanged ?? false });
      } catch {
        const created = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || undefined,
            image: session.user.image || undefined,
            role: 'PLAYER',
            levelRewardClaimed: 1,
          },
          select: { id: true, role: true, image: true },
        });
        return NextResponse.json({ id: created.id, role: created.role, image: created.image, nameChanged: false });
      }
    }

    // Map legacy word flair values to emojis
    const FLAIR_EMOJI: Record<string, string> = { crown: "👑", fire: "🔥", lightning: "⚡", warz_legend: "⚔️🏆" };
    const resolvedFlair = (() => { const f = user.activeFlair; if (!f || f === "none") return null; return FLAIR_EMOJI[f] ?? f; })();
    const premiumPass = await prisma.userSeasonPass.findFirst({
      where: { userId: user.id, isPremium: true },
      select: { userId: true },
    });

    // Count unlocked-but-unclaimed season rewards for the nav badge
    let unclaimedSeasonRewards = 0;
    try {
      const now = new Date();
      const activeSeason = await prisma.season.findFirst({
        where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
        select: { id: true, tiers: { select: { tierNumber: true, xpRequired: true, freeRewardType: true, premRewardType: true } } },
      });
      if (activeSeason) {
        const pass = await prisma.userSeasonPass.findUnique({
          where: { userId_seasonId: { userId: user.id, seasonId: activeSeason.id } },
          select: { seasonXp: true, isPremium: true, claimedFree: true, claimedPrem: true },
        });
        if (pass) {
          const claimedFreeSet = new Set(pass.claimedFree);
          const claimedPremSet = new Set(pass.claimedPrem);
          for (const tier of activeSeason.tiers) {
            if (pass.seasonXp < tier.xpRequired) continue;
            if (tier.freeRewardType && !claimedFreeSet.has(tier.tierNumber)) unclaimedSeasonRewards++;
            if (tier.premRewardType && pass.isPremium && !claimedPremSet.has(tier.tierNumber)) unclaimedSeasonRewards++;
          }
        }
      }
    } catch {
      // non-fatal — badge just won't show
    }

    return NextResponse.json({ id: user.id, role: user.role, image: user.image, nameChanged: user.nameChanged ?? false, totalXp: user.xp ?? 0, totalPoints: user.totalPoints ?? 0, username: user.name ?? null, activeFlair: resolvedFlair, activeSkin: user.activeSkin ?? 'default', activeTitle: user.activeTitle ?? 'none', isFounder: user.isFounder ?? false, isPremium: !!premiumPass, unclaimedSeasonRewards, forumRulesAccepted: !!user.forumRulesAcceptedAt, ...calcLevel(user.xp ?? 0) });
  } catch (error) {
    console.error("Error fetching user info:", error);
    return NextResponse.json(
      { error: "Failed to fetch user info" },
      { status: 500 }
    );
  }
}
