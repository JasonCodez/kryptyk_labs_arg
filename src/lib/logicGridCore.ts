// Shared validation/normalization for Logic Grid ("zebra") deduction puzzles — mirrors the
// Input -> validate/normalize -> Normalized pattern established in crosswordCore.ts. Used by
// the admin editor, the solving API route, and sanitizePublicPuzzleData.

export type LogicGridSolution = Record<string, Record<string, string>>;

export interface LogicGridCategoryInput {
  id?: unknown;
  name?: unknown;
  entries?: unknown;
}

export interface LogicGridDataInput {
  intro?: unknown;
  categories?: unknown;
  clues?: unknown;
  solution?: unknown;
}

export interface LogicGridCategoryNormalized {
  id: string;
  name: string;
  entries: string[];
}

export interface LogicGridNormalizedData {
  intro: string;
  categories: LogicGridCategoryNormalized[];
  clues: string[];
  // solution[primaryEntry][categoryId] = matching entry. Present in admin/server-side data only
  // — sanitizePublicPuzzleData strips this via stripLogicGridSolution before the puzzle reaches
  // the client.
  solution?: LogicGridSolution;
}

export interface LogicGridValidationOptions {
  requireSolution?: boolean;
}

export interface LogicGridValidationResult {
  valid: boolean;
  error?: string;
  normalized?: LogicGridNormalizedData;
}

const MIN_CATEGORIES = 3;
const MAX_CATEGORIES = 6;
const MIN_ENTRIES = 3;
const MAX_ENTRIES = 6;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCategory(
  raw: unknown,
  index: number
): { category?: LogicGridCategoryNormalized; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { error: `Logic grid category ${index + 1}: invalid category.` };
  }
  const payload = raw as LogicGridCategoryInput;

  const id = normalizeText(payload.id);
  if (!id) {
    return { error: `Logic grid category ${index + 1}: id is required.` };
  }

  const name = normalizeText(payload.name);
  if (!name) {
    return { error: `Logic grid category ${index + 1}: name is required.` };
  }

  if (!Array.isArray(payload.entries)) {
    return { error: `Logic grid category "${name}": entries must be a list.` };
  }

  const entries = payload.entries.map((entry) => normalizeText(entry));
  if (entries.some((entry) => !entry)) {
    return { error: `Logic grid category "${name}": entries cannot be blank.` };
  }
  if (entries.length < MIN_ENTRIES || entries.length > MAX_ENTRIES) {
    return {
      error: `Logic grid category "${name}": must have between ${MIN_ENTRIES} and ${MAX_ENTRIES} entries.`,
    };
  }

  const uniqueEntries = new Set(entries.map((entry) => entry.toLowerCase()));
  if (uniqueEntries.size !== entries.length) {
    return { error: `Logic grid category "${name}": entries must be unique.` };
  }

  return { category: { id, name, entries } };
}

/**
 * Validates and normalizes raw logic grid puzzle data. When `requireSolution` is true (the
 * default — used by the admin editor and the solving API's server-side load), the solution
 * map is validated for completeness and checked to be a true bijection per category. When
 * false (used when validating already-sanitized public data), a missing solution is fine.
 */
export function validateLogicGridPuzzleData(
  data: unknown,
  options: LogicGridValidationOptions = {}
): LogicGridValidationResult {
  const requireSolution = options.requireSolution ?? true;

  if (!data || typeof data !== "object") {
    return { valid: false, error: "Logic grid puzzleData is missing." };
  }

  const payload = data as LogicGridDataInput;

  if (!Array.isArray(payload.categories)) {
    return { valid: false, error: "Logic grid requires puzzleData.categories." };
  }
  if (payload.categories.length < MIN_CATEGORIES || payload.categories.length > MAX_CATEGORIES) {
    return {
      valid: false,
      error: `Logic grid must have between ${MIN_CATEGORIES} and ${MAX_CATEGORIES} categories.`,
    };
  }

  const categories: LogicGridCategoryNormalized[] = [];
  for (let i = 0; i < payload.categories.length; i++) {
    const result = normalizeCategory(payload.categories[i], i);
    if (!result.category) {
      return { valid: false, error: result.error };
    }
    categories.push(result.category);
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  if (categoryIds.size !== categories.length) {
    return { valid: false, error: "Logic grid category ids must be unique." };
  }

  const primary = categories[0];
  for (const category of categories.slice(1)) {
    if (category.entries.length !== primary.entries.length) {
      return {
        valid: false,
        error: `Logic grid category "${category.name}" must have the same number of entries as the primary category ("${primary.name}", ${primary.entries.length}).`,
      };
    }
  }

  if (!Array.isArray(payload.clues)) {
    return { valid: false, error: "Logic grid requires puzzleData.clues." };
  }
  const clues = payload.clues.map((clue) => normalizeText(clue)).filter(Boolean);
  if (clues.length === 0) {
    return { valid: false, error: "Logic grid requires at least one clue." };
  }

  const normalized: LogicGridNormalizedData = {
    intro: normalizeText(payload.intro),
    categories,
    clues,
  };

  if (!requireSolution) {
    return { valid: true, normalized };
  }

  if (!payload.solution || typeof payload.solution !== "object") {
    return { valid: false, error: "Logic grid requires puzzleData.solution." };
  }

  const solutionRaw = payload.solution as Record<string, unknown>;
  const others = categories.slice(1);
  const solution: LogicGridSolution = {};

  for (const primaryEntry of primary.entries) {
    const rowRaw = solutionRaw[primaryEntry];
    if (!rowRaw || typeof rowRaw !== "object") {
      return { valid: false, error: `Logic grid solution is missing a row for "${primaryEntry}".` };
    }
    const row: Record<string, string> = {};
    for (const other of others) {
      const value = normalizeText((rowRaw as Record<string, unknown>)[other.id]);
      if (!other.entries.includes(value)) {
        return {
          valid: false,
          error: `Logic grid solution for "${primaryEntry}" has an invalid value for "${other.name}".`,
        };
      }
      row[other.id] = value;
    }
    solution[primaryEntry] = row;
  }

  // Each non-primary category's assigned values must form a bijection — every entry in that
  // category used exactly once across all primary rows.
  for (const other of others) {
    const assigned = primary.entries.map((entry) => solution[entry][other.id]);
    const uniqueAssigned = new Set(assigned);
    if (uniqueAssigned.size !== other.entries.length) {
      return {
        valid: false,
        error: `Logic grid solution for category "${other.name}" does not assign each entry exactly once.`,
      };
    }
  }

  normalized.solution = solution;
  return { valid: true, normalized };
}

/** Strips the solution key so the puzzle's answer key never reaches the client. */
export function stripLogicGridSolution(data: LogicGridNormalizedData): LogicGridNormalizedData {
  return {
    intro: data.intro,
    categories: data.categories,
    clues: data.clues,
  };
}
