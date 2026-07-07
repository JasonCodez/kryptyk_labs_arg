/**
 * Feature flags — flip to `true` to re-enable a feature.
 *
 * STORE:   Point store (spend points on cosmetics / power-ups)
 * SEASONS: Season pass / seasonal reward track
 * TOKENS:  Hint & skip tokens usable in puzzles (tied to the store)
 */

export const FEATURE_STORE_ENABLED   = true;
export const FEATURE_SEASONS_ENABLED = true;
export const FEATURE_TOKENS_ENABLED  = true;

/**
 * Puzzle types that are still in development and hidden from players.
 * Admin tooling (puzzle creator, /admin/arg, escape-room designer) still
 * works so these can keep being authored — they're just filtered out of
 * everything a regular player sees (listings, search, categories, nav).
 */
export const HIDDEN_PUZZLE_TYPES = [
  "escape_room",
  "jim_wyze_case",
  "detective_case",
  "crime_rpg",
  "parasite_code",
  "gridlock_file",
  "arg",
] as const;

export function isHiddenPuzzleType(puzzleType: string | null | undefined): boolean {
  return !!puzzleType && (HIDDEN_PUZZLE_TYPES as readonly string[]).includes(puzzleType);
}
