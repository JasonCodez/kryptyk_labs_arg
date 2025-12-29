export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const rarityColors: Record<Rarity, { bg: string; text: string; border: string }> = {
  common: { bg: "rgba(200, 200, 200, 0.1)", text: "#CCCCCC", border: "#CCCCCC" },
  uncommon: { bg: "rgba(76, 175, 80, 0.1)", text: "#4CAF50", border: "#4CAF50" },
  rare: { bg: "rgba(56, 145, 166, 0.1)", text: "#3891A6", border: "#3891A6" },
  epic: { bg: "rgba(124, 58, 237, 0.08)", text: "#7C3AED", border: "#7C3AED" },
  legendary: { bg: "rgba(255, 193, 7, 0.1)", text: "#FFC107", border: "#FFC107" },
};
