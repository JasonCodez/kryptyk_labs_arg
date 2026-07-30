// Authoring/test-only Logic Grid uniqueness analysis.
// Not part of the player-facing solving path.
//
// Pure, offline TypeScript module used to prove — before a Logic Grid puzzle is authored and
// published — that its structured clue set has exactly one solution. It never trusts an
// authored answer key: every candidate solution is generated purely from the puzzle's own
// categories, and checked purely against its own structured clues. Scope is intentionally
// limited to exactly 4 categories x 4 entries (see `analyzeLogicGridUniqueness`); anything else
// is reported as `unsupported` rather than attempting a (potentially expensive) partial search.

import {
  validateLogicGridPuzzleData,
  type LogicGridCategoryNormalized,
  type LogicGridClueNormalized,
  type LogicGridClueOperandNormalized,
  type LogicGridClueType,
  type LogicGridSolution,
} from "@/lib/logicGridCore";

const SUPPORTED_CATEGORY_COUNT = 4;
const SUPPORTED_ENTRY_COUNT = 4;

const MIN_RUNTIME_CATEGORIES = 3;
const MAX_RUNTIME_CATEGORIES = 6;
const MIN_RUNTIME_ENTRIES = 3;
const MAX_RUNTIME_ENTRIES = 6;

const NORMALIZED_CLUE_TYPES = new Set<string>([
  "textOnly",
  "same",
  "notSame",
  "before",
  "after",
  "immediatelyBefore",
  "immediatelyAfter",
  "eitherOr",
]);

const ORDERED_CLUE_TYPES = new Set<LogicGridClueType>([
  "before",
  "after",
  "immediatelyBefore",
  "immediatelyAfter",
]);

/** Creates a record safe to key with arbitrary authored strings (including `__proto__`,
 * `constructor`, `prototype`, etc) — a plain `{}` would route an assignment to `__proto__`
 * through the prototype setter instead of creating a normal own property. */
function createSafeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Entity identity index: categoryId -> entry -> the primary-category row that entity belongs
 * to. A nested Map (rather than a delimiter-joined composite string key) so no category ID or
 * entry value — however it's spelled, including one containing "::" — can ever collide with a
 * different (categoryId, entry) pair. */
type LogicGridEntityIndex = Map<string, Map<string, string>>;

/**
 * Defensively reconstructs `categories` from unknown runtime input, applying the same shape
 * rules `validateLogicGridPuzzleData` enforces (3-6 categories, unique nonblank IDs, nonblank
 * names, 3-6 entries each, entries unique case-insensitively, every category the same length as
 * the primary). Returns an explicit, independent copy — never the original objects — or `null`
 * (never throws) for anything malformed.
 */
function validateRuntimeCategories(categories: unknown): LogicGridCategoryNormalized[] | null {
  if (!Array.isArray(categories)) return null;
  if (categories.length < MIN_RUNTIME_CATEGORIES || categories.length > MAX_RUNTIME_CATEGORIES) return null;

  const result: LogicGridCategoryNormalized[] = [];
  const seenIds = new Set<string>();

  for (const raw of categories) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const { id, name, entries } = raw as { id?: unknown; name?: unknown; entries?: unknown };

    if (!isNonBlankString(id)) return null;
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    if (!isNonBlankString(name)) return null;

    if (!Array.isArray(entries)) return null;
    if (entries.length < MIN_RUNTIME_ENTRIES || entries.length > MAX_RUNTIME_ENTRIES) return null;

    const cleanEntries: string[] = [];
    const seenEntriesLower = new Set<string>();
    for (const entry of entries) {
      if (!isNonBlankString(entry)) return null;
      const lower = entry.toLowerCase();
      if (seenEntriesLower.has(lower)) return null;
      seenEntriesLower.add(lower);
      cleanEntries.push(entry);
    }

    result.push({ id, name, entries: [...cleanEntries] });
  }

  const primaryLength = result[0].entries.length;
  if (result.some((category) => category.entries.length !== primaryLength)) return null;

  return result;
}

/**
 * Defensively reconstructs a single structured clue from unknown runtime input. Requires a
 * nonblank string `id`, a string `text` (never inspected semantically — only its type is
 * validated), one of the 8 normalized clue types, and an array of operands each with nonblank
 * string `categoryId`/`entry`. `orderedCategoryId` is preserved only when it's a nonblank
 * string; any other non-`undefined` value invalidates the whole clue. Unknown extra fields are
 * ignored. Returns an explicit, independent copy — never the original object — or `null` (never
 * throws) for anything malformed.
 */
function validateRuntimeClue(clue: unknown): LogicGridClueNormalized | null {
  if (!clue || typeof clue !== "object" || Array.isArray(clue)) return null;
  const { id, text, type, operands, orderedCategoryId } = clue as {
    id?: unknown;
    text?: unknown;
    type?: unknown;
    operands?: unknown;
    orderedCategoryId?: unknown;
  };

  if (!isNonBlankString(id)) return null;
  if (typeof text !== "string") return null;
  if (typeof type !== "string" || !NORMALIZED_CLUE_TYPES.has(type)) return null;
  if (!Array.isArray(operands)) return null;

  const validOperands: LogicGridClueOperandNormalized[] = [];
  for (const rawOperand of operands) {
    if (!rawOperand || typeof rawOperand !== "object" || Array.isArray(rawOperand)) return null;
    const { categoryId, entry } = rawOperand as { categoryId?: unknown; entry?: unknown };
    if (!isNonBlankString(categoryId)) return null;
    if (!isNonBlankString(entry)) return null;
    validOperands.push({ categoryId, entry });
  }

  const normalizedType = type as LogicGridClueType;
  const result: LogicGridClueNormalized = {
    id,
    text,
    type: normalizedType,
    operands: validOperands,
  };

  if (ORDERED_CLUE_TYPES.has(normalizedType)) {
    // Ordered types require a nonblank orderedCategoryId — missing, null, non-string, and blank
    // all invalidate the clue.
    if (typeof orderedCategoryId !== "string" || orderedCategoryId.trim().length === 0) return null;
    result.orderedCategoryId = orderedCategoryId;
  } else if (orderedCategoryId !== undefined) {
    // Non-ordered types (textOnly/same/notSame/eitherOr) must never carry ordered metadata — a
    // blank string is normalized away as absent, but any nonblank or non-string value present
    // invalidates the clue rather than being silently ignored by later evaluators.
    if (typeof orderedCategoryId !== "string") return null;
    if (orderedCategoryId.trim().length > 0) return null;
  }

  return result;
}

export type LogicGridUniquenessStatus = "invalid" | "unsupported" | "contradictory" | "unique" | "ambiguous";

export interface LogicGridUniquenessResult {
  status: LogicGridUniquenessStatus;
  solutionsFound: 0 | 1 | 2;
  searchExhausted: boolean;
  firstSolution?: LogicGridSolution;
  secondSolution?: LogicGridSolution;
  unsupportedClueIds?: string[];
  error?: string;
}

// ── Candidate-solution validation ──────────────────────────────────────────

/**
 * Confirms `solution` is a complete, bijective candidate for `categories` (same shape and same
 * bijection rules `validateLogicGridPuzzleData` enforces for an authored solution) and returns
 * an explicitly reconstructed copy — or `null` (never throws) for anything malformed: a missing
 * primary row, a non-object row, a missing/unknown category assignment, or a category whose
 * entries aren't each assigned exactly once. Unknown extra row fields are ignored. The primary
 * category's own value never needs to be repeated inside each row.
 */
function validateCandidateSolution(
  categories: LogicGridCategoryNormalized[],
  solution: unknown
): LogicGridSolution | null {
  if (!Array.isArray(categories) || categories.length === 0) return null;
  if (!solution || typeof solution !== "object" || Array.isArray(solution)) return null;

  const primary = categories[0];
  const others = categories.slice(1);
  const solutionRaw = solution as Record<string, unknown>;
  const result: LogicGridSolution = createSafeRecord();

  for (const primaryEntry of primary.entries) {
    // Authored primary entries / category IDs (e.g. "__proto__", "constructor") must never be
    // read through the prototype chain — only a real own property counts as an authored value.
    if (!Object.prototype.hasOwnProperty.call(solutionRaw, primaryEntry)) return null;
    const rowRaw = solutionRaw[primaryEntry];
    if (!rowRaw || typeof rowRaw !== "object" || Array.isArray(rowRaw)) return null;
    const row: Record<string, string> = createSafeRecord();
    for (const other of others) {
      if (!Object.prototype.hasOwnProperty.call(rowRaw, other.id)) return null;
      const value = (rowRaw as Record<string, unknown>)[other.id];
      if (typeof value !== "string" || !other.entries.includes(value)) return null;
      row[other.id] = value;
    }
    result[primaryEntry] = row;
  }

  for (const other of others) {
    const assigned = primary.entries.map((entry) => result[entry][other.id]);
    if (new Set(assigned).size !== other.entries.length) return null;
  }

  return result;
}

/**
 * Builds the collision-safe entity index (categoryId -> entry -> primary row) for a validated
 * category list and a validated, bijective candidate solution. Returns `null` (defense-in-depth,
 * never throws) if a category ID repeats, an entry within a category repeats, or an entity would
 * otherwise resolve to more than one primary row — none of which should be possible once
 * `categories` and `solution` have already passed their own validation, but this function never
 * assumes that.
 */
function buildEntityIndex(
  categories: LogicGridCategoryNormalized[],
  solution: LogicGridSolution
): LogicGridEntityIndex | null {
  const primary = categories[0];
  const index: LogicGridEntityIndex = new Map();

  const primaryMap = new Map<string, string>();
  for (const entry of primary.entries) {
    if (primaryMap.has(entry)) return null;
    primaryMap.set(entry, entry);
  }
  if (index.has(primary.id)) return null;
  index.set(primary.id, primaryMap);

  for (const other of categories.slice(1)) {
    if (index.has(other.id)) return null;
    const categoryMap = new Map<string, string>();
    for (const primaryEntry of primary.entries) {
      const value = solution[primaryEntry]?.[other.id];
      if (typeof value !== "string") return null;
      if (categoryMap.has(value)) return null;
      categoryMap.set(value, primaryEntry);
    }
    index.set(other.id, categoryMap);
  }

  return index;
}

function resolveOperand(index: LogicGridEntityIndex, operand: unknown): string | null {
  if (!operand || typeof operand !== "object" || Array.isArray(operand)) return null;
  const { categoryId, entry } = operand as { categoryId?: unknown; entry?: unknown };
  if (typeof categoryId !== "string" || typeof entry !== "string") return null;
  return index.get(categoryId)?.get(entry) ?? null;
}

function findCategory(
  categories: LogicGridCategoryNormalized[],
  id: string
): LogicGridCategoryNormalized | undefined {
  return categories.find((category) => category.id === id);
}

// ── Per-type clue evaluation ────────────────────────────────────────────────

function evalSameOrNotSame(
  index: LogicGridEntityIndex,
  clue: LogicGridClueNormalized,
  wantSame: boolean
): boolean | null {
  if (clue.operands.length !== 2) return null;
  const [opA, opB] = clue.operands;
  if (!opA || !opB) return null;
  if (opA.categoryId === opB.categoryId) return null;

  const rowA = resolveOperand(index, opA);
  const rowB = resolveOperand(index, opB);
  if (rowA === null || rowB === null) return null;

  return wantSame ? rowA === rowB : rowA !== rowB;
}

function evalEitherOr(index: LogicGridEntityIndex, clue: LogicGridClueNormalized): boolean | null {
  if (clue.operands.length !== 3) return null;
  const [subject, altA, altB] = clue.operands;
  if (!subject || !altA || !altB) return null;
  if (altA.categoryId !== altB.categoryId) return null;
  if (subject.categoryId === altA.categoryId) return null;
  if (altA.entry === altB.entry) return null;

  const subjectRow = resolveOperand(index, subject);
  const altARow = resolveOperand(index, altA);
  const altBRow = resolveOperand(index, altB);
  if (subjectRow === null || altARow === null || altBRow === null) return null;

  return subjectRow === altARow || subjectRow === altBRow;
}

/** The ordered-category value for `primaryRow` — the row name itself when the ordered category
 * IS the primary category, otherwise the row's assigned entry in that category. Returns its
 * index within the ordered category's authored entry order, or null if anything can't resolve. */
function resolveOrderedIndex(
  categories: LogicGridCategoryNormalized[],
  solution: LogicGridSolution,
  orderedCategoryId: string,
  primaryRow: string
): number | null {
  const orderedCategory = findCategory(categories, orderedCategoryId);
  if (!orderedCategory) return null;

  const primary = categories[0];
  let value: string;
  if (orderedCategoryId === primary.id) {
    value = primaryRow;
  } else {
    const raw = solution[primaryRow]?.[orderedCategoryId];
    if (typeof raw !== "string") return null;
    value = raw;
  }

  const index = orderedCategory.entries.indexOf(value);
  return index === -1 ? null : index;
}

function evalOrdered(
  categories: LogicGridCategoryNormalized[],
  solution: LogicGridSolution,
  index: LogicGridEntityIndex,
  clue: LogicGridClueNormalized
): boolean | null {
  if (clue.operands.length !== 2) return null;
  const [opA, opB] = clue.operands;
  if (!opA || !opB) return null;

  const orderedCategoryId = clue.orderedCategoryId;
  if (typeof orderedCategoryId !== "string" || orderedCategoryId.trim().length === 0) return null;
  if (!findCategory(categories, orderedCategoryId)) return null;
  if (opA.categoryId === orderedCategoryId || opB.categoryId === orderedCategoryId) return null;
  // Exact duplicate operand (same category AND same entry) is always invalid — same-category
  // operands with *different* entries remain a valid comparison.
  if (opA.categoryId === opB.categoryId && opA.entry === opB.entry) return null;

  const rowA = resolveOperand(index, opA);
  const rowB = resolveOperand(index, opB);
  if (rowA === null || rowB === null) return null;

  const idxA = resolveOrderedIndex(categories, solution, orderedCategoryId, rowA);
  const idxB = resolveOrderedIndex(categories, solution, orderedCategoryId, rowB);
  if (idxA === null || idxB === null) return null;

  switch (clue.type) {
    case "before":
      return idxA < idxB;
    case "after":
      return idxA > idxB;
    case "immediatelyBefore":
      return idxA + 1 === idxB;
    case "immediatelyAfter":
      return idxA === idxB + 1;
    default:
      return null;
  }
}

/**
 * Evaluates one normalized structured clue against one candidate solution — purely from the
 * clue's own metadata and the solution's own bijective assignments, never from `clue.text`.
 * Returns `true`/`false` when the candidate is well-formed and the clue type is supported, or
 * `null` (never throws) for `textOnly`, malformed categories/solution/clue, or a relationship
 * that can't be safely resolved (unknown category, unknown entry, inconsistent ordered
 * category, etc).
 */
export function evaluateLogicGridClueAgainstSolution(
  categories: LogicGridCategoryNormalized[],
  solution: LogicGridSolution,
  clue: LogicGridClueNormalized
): boolean | null {
  const validCategories = validateRuntimeCategories(categories);
  if (!validCategories) return null;
  const validSolution = validateCandidateSolution(validCategories, solution);
  if (!validSolution) return null;
  const validClue = validateRuntimeClue(clue);
  if (!validClue) return null;

  const index = buildEntityIndex(validCategories, validSolution);
  if (!index) return null;

  switch (validClue.type) {
    case "textOnly":
      return null;
    case "same":
      return evalSameOrNotSame(index, validClue, true);
    case "notSame":
      return evalSameOrNotSame(index, validClue, false);
    case "eitherOr":
      return evalEitherOr(index, validClue);
    case "before":
    case "after":
    case "immediatelyBefore":
    case "immediatelyAfter":
      return evalOrdered(validCategories, validSolution, index, validClue);
    default:
      return null;
  }
}

// ── Deterministic candidate generation ──────────────────────────────────────

/** All permutations of `values`, in deterministic order derived from the source order. */
function* permute<T>(values: T[]): Generator<T[]> {
  if (values.length <= 1) {
    yield values.slice();
    return;
  }
  for (let i = 0; i < values.length; i++) {
    const rest = [...values.slice(0, i), ...values.slice(i + 1)];
    for (const restPermutation of permute(rest)) {
      yield [values[i], ...restPermutation];
    }
  }
}

function* cartesianProduct<T>(sequences: T[][]): Generator<T[]> {
  if (sequences.length === 0) {
    yield [];
    return;
  }
  const [first, ...rest] = sequences;
  for (const item of first) {
    for (const restCombo of cartesianProduct(rest)) {
      yield [item, ...restCombo];
    }
  }
}

/**
 * Every complete bijective candidate solution for `categories` (4 categories x 4 entries only —
 * callers are expected to have already checked the shape). The primary category's entry order
 * is fixed; every other category is assigned one full permutation of its own entries across the
 * primary rows. Order is fully deterministic and never uses `Math.random()`.
 */
function* generateCandidateSolutions(
  categories: LogicGridCategoryNormalized[]
): Generator<LogicGridSolution> {
  const primary = categories[0];
  const others = categories.slice(1);
  const permutationsPerCategory = others.map((category) => [...permute(category.entries)]);

  for (const combination of cartesianProduct(permutationsPerCategory)) {
    const candidate: LogicGridSolution = createSafeRecord();
    for (let rowIndex = 0; rowIndex < primary.entries.length; rowIndex++) {
      const row: Record<string, string> = createSafeRecord();
      for (let categoryIndex = 0; categoryIndex < others.length; categoryIndex++) {
        row[others[categoryIndex].id] = combination[categoryIndex][rowIndex];
      }
      candidate[primary.entries[rowIndex]] = row;
    }
    yield candidate;
  }
}

function cloneSolution(solution: LogicGridSolution): LogicGridSolution {
  const copy: LogicGridSolution = createSafeRecord();
  for (const [primaryEntry, row] of Object.entries(solution)) {
    const rowCopy: Record<string, string> = createSafeRecord();
    for (const [categoryId, value] of Object.entries(row)) {
      rowCopy[categoryId] = value;
    }
    copy[primaryEntry] = rowCopy;
  }
  return copy;
}

/** `true` if every clue is satisfied, `false` if any clue is violated, `null` if any clue
 * couldn't be evaluated at all (distinct from merely being violated). */
function evaluateCandidateAgainstClues(
  categories: LogicGridCategoryNormalized[],
  candidate: LogicGridSolution,
  clues: LogicGridClueNormalized[]
): boolean | null {
  for (const clue of clues) {
    const result = evaluateLogicGridClueAgainstSolution(categories, candidate, clue);
    if (result === null) return null;
    if (result === false) return false;
  }
  return true;
}

// ── Main authoring validator ────────────────────────────────────────────────

/**
 * Proves (or disproves) that a Logic Grid puzzle's structured clue set has exactly one solution
 * — entirely offline, entirely from `categories` + structured `clues`. Any authored `solution`
 * in `data` is completely ignored; two puzzle objects that differ only in their `solution` field
 * (including an intentionally wrong one) always produce the same result. Supports exactly 4
 * categories x 4 entries; any other shape, or any `textOnly` clue, is reported `unsupported`
 * without attempting a search.
 */
export function analyzeLogicGridUniqueness(data: unknown): LogicGridUniquenessResult {
  const validation = validateLogicGridPuzzleData(data, { requireSolution: false });
  if (!validation.valid || !validation.normalized) {
    return {
      status: "invalid",
      solutionsFound: 0,
      searchExhausted: false,
      error: validation.error ?? "Logic grid puzzleData is invalid.",
    };
  }

  const { categories, clues } = validation.normalized;

  if (
    categories.length !== SUPPORTED_CATEGORY_COUNT ||
    categories.some((category) => category.entries.length !== SUPPORTED_ENTRY_COUNT)
  ) {
    return {
      status: "unsupported",
      solutionsFound: 0,
      searchExhausted: false,
      error: `Logic grid uniqueness analysis currently supports exactly ${SUPPORTED_CATEGORY_COUNT} categories with ${SUPPORTED_ENTRY_COUNT} entries each.`,
    };
  }

  // Ignoring textOnly clues (rather than dropping them from the search) could produce a false
  // "unique"/"ambiguous" verdict for a puzzle whose real disambiguation depends on a clue this
  // analyzer can't read — so any textOnly clue makes the whole puzzle unsupported.
  const unsupportedClueIds = clues.filter((clue) => clue.type === "textOnly").map((clue) => clue.id);
  if (unsupportedClueIds.length > 0) {
    return {
      status: "unsupported",
      solutionsFound: 0,
      searchExhausted: false,
      unsupportedClueIds,
      error: "Logic grid uniqueness analysis requires every clue to use structured metadata.",
    };
  }

  const solutions: LogicGridSolution[] = [];

  for (const candidate of generateCandidateSolutions(categories)) {
    const verdict = evaluateCandidateAgainstClues(categories, candidate, clues);
    if (verdict === null) {
      return {
        status: "invalid",
        solutionsFound: 0,
        searchExhausted: false,
        error: "A normalized Logic Grid clue could not be evaluated.",
      };
    }
    if (verdict) {
      solutions.push(cloneSolution(candidate));
      if (solutions.length >= 2) break;
    }
  }

  if (solutions.length === 0) {
    return { status: "contradictory", solutionsFound: 0, searchExhausted: true };
  }
  if (solutions.length === 1) {
    return { status: "unique", solutionsFound: 1, searchExhausted: true, firstSolution: solutions[0] };
  }
  return {
    status: "ambiguous",
    solutionsFound: 2,
    searchExhausted: false,
    firstSolution: solutions[0],
    secondSolution: solutions[1],
  };
}
