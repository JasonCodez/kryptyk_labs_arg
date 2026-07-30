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
  type LogicGridSolution,
} from "@/lib/logicGridCore";

const SUPPORTED_CATEGORY_COUNT = 4;
const SUPPORTED_ENTRY_COUNT = 4;

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
  const result: LogicGridSolution = {};

  for (const primaryEntry of primary.entries) {
    const rowRaw = solutionRaw[primaryEntry];
    if (!rowRaw || typeof rowRaw !== "object" || Array.isArray(rowRaw)) return null;
    const row: Record<string, string> = {};
    for (const other of others) {
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

/** `${categoryId}::${entry}` -> the primary-category row that entity belongs to. */
function buildEntityIndex(
  categories: LogicGridCategoryNormalized[],
  solution: LogicGridSolution
): Map<string, string> {
  const primary = categories[0];
  const index = new Map<string, string>();
  for (const entry of primary.entries) {
    index.set(`${primary.id}::${entry}`, entry);
  }
  for (const other of categories.slice(1)) {
    for (const primaryEntry of primary.entries) {
      index.set(`${other.id}::${solution[primaryEntry][other.id]}`, primaryEntry);
    }
  }
  return index;
}

function resolveOperand(index: Map<string, string>, operand: unknown): string | null {
  if (!operand || typeof operand !== "object") return null;
  const { categoryId, entry } = operand as { categoryId?: unknown; entry?: unknown };
  if (typeof categoryId !== "string" || typeof entry !== "string") return null;
  return index.get(`${categoryId}::${entry}`) ?? null;
}

function findCategory(
  categories: LogicGridCategoryNormalized[],
  id: string
): LogicGridCategoryNormalized | undefined {
  return categories.find((category) => category.id === id);
}

// ── Per-type clue evaluation ────────────────────────────────────────────────

function evalSameOrNotSame(
  index: Map<string, string>,
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

function evalEitherOr(index: Map<string, string>, clue: LogicGridClueNormalized): boolean | null {
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
  index: Map<string, string>,
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
  if (!Array.isArray(categories) || categories.length === 0) return null;
  const validSolution = validateCandidateSolution(categories, solution);
  if (!validSolution) return null;
  if (!clue || typeof clue !== "object") return null;
  if (!Array.isArray(clue.operands)) return null;

  const index = buildEntityIndex(categories, validSolution);

  switch (clue.type) {
    case "textOnly":
      return null;
    case "same":
      return evalSameOrNotSame(index, clue, true);
    case "notSame":
      return evalSameOrNotSame(index, clue, false);
    case "eitherOr":
      return evalEitherOr(index, clue);
    case "before":
    case "after":
    case "immediatelyBefore":
    case "immediatelyAfter":
      return evalOrdered(categories, validSolution, index, clue);
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
    const candidate: LogicGridSolution = {};
    for (let rowIndex = 0; rowIndex < primary.entries.length; rowIndex++) {
      const row: Record<string, string> = {};
      for (let categoryIndex = 0; categoryIndex < others.length; categoryIndex++) {
        row[others[categoryIndex].id] = combination[categoryIndex][rowIndex];
      }
      candidate[primary.entries[rowIndex]] = row;
    }
    yield candidate;
  }
}

function cloneSolution(solution: LogicGridSolution): LogicGridSolution {
  const copy: LogicGridSolution = {};
  for (const [primaryEntry, row] of Object.entries(solution)) {
    copy[primaryEntry] = { ...row };
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
