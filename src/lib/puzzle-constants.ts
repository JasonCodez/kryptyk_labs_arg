/**
 * Centralized puzzle configuration constants
 * Single source of truth for all puzzle-related options
 */

export const PUZZLE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'arg', label: 'ARG' },
  { value: 'puzzle', label: 'Puzzle' },
  { value: 'challenge', label: 'Challenge' },
] as const;

export const PUZZLE_DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'extreme', label: 'Extreme' },
] as const;

export const DEFAULT_CATEGORY = 'general';
export const DEFAULT_DIFFICULTY = 'medium';

// Helper functions
export function getCategoryLabel(value: string): string {
  return PUZZLE_CATEGORIES.find(c => c.value === value)?.label || value;
}

export function getDifficultyLabel(value: string): string {
  return PUZZLE_DIFFICULTIES.find(d => d.value === value)?.label || value;
}
