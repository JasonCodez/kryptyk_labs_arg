import { SLOT_TIERS, rollTier, rollPityTier, isPityEligible, getTierDef } from "../tiers";

describe("SLOT_TIERS", () => {
  test("weights sum to exactly 100 (oddsPercent must be exact, not approximate)", () => {
    const total = SLOT_TIERS.reduce((sum, t) => sum + t.weight, 0);
    expect(total).toBe(100);
  });

  test("oddsPercent matches weight for every tier (single source of truth for disclosure UI)", () => {
    for (const tier of SLOT_TIERS) {
      expect(tier.oddsPercent).toBe(tier.weight);
    }
  });
});

describe("rollTier", () => {
  test("boundary values resolve to the correct tier", () => {
    expect(rollTier(0)).toBe("common");
    expect(rollTier(49.99)).toBe("common");
    expect(rollTier(50)).toBe("uncommon");
    expect(rollTier(79.99)).toBe("uncommon");
    expect(rollTier(80)).toBe("rare");
    expect(rollTier(93.99)).toBe("rare");
    expect(rollTier(94)).toBe("epic");
    expect(rollTier(98.99)).toBe("epic");
    expect(rollTier(99)).toBe("legendary");
    expect(rollTier(99.99)).toBe("legendary");
  });

  test("observed frequencies over a large sample land within a few percent of declared weights", () => {
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const tier = rollTier(Math.random() * 100);
      counts[tier]++;
    }
    for (const t of SLOT_TIERS) {
      const observedPercent = (counts[t.id] / N) * 100;
      expect(Math.abs(observedPercent - t.weight)).toBeLessThan(1.5);
    }
  });
});

describe("rollPityTier", () => {
  test("always returns a rare-or-better tier, never common/uncommon", () => {
    for (let i = 0; i < 1000; i++) {
      const tier = rollPityTier(Math.random() * 100);
      expect(isPityEligible(tier)).toBe(true);
    }
  });

  test("distribution across rare/epic/legendary roughly matches their relative weights", () => {
    const counts: Record<string, number> = { rare: 0, epic: 0, legendary: 0 };
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const tier = rollPityTier(Math.random() * 100) as "rare" | "epic" | "legendary";
      counts[tier]++;
    }
    // rare(14):epic(5):legendary(1) out of 20 total -> 70%/25%/5%
    expect(counts.rare / N).toBeGreaterThan(0.6);
    expect(counts.rare / N).toBeLessThan(0.8);
    expect(counts.legendary / N).toBeLessThan(0.12);
  });
});

describe("isPityEligible", () => {
  test("common/uncommon are not pity-eligible, rare/epic/legendary are", () => {
    expect(isPityEligible("common")).toBe(false);
    expect(isPityEligible("uncommon")).toBe(false);
    expect(isPityEligible("rare")).toBe(true);
    expect(isPityEligible("epic")).toBe(true);
    expect(isPityEligible("legendary")).toBe(true);
  });
});

describe("resolvePrize", () => {
  test("common/uncommon/rare scale with level and never include a cosmetic", () => {
    for (const id of ["common", "uncommon", "rare"] as const) {
      const prize = getTierDef(id).resolvePrize(10);
      expect(prize.itemKey).toBeUndefined();
      expect(prize.points).toBeGreaterThan(0);
    }
  });

  test("epic/legendary always include a cosmetic item key from the declared pools", () => {
    const epic = getTierDef("epic").resolvePrize(5);
    expect(epic.type).toBe("cosmetic");
    expect(["frame_jackpot_platinum", "flair_jackpot", "name_color_jackpot_gold"]).toContain(epic.itemKey);

    const legendary = getTierDef("legendary").resolvePrize(5);
    expect(legendary.type).toBe("cosmetic");
    expect(["theme_jackpot_neon", "frame_jackpot_diamond"]).toContain(legendary.itemKey);
  });

  test("common tier has a floor of 40 points even at level 1", () => {
    const prize = getTierDef("common").resolvePrize(1);
    expect(prize.points).toBe(40);
  });
});
