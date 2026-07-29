// Pure clue-guidance helpers for the Logic Grid ("zebra") puzzle experience. Translates a
// structured clue's own metadata (never the hidden solution, never parsed clue text) into
// grid-notation focus targets and plain-language teaching copy. No React, no browser APIs,
// no server-only modules — safe to unit test in isolation and safe to reuse from the
// component without ever touching the hidden solution.

import type { LogicGridCategoryNormalized, LogicGridClueNormalized } from "@/lib/logicGridCore";
import { getLogicGridCellKey } from "@/lib/logicGridGame";

export interface LogicGridClueFocus {
  pairKeys: string[];
  primaryCellKeys: string[];
  contextCellKeys: string[];
}

export interface LogicGridTeachingGuide {
  clueId: string;
  heading: string;
  summary: string;
  steps: string[];
  focus: LogicGridClueFocus;
}

function findCategory(
  categories: LogicGridCategoryNormalized[],
  id: string
): LogicGridCategoryNormalized | undefined {
  return categories.find((category) => category.id === id);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Canonical, order-independent key for a pair of categories: `earlierId::laterId`, where
 * "earlier" means earlier in `categories`. Returns null (never throws) for missing categories
 * or a category paired with itself.
 */
export function getLogicGridCategoryPairKey(
  categories: LogicGridCategoryNormalized[],
  categoryIdA: string,
  categoryIdB: string
): string | null {
  if (categoryIdA === categoryIdB) return null;

  const catA = findCategory(categories, categoryIdA);
  const catB = findCategory(categories, categoryIdB);
  if (!catA || !catB) return null;

  const indexA = categories.indexOf(catA);
  const indexB = categories.indexOf(catB);

  return indexA < indexB ? `${catA.id}::${catB.id}` : `${catB.id}::${catA.id}`;
}

/** Every canonical cell key pairing a fixed (categoryId, entry) with each entry of another category. */
function allCellKeysAcross(
  categories: LogicGridCategoryNormalized[],
  fixedCategoryId: string,
  fixedEntry: string,
  otherCategoryId: string
): string[] {
  const other = findCategory(categories, otherCategoryId);
  if (!other) return [];
  const keys: string[] = [];
  for (const entry of other.entries) {
    const key = getLogicGridCellKey(categories, fixedCategoryId, fixedEntry, otherCategoryId, entry);
    if (key) keys.push(key);
  }
  return keys;
}

function entrySequenceText(category: LogicGridCategoryNormalized): string {
  return category.entries.join(" → ");
}

function buildSameOrNotSameGuide(
  categories: LogicGridCategoryNormalized[],
  clue: LogicGridClueNormalized
): LogicGridTeachingGuide | null {
  const [opA, opB] = clue.operands;
  if (!opA || !opB) return null;

  const catA = findCategory(categories, opA.categoryId);
  const catB = findCategory(categories, opB.categoryId);
  if (!catA || !catB) return null;
  if (!catA.entries.includes(opA.entry) || !catB.entries.includes(opB.entry)) return null;

  const pairKey = getLogicGridCategoryPairKey(categories, opA.categoryId, opB.categoryId);
  const primaryCellKey = getLogicGridCellKey(
    categories,
    opA.categoryId,
    opA.entry,
    opB.categoryId,
    opB.entry
  );
  if (!pairKey || !primaryCellKey) return null;

  const focus: LogicGridClueFocus = {
    pairKeys: [pairKey],
    primaryCellKeys: [primaryCellKey],
    contextCellKeys: [],
  };

  if (clue.type === "same") {
    return {
      clueId: clue.id,
      heading: "Connect these entries",
      summary: `${opA.entry} belongs with ${opB.entry}.`,
      steps: [
        "Find the highlighted intersection.",
        "Mark it ✓ to confirm the relationship.",
        "Use the automatic row and column eliminations to continue.",
      ],
      focus,
    };
  }

  return {
    clueId: clue.id,
    heading: "Rule out this pairing",
    summary: `${opA.entry} cannot be paired with ${opB.entry}.`,
    steps: [
      "Find the highlighted intersection.",
      "Mark it ✕ to eliminate the relationship.",
      "Keep the remaining options open until other clues narrow them.",
    ],
    focus,
  };
}

function buildEitherOrGuide(
  categories: LogicGridCategoryNormalized[],
  clue: LogicGridClueNormalized
): LogicGridTeachingGuide | null {
  const [subject, altA, altB] = clue.operands;
  if (!subject || !altA || !altB) return null;

  const subjectCategory = findCategory(categories, subject.categoryId);
  const altCategory = findCategory(categories, altA.categoryId);
  if (!subjectCategory || !altCategory) return null;
  if (altA.categoryId !== altB.categoryId) return null;
  if (!subjectCategory.entries.includes(subject.entry)) return null;
  if (!altCategory.entries.includes(altA.entry) || !altCategory.entries.includes(altB.entry)) return null;

  const pairKey = getLogicGridCategoryPairKey(categories, subject.categoryId, altCategory.id);
  const primaryKeyA = getLogicGridCellKey(categories, subject.categoryId, subject.entry, altCategory.id, altA.entry);
  const primaryKeyB = getLogicGridCellKey(categories, subject.categoryId, subject.entry, altCategory.id, altB.entry);
  if (!pairKey || !primaryKeyA || !primaryKeyB) return null;

  const primaryCellKeys = dedupe([primaryKeyA, primaryKeyB]);
  const allAcross = allCellKeysAcross(categories, subject.categoryId, subject.entry, altCategory.id);
  const contextCellKeys = dedupe(allAcross.filter((key) => !primaryCellKeys.includes(key)));

  return {
    clueId: clue.id,
    heading: "Keep two possibilities open",
    summary: `${subject.entry} must be paired with either ${altA.entry} or ${altB.entry}.`,
    steps: [
      "The two strongly highlighted cells are the allowed choices.",
      `Mark every other ${altCategory.name} option for ${subject.entry} as ✕.`,
      "Do not mark either highlighted choice ✓ until another clue rules out the other.",
    ],
    focus: {
      pairKeys: [pairKey],
      primaryCellKeys,
      contextCellKeys,
    },
  };
}

const ORDERED_HEADINGS: Record<string, string> = {
  before: "Compare earlier positions",
  after: "Compare later positions",
  immediatelyBefore: "Compare adjacent positions",
  immediatelyAfter: "Compare adjacent positions",
};

function orderedRelationPhrase(type: LogicGridClueNormalized["type"]): string {
  if (type === "before") return "must come before";
  if (type === "after") return "must come after";
  if (type === "immediatelyBefore") return "must come immediately before";
  return "must come immediately after";
}

function orderedFinalStep(type: LogicGridClueNormalized["type"]): string {
  if (type === "before") {
    return "The first operand must use an earlier position, but the positions do not need to be adjacent.";
  }
  if (type === "after") {
    return "The first operand must use a later position, but the positions do not need to be adjacent.";
  }
  if (type === "immediatelyBefore") {
    return "Their positions must be adjacent, with the first operand exactly one position earlier.";
  }
  return "Their positions must be adjacent, with the first operand exactly one position later.";
}

function buildOrderedGuide(
  categories: LogicGridCategoryNormalized[],
  clue: LogicGridClueNormalized
): LogicGridTeachingGuide | null {
  const [opA, opB] = clue.operands;
  if (!opA || !opB) return null;
  if (!clue.orderedCategoryId) return null;

  const catA = findCategory(categories, opA.categoryId);
  const catB = findCategory(categories, opB.categoryId);
  const orderedCategory = findCategory(categories, clue.orderedCategoryId);
  if (!catA || !catB || !orderedCategory) return null;
  if (!catA.entries.includes(opA.entry) || !catB.entries.includes(opB.entry)) return null;
  if (opA.categoryId === clue.orderedCategoryId || opB.categoryId === clue.orderedCategoryId) return null;

  const pairKeyA = getLogicGridCategoryPairKey(categories, opA.categoryId, clue.orderedCategoryId);
  const pairKeyB = getLogicGridCategoryPairKey(categories, opB.categoryId, clue.orderedCategoryId);
  if (!pairKeyA || !pairKeyB) return null;
  const pairKeys = dedupe([pairKeyA, pairKeyB]);

  const cellsA = allCellKeysAcross(categories, opA.categoryId, opA.entry, clue.orderedCategoryId);
  const cellsB = allCellKeysAcross(categories, opB.categoryId, opB.entry, clue.orderedCategoryId);
  if (cellsA.length === 0 || cellsB.length === 0) return null;
  const primaryCellKeys = dedupe([...cellsA, ...cellsB]);

  const heading = ORDERED_HEADINGS[clue.type] ?? "Compare positions";
  const relation = orderedRelationPhrase(clue.type);

  return {
    clueId: clue.id,
    heading,
    summary: `${opA.entry} ${relation} ${opB.entry} in ${orderedCategory.name}.`,
    steps: [
      `Read ${orderedCategory.name} in this order: ${entrySequenceText(orderedCategory)}.`,
      `Compare the highlighted possibilities for ${opA.entry} and ${opB.entry}.`,
      orderedFinalStep(clue.type),
    ],
    focus: {
      pairKeys,
      primaryCellKeys,
      contextCellKeys: [],
    },
  };
}

/**
 * Derives a teaching guide for a single structured clue, purely from its own normalized
 * metadata (type, operands, orderedCategoryId) plus the puzzle's categories — never from the
 * hidden solution, never from parsing `clue.text`. Returns null for `textOnly` clues and for
 * any clue whose metadata doesn't cleanly resolve against `categories` (which should not
 * happen for a clue that already passed `validateLogicGridPuzzleData`, but this function never
 * throws regardless).
 */
export function deriveLogicGridTeachingGuide(
  categories: LogicGridCategoryNormalized[],
  clue: LogicGridClueNormalized
): LogicGridTeachingGuide | null {
  if (!clue || typeof clue !== "object") return null;
  if (!Array.isArray(clue.operands)) return null;

  switch (clue.type) {
    case "same":
    case "notSame":
      return buildSameOrNotSameGuide(categories, clue);
    case "eitherOr":
      return buildEitherOrGuide(categories, clue);
    case "before":
    case "after":
    case "immediatelyBefore":
    case "immediatelyAfter":
      return buildOrderedGuide(categories, clue);
    default:
      return null;
  }
}
