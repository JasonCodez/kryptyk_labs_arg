/**
 * Sequential puzzle-type progression: puzzles within a type unlock in `order`,
 * grouped into chapters that end at a boss puzzle. See the "How it works"
 * section of the progression-lock plan for the exact lock rules this encodes.
 *
 * A puzzleType is only gated once at least one of its puzzles is marked
 * `isBossPuzzle` — types with no boss puzzle stay fully open, so shipping
 * this feature never retroactively locks an existing, unmodified catalog.
 */

// Purpose-built exemption list for progression specifically — deliberately
// separate from HIDDEN_PUZZLE_TYPES (featureFlags.ts), which hides types
// that are merely still in development. escape_room/jim_wyze_case should
// stay un-gated even after they ship and get un-hidden; debrief/arg are
// daily-rotation/narrative content, not a "many puzzles of one kind" ladder.
const PROGRESSION_EXEMPT_PUZZLE_TYPES = ["escape_room", "jim_wyze_case", "debrief", "arg"] as const;

export function isProgressionExemptType(puzzleType: string): boolean {
  return (PROGRESSION_EXEMPT_PUZZLE_TYPES as readonly string[]).includes(puzzleType);
}

export interface ProgressionPuzzleInput {
  id: string;
  title: string;
  puzzleType: string;
  order: number;
  isBossPuzzle: boolean;
  createdAt: Date;
}

export interface PuzzleLockState {
  locked: boolean;
  /** The boss puzzle whose completion unlocks this one — set only when locked. */
  unlocksAfter?: { id: string; title: string };
}

/**
 * Computes lock state for every progression-eligible, boss-gated puzzle.
 * Puzzles that are exempt-type, in a type with no boss puzzle, or otherwise
 * unlocked are simply absent from the returned map — callers should treat a
 * missing entry as unlocked (`locked: false`).
 */
export function computeLockedPuzzleIds(
  puzzles: ProgressionPuzzleInput[],
  solvedPuzzleIds: Set<string>
): Map<string, PuzzleLockState> {
  const result = new Map<string, PuzzleLockState>();

  const byType = new Map<string, ProgressionPuzzleInput[]>();
  for (const puzzle of puzzles) {
    if (isProgressionExemptType(puzzle.puzzleType)) continue;
    const list = byType.get(puzzle.puzzleType);
    if (list) list.push(puzzle);
    else byType.set(puzzle.puzzleType, [puzzle]);
  }

  for (const group of byType.values()) {
    const hasBoss = group.some((p) => p.isBossPuzzle);
    if (!hasBoss) continue;

    const sorted = [...group].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Chapter 1 always starts unlocked; each boss solve unlocks the next chapter.
    let chapterUnlocked = true;
    let chapterNonBossAllSolved = true;
    let priorBoss: { id: string; title: string } | undefined;

    for (const puzzle of sorted) {
      if (puzzle.isBossPuzzle) {
        const bossLocked = !chapterUnlocked || !chapterNonBossAllSolved;
        result.set(puzzle.id, {
          locked: bossLocked,
          // Only point at a specific prerequisite when the whole chapter is
          // inaccessible; "boss not ready yet" is a same-chapter condition
          // with no single puzzle to name.
          unlocksAfter: !chapterUnlocked ? priorBoss : undefined,
        });

        const bossSolved = solvedPuzzleIds.has(puzzle.id);
        chapterUnlocked = chapterUnlocked && bossSolved;
        chapterNonBossAllSolved = true;
        priorBoss = { id: puzzle.id, title: puzzle.title };
      } else {
        result.set(puzzle.id, {
          locked: !chapterUnlocked,
          unlocksAfter: !chapterUnlocked ? priorBoss : undefined,
        });
        if (!solvedPuzzleIds.has(puzzle.id)) {
          chapterNonBossAllSolved = false;
        }
      }
    }
  }

  return result;
}
