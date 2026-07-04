// Slot machine prize table — the level-up reward spin.
// Pure config, no Prisma import: safe to import from client code so the "view odds"
// UI renders exactly the same table that drives the actual roll, with zero drift risk.

export type SlotTierId = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type SlotPrizeType = "points" | "hint_tokens" | "skip_tokens" | "cosmetic";

export interface SlotPrize {
  type: SlotPrizeType;
  points?: number;
  hintTokens?: number;
  skipTokens?: number;
  /** StoreItem.key, when type === "cosmetic" */
  itemKey?: string;
}

export interface SlotTierDef {
  id: SlotTierId;
  label: string;
  weight: number;
  /** Same number as `weight` — weights are authored to sum to 100, so this is exact. */
  oddsPercent: number;
  /** Reuses the app-wide rarity palette (src/lib/rarity.ts) — no new colors invented. */
  colorKey: SlotTierId;
  /** Human-readable summary for the disclosure UI. */
  rewardDescription: string;
  resolvePrize: (level: number) => SlotPrize;
}

// Exclusive cosmetics granted only by a slot spin (seeded in prisma/seed.ts).
export const SLOT_EPIC_ITEMS = ["frame_jackpot_platinum", "flair_jackpot", "name_color_jackpot_gold"];
export const SLOT_LEGENDARY_ITEMS = ["theme_jackpot_neon", "frame_jackpot_diamond"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const SLOT_TIERS: SlotTierDef[] = [
  {
    id: "common",
    label: "Common",
    weight: 50,
    oddsPercent: 50,
    colorKey: "common",
    rewardDescription: "Points, scaling with your level",
    resolvePrize: (level) => ({ type: "points", points: Math.max(40, 20 * level) }),
  },
  {
    id: "uncommon",
    label: "Uncommon",
    weight: 30,
    oddsPercent: 30,
    colorKey: "uncommon",
    rewardDescription: "Points + a hint token",
    resolvePrize: (level) => ({ type: "hint_tokens", points: 30 * level, hintTokens: 1 }),
  },
  {
    id: "rare",
    label: "Rare",
    weight: 14,
    oddsPercent: 14,
    colorKey: "rare",
    rewardDescription: "Points + a skip token",
    resolvePrize: (level) => ({ type: "skip_tokens", points: 50 * level, skipTokens: 1 }),
  },
  {
    id: "epic",
    label: "Epic",
    weight: 5,
    oddsPercent: 5,
    colorKey: "epic",
    rewardDescription: "An exclusive cosmetic + bonus points",
    resolvePrize: () => ({ type: "cosmetic", points: 100, itemKey: pick(SLOT_EPIC_ITEMS) }),
  },
  {
    id: "legendary",
    label: "Legendary",
    weight: 1,
    oddsPercent: 1,
    colorKey: "legendary",
    rewardDescription: "A rare exclusive cosmetic + big bonus points",
    resolvePrize: () => ({ type: "cosmetic", points: 250, itemKey: pick(SLOT_LEGENDARY_ITEMS) }),
  },
];

/** Guarantee a rare-or-better spin after this many consecutive common/uncommon spins. */
export const PITY_THRESHOLD = 10;
export const PITY_MIN_TIER: SlotTierId = "rare";

const PITY_TIER_IDS = SLOT_TIERS.filter((t) => rankOf(t.id) >= rankOf(PITY_MIN_TIER)).map((t) => t.id);
const PITY_WEIGHTS = SLOT_TIERS.filter((t) => PITY_TIER_IDS.includes(t.id));

function rankOf(id: SlotTierId): number {
  return SLOT_TIERS.findIndex((t) => t.id === id);
}

/** Pure cumulative-weight lookup. `rand` must be in [0, 100). */
export function rollTier(rand: number): SlotTierId {
  let acc = 0;
  for (const tier of SLOT_TIERS) {
    acc += tier.weight;
    if (rand < acc) return tier.id;
  }
  return SLOT_TIERS[SLOT_TIERS.length - 1].id;
}

/** Same as rollTier, but restricted to rare-or-better tiers — used when pity forces a reroll. */
export function rollPityTier(rand: number): SlotTierId {
  const totalWeight = PITY_WEIGHTS.reduce((sum, t) => sum + t.weight, 0);
  const scaled = (rand / 100) * totalWeight;
  let acc = 0;
  for (const tier of PITY_WEIGHTS) {
    acc += tier.weight;
    if (scaled < acc) return tier.id;
  }
  return PITY_WEIGHTS[PITY_WEIGHTS.length - 1].id;
}

export function isPityEligible(tier: SlotTierId): boolean {
  return rankOf(tier) >= rankOf(PITY_MIN_TIER);
}

export function getTierDef(id: SlotTierId): SlotTierDef {
  const def = SLOT_TIERS.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown slot tier: ${id}`);
  return def;
}
