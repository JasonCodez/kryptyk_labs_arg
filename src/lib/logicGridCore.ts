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

// Structured clue schema. A clue may still be authored as a plain legacy string (auto-converted
// to `{ type: "textOnly", operands: [] }`), or as one of these 8 structured types so future
// tooling (hints, a solver, clue focusing) can reason about what a clue actually asserts without
// parsing its display text.
export const LOGIC_GRID_CLUE_TYPES = [
  "textOnly",
  "same",
  "notSame",
  "before",
  "after",
  "immediatelyBefore",
  "immediatelyAfter",
  "eitherOr",
] as const;

export type LogicGridClueType = (typeof LOGIC_GRID_CLUE_TYPES)[number];

export interface LogicGridClueOperandInput {
  categoryId?: unknown;
  entry?: unknown;
}

export interface LogicGridClueInput {
  id?: unknown;
  text?: unknown;
  type?: unknown;
  operands?: unknown;
  orderedCategoryId?: unknown;
}

export interface LogicGridClueOperandNormalized {
  categoryId: string;
  entry: string;
}

export interface LogicGridClueNormalized {
  id: string;
  text: string;
  type: LogicGridClueType;
  operands: LogicGridClueOperandNormalized[];
  // Only present for the four ordered-relationship types (before/after/immediatelyBefore/
  // immediatelyAfter) — names the category whose entry order the relationship is measured
  // against (e.g. "time"). Never present on other clue types.
  orderedCategoryId?: string;
}

export interface LogicGridNormalizedData {
  intro: string;
  categories: LogicGridCategoryNormalized[];
  clues: LogicGridClueNormalized[];
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

const CLUE_OPERAND_COUNT: Record<LogicGridClueType, number> = {
  textOnly: 0,
  same: 2,
  notSame: 2,
  before: 2,
  after: 2,
  immediatelyBefore: 2,
  immediatelyAfter: 2,
  eitherOr: 3,
};

const ORDERED_CLUE_TYPES = new Set<LogicGridClueType>([
  "before",
  "after",
  "immediatelyBefore",
  "immediatelyAfter",
]);

function normalizeClueOperand(
  raw: unknown,
  categories: LogicGridCategoryNormalized[],
  clueNumber: number
): { operand?: LogicGridClueOperandNormalized; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { error: `Logic grid clue ${clueNumber}: invalid operand.` };
  }
  const payload = raw as LogicGridClueOperandInput;

  const categoryId = normalizeText(payload.categoryId);
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return { error: `Logic grid clue ${clueNumber}: operand references an unknown category.` };
  }

  const entry = normalizeText(payload.entry);
  if (!category.entries.includes(entry)) {
    return { error: `Logic grid clue ${clueNumber}: operand references an unknown entry.` };
  }

  return { operand: { categoryId, entry } };
}

/**
 * Normalizes a single raw clue (source position `index`, 0-based) into a structured clue. A
 * plain string is a legacy clue and always becomes `{ type: "textOnly", operands: [] }` — blank
 * legacy strings are the caller's responsibility to skip before calling this. Any other clue
 * must be a well-formed structured clue matching one of `LOGIC_GRID_CLUE_TYPES`; a malformed
 * structured clue is an error, never a silent downgrade to textOnly.
 */
function normalizeClue(
  raw: unknown,
  index: number,
  categories: LogicGridCategoryNormalized[]
): { clue?: LogicGridClueNormalized; error?: string } {
  const clueNumber = index + 1;
  const defaultId = `clue-${clueNumber}`;

  if (typeof raw === "string") {
    const text = normalizeText(raw);
    if (!text) {
      return { error: `Logic grid clue ${clueNumber}: text is required.` };
    }
    return { clue: { id: defaultId, text, type: "textOnly", operands: [] } };
  }

  if (!raw || typeof raw !== "object") {
    return { error: `Logic grid clue ${clueNumber}: invalid clue.` };
  }

  const payload = raw as LogicGridClueInput;

  const id = payload.id === undefined || payload.id === null ? defaultId : normalizeText(payload.id);
  if (!id) {
    return { error: `Logic grid clue ${clueNumber}: id cannot be blank.` };
  }

  const text = normalizeText(payload.text);
  if (!text) {
    return { error: `Logic grid clue ${clueNumber}: text is required.` };
  }

  const type = normalizeText(payload.type);
  if (!(LOGIC_GRID_CLUE_TYPES as readonly string[]).includes(type)) {
    return { error: `Logic grid clue ${clueNumber}: unknown clue type.` };
  }
  const clueType = type as LogicGridClueType;

  if (payload.operands !== undefined && !Array.isArray(payload.operands)) {
    return { error: `Logic grid clue ${clueNumber}: operands must be a list.` };
  }
  const operandList = Array.isArray(payload.operands) ? payload.operands : [];

  const expectedCount = CLUE_OPERAND_COUNT[clueType];
  if (operandList.length !== expectedCount) {
    return {
      error: `Logic grid clue ${clueNumber}: ${clueType} clues require exactly ${expectedCount} operand${
        expectedCount === 1 ? "" : "s"
      }.`,
    };
  }

  const operands: LogicGridClueOperandNormalized[] = [];
  for (const rawOperand of operandList) {
    const result = normalizeClueOperand(rawOperand, categories, clueNumber);
    if (!result.operand) {
      return { error: result.error };
    }
    operands.push(result.operand);
  }

  const operandKeys = operands.map((o) => `${o.categoryId}::${o.entry}`);
  if (new Set(operandKeys).size !== operandKeys.length) {
    return { error: `Logic grid clue ${clueNumber}: operands must be unique.` };
  }

  if (clueType === "same" || clueType === "notSame") {
    if (operands[0].categoryId === operands[1].categoryId) {
      return {
        error: `Logic grid clue ${clueNumber}: ${clueType} operands must be from different categories.`,
      };
    }
  }

  let orderedCategoryId: string | undefined;
  if (ORDERED_CLUE_TYPES.has(clueType)) {
    orderedCategoryId = normalizeText(payload.orderedCategoryId);
    const orderedCategory = categories.find((c) => c.id === orderedCategoryId);
    if (!orderedCategory) {
      return { error: `Logic grid clue ${clueNumber}: orderedCategoryId references an unknown category.` };
    }
    if (operands[0].categoryId !== operands[1].categoryId) {
      return { error: `Logic grid clue ${clueNumber}: ${clueType} operands must be from the same category.` };
    }
    if (operands[0].categoryId === orderedCategoryId) {
      return {
        error: `Logic grid clue ${clueNumber}: ${clueType} operands cannot be from the ordered category.`,
      };
    }
    if (operands[0].entry === operands[1].entry) {
      return { error: `Logic grid clue ${clueNumber}: ${clueType} operands must reference different entries.` };
    }
  }

  if (clueType === "eitherOr") {
    const [subject, altA, altB] = operands;
    if (altA.categoryId !== altB.categoryId) {
      return { error: `Logic grid clue ${clueNumber}: eitherOr alternatives must be from the same category.` };
    }
    if (altA.categoryId === subject.categoryId) {
      return {
        error: `Logic grid clue ${clueNumber}: eitherOr alternatives must differ from the subject's category.`,
      };
    }
    if (altA.entry === altB.entry) {
      return { error: `Logic grid clue ${clueNumber}: eitherOr alternatives must reference different entries.` };
    }
  }

  const clue: LogicGridClueNormalized = { id, text, type: clueType, operands };
  if (orderedCategoryId) clue.orderedCategoryId = orderedCategoryId;

  return { clue };
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

  const clues: LogicGridClueNormalized[] = [];
  for (let i = 0; i < payload.clues.length; i++) {
    const raw = payload.clues[i];
    // A blank legacy string clue is silently dropped, matching the prior behavior — it never
    // reached the puzzle either. A malformed *structured* clue (any non-string, non-conforming
    // value), by contrast, is always an error: it must never be silently downgraded.
    if (typeof raw === "string" && !normalizeText(raw)) {
      continue;
    }
    const result = normalizeClue(raw, i, categories);
    if (!result.clue) {
      return { valid: false, error: result.error };
    }
    clues.push(result.clue);
  }

  if (clues.length === 0) {
    return { valid: false, error: "Logic grid requires at least one clue." };
  }

  const clueIds = new Set(clues.map((clue) => clue.id));
  if (clueIds.size !== clues.length) {
    return { valid: false, error: "Logic grid clue ids must be unique." };
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
    clues: data.clues.map((clue) => {
      const normalizedClue: LogicGridClueNormalized = {
        id: clue.id,
        text: clue.text,
        type: clue.type,
        operands: clue.operands.map((operand) => ({
          categoryId: operand.categoryId,
          entry: operand.entry,
        })),
      };
      if (clue.orderedCategoryId) normalizedClue.orderedCategoryId = clue.orderedCategoryId;
      return normalizedClue;
    }),
  };
}
