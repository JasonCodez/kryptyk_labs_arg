import prisma from "@/lib/prisma";
import { HIDDEN_PUZZLE_TYPES } from "@/lib/featureFlags";
import { isProgressionExemptType } from "@/lib/puzzleProgression";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

// One achievement per boss puzzle "slot" — i.e. per (puzzleType, chapter position), not per
// solve count. Chapter 1 of a type is its first boss, chapter 2 its second, and so on, using
// the exact same order/createdAt sort as src/lib/puzzleProgression.ts. Regenerated (upserted,
// never deleted) each time this is called, so newly-authored boss puzzles automatically get an
// achievement without any admin action — see the call site in
// src/app/api/user/achievements/route.ts.
const CHAPTER_RARITY_BY_INDEX = ["rare", "epic", "legendary"] as const;
const CHAPTER_ICON_BY_INDEX = ["⚔️", "🗡️", "👑"] as const;

export async function ensureBossPuzzleAchievements() {
  const bossPuzzles = await prisma.puzzle.findMany({
    where: {
      isActive: true,
      isWarzExclusive: false,
      isBossPuzzle: true,
      puzzleType: { notIn: [...HIDDEN_PUZZLE_TYPES] },
    },
    select: { puzzleType: true, order: true, createdAt: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const byType = new Map<string, number>(); // puzzleType -> count of boss puzzles seen so far
  const upserts: ReturnType<typeof prisma.achievement.upsert>[] = [];

  for (const puzzle of bossPuzzles) {
    if (isProgressionExemptType(puzzle.puzzleType)) continue;
    const chapterIndex = (byType.get(puzzle.puzzleType) ?? 0) + 1;
    byType.set(puzzle.puzzleType, chapterIndex);

    const typeLabel = getPuzzleTypeLabel(puzzle.puzzleType);
    const tierIdx = Math.min(chapterIndex, CHAPTER_RARITY_BY_INDEX.length) - 1;
    const name = `boss_${puzzle.puzzleType}_ch${chapterIndex}`;
    const fields = {
      title: `${typeLabel} Boss — Chapter ${chapterIndex}`,
      description: `Defeated the Chapter ${chapterIndex} boss puzzle in ${typeLabel}`,
      icon: CHAPTER_ICON_BY_INDEX[tierIdx],
      category: "boss",
      rarity: CHAPTER_RARITY_BY_INDEX[tierIdx],
      requirement: `Solve the Chapter ${chapterIndex} ${typeLabel} boss puzzle`,
      conditionType: "boss_chapter_cleared",
      relatedPuzzleType: puzzle.puzzleType,
      relatedChapterIndex: chapterIndex,
    };

    upserts.push(
      prisma.achievement.upsert({
        where: { name },
        update: fields,
        create: { name, ...fields },
      })
    );
  }

  return Promise.all(upserts);
}

export async function ensureGridlockArcAchievement() {
  return prisma.achievement.upsert({
    where: { name: "gridlock_arc_complete" },
    update: {
      title: "Arc Complete",
      description: "Solved all 7 days of a Gridlock arc",
      icon: "🗂️",
      category: "special",
      rarity: "exclusive",
      requirement: "Complete a full 7-day Gridlock arc",
      conditionType: "custom",
      conditionValue: undefined,
    },
    create: {
      name: "gridlock_arc_complete",
      title: "Arc Complete",
      description: "Solved all 7 days of a Gridlock arc",
      icon: "🗂️",
      category: "special",
      rarity: "exclusive",
      requirement: "Complete a full 7-day Gridlock arc",
      conditionType: "custom",
    },
  });
}