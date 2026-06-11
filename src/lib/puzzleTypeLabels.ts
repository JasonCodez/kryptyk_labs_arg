/**
 * Single source of truth for puzzle type display labels.
 * Import this instead of defining local maps or using .replace(/_/g, " ").
 */
export const PUZZLE_TYPE_LABELS: Record<string, string> = {
  general:         "General",
  riddle:          "Riddle",
  math:            "Math",
  jigsaw:          "Jigsaw",
  sudoku:          "Sudoku",
  word_search:     "Word Search",
  word_crack:      "Hidden Word",
  anagram_blitz:   "Anagram Blitz",
  crack_safe:      "Crack the Safe",
  vault:           "The Vault",
  escape_room:     "Escape Room",
  jim_wyze_case:   "Jim Wyze Case",
  detective_case:  "Wise Up",
  crime_rpg:       "Crime Case",
  parasite_code:   "Parasite Code",
  gridlock_file:   "Gridlock File",
  blackout:        "Declassify",
  code_master:     "Code Master",
  arg:             "ARG",
};

/**
 * Returns the human-readable label for a puzzle type.
 * Falls back to a title-cased version of the key if not in the map.
 */
export function getPuzzleTypeLabel(puzzleType: string): string {
  return (
    PUZZLE_TYPE_LABELS[puzzleType] ??
    puzzleType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
