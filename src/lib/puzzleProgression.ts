/**
 * Sequential puzzle-type progression: puzzles within a type unlock strictly
 * in `order` — each puzzle stays locked until the one immediately before it
 * (by order, tiebreak createdAt) is solved. Boss puzzles are ordinary links
 * in that same chain; marking one `isBossPuzzle` labels it for rewards
 * (achievements) but doesn't change how locking works.
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
  /** The puzzle immediately before this one in sequence — set only when locked. */
  unlocksAfter?: { id: string; title: string };
}

/**
 * Computes lock state for every progression-eligible puzzle in a strict
 * 1 -> 2 -> 3 chain per puzzleType. Puzzles that are exempt-type, in a type
 * with no boss puzzle, or otherwise unlocked are simply absent from the
 * returned map — callers should treat a missing entry as unlocked
 * (`locked: false`).
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

    // The first puzzle in the type is always unlocked; every other puzzle
    // requires the one immediately before it (in this same sorted list) to
    // be solved, regardless of whether either is a boss.
    let previousSolved = true;
    let previous: { id: string; title: string } | undefined;

    for (const puzzle of sorted) {
      const locked = !previousSolved;
      result.set(puzzle.id, {
        locked,
        unlocksAfter: locked ? previous : undefined,
      });

      previousSolved = solvedPuzzleIds.has(puzzle.id);
      previous = { id: puzzle.id, title: puzzle.title };
    }
  }

  return result;
}
