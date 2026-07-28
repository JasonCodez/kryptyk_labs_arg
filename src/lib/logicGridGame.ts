// Pure client-game helpers for the Logic Grid ("zebra" deduction) puzzle experience.
// No React, no browser APIs, no server-only modules — safe to unit test in isolation and
// safe to reuse from the component without ever touching the hidden solution.

import type { LogicGridCategoryNormalized } from "@/lib/logicGridCore";

export type LogicGridCellMark = "check" | "cross";
export type LogicGridCellMarks = Record<string, LogicGridCellMark>;

export interface LogicGridConfirmedFact {
  categoryId: string;
  categoryName: string;
  value: string;
}

export interface LogicGridCaseRow {
  primaryEntry: string;
  facts: LogicGridConfirmedFact[];
}

export interface LogicGridDerivedState {
  answer: Record<string, Record<string, string>>;
  complete: boolean;
  confirmedFacts: number;
  totalFacts: number;
  progressPercent: number;
  caseRows: LogicGridCaseRow[];
}

export interface LogicGridMoveResult {
  marks: LogicGridCellMarks;
  changedKeys: string[];
  autoEliminatedCount: number;
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findCategory(
  categories: LogicGridCategoryNormalized[],
  id: string
): LogicGridCategoryNormalized | undefined {
  return categories.find((category) => category.id === id);
}

/**
 * Canonical cell key: the category appearing earlier in `categories` is always first.
 * Preserves the existing storage format: `catIdA::entryA::catIdB::entryB`.
 * Returns null (never throws) for any malformed or unknown input.
 */
export function getLogicGridCellKey(
  categories: LogicGridCategoryNormalized[],
  categoryIdA: string,
  entryA: string,
  categoryIdB: string,
  entryB: string
): string | null {
  if (categoryIdA === categoryIdB) return null;

  const catA = findCategory(categories, categoryIdA);
  const catB = findCategory(categories, categoryIdB);
  if (!catA || !catB) return null;

  if (!catA.entries.includes(entryA)) return null;
  if (!catB.entries.includes(entryB)) return null;

  const indexA = categories.indexOf(catA);
  const indexB = categories.indexOf(catB);

  if (indexA < indexB) {
    return `${catA.id}::${entryA}::${catB.id}::${entryB}`;
  }
  return `${catB.id}::${entryB}::${catA.id}::${entryA}`;
}

/** Builds the full set of canonical keys for a puzzle's grid (mirrors the API route). */
function buildValidCellKeys(categories: LogicGridCategoryNormalized[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const a = categories[i];
      const b = categories[j];
      for (const entryA of a.entries) {
        for (const entryB of b.entries) {
          keys.add(`${a.id}::${entryA}::${b.id}::${entryB}`);
        }
      }
    }
  }
  return keys;
}

/**
 * Three-state tap cycle: unknown → cross → check → unknown.
 * Tap: ✕ → ✓ → clear.
 */
export function getNextLogicGridCellMark(
  current: LogicGridCellMark | undefined
): LogicGridCellMark | undefined {
  if (current === undefined) return "cross";
  if (current === "cross") return "check";
  return undefined;
}

/**
 * Normalizes a hydrated (or otherwise externally supplied) cell-marks object down to only
 * real canonical keys with valid mark values for the supplied categories. Never mutates
 * the input and never throws on malformed data.
 */
export function normalizeLogicGridCellMarks(
  value: unknown,
  categories: LogicGridCategoryNormalized[]
): LogicGridCellMarks {
  const result: LogicGridCellMarks = {};
  if (!isNonArrayObject(value)) return result;

  const validKeys = buildValidCellKeys(categories);
  for (const [key, mark] of Object.entries(value)) {
    if (mark !== "check" && mark !== "cross") continue;
    if (!validKeys.has(key)) continue;
    result[key] = mark;
  }
  return result;
}

/**
 * Applies one move (a single cell's next mark) and propagates the note-taking-convenience
 * row/column elimination that comes from setting a check. Never mutates `currentMarks`.
 */
export function applyLogicGridCellMark(
  categories: LogicGridCategoryNormalized[],
  currentMarks: LogicGridCellMarks,
  categoryIdA: string,
  entryA: string,
  categoryIdB: string,
  entryB: string,
  nextMark: LogicGridCellMark | undefined
): LogicGridMoveResult {
  const key = getLogicGridCellKey(categories, categoryIdA, entryA, categoryIdB, entryB);
  if (key === null) {
    return { marks: { ...currentMarks }, changedKeys: [], autoEliminatedCount: 0 };
  }

  const marks: LogicGridCellMarks = { ...currentMarks };
  const changedKeys: string[] = [];
  let autoEliminatedCount = 0;

  if (nextMark === undefined) {
    if (marks[key] !== undefined) {
      delete marks[key];
      changedKeys.push(key);
    }
    return { marks, changedKeys, autoEliminatedCount };
  }

  if (nextMark === "cross") {
    if (marks[key] !== "cross") {
      marks[key] = "cross";
      changedKeys.push(key);
    }
    return { marks, changedKeys, autoEliminatedCount };
  }

  // nextMark === "check"
  if (marks[key] !== "check") {
    marks[key] = "check";
    changedKeys.push(key);
  }

  const catA = findCategory(categories, categoryIdA);
  const catB = findCategory(categories, categoryIdB);
  // catA/catB are guaranteed present here since `key` resolved successfully above.

  if (catB) {
    for (const otherEntryB of catB.entries) {
      if (otherEntryB === entryB) continue;
      const k = getLogicGridCellKey(categories, categoryIdA, entryA, categoryIdB, otherEntryB);
      if (k === null) continue;
      if (marks[k] !== "cross") {
        marks[k] = "cross";
        changedKeys.push(k);
        autoEliminatedCount++;
      }
    }
  }

  if (catA) {
    for (const otherEntryA of catA.entries) {
      if (otherEntryA === entryA) continue;
      const k = getLogicGridCellKey(categories, categoryIdA, otherEntryA, categoryIdB, entryB);
      if (k === null) continue;
      if (marks[k] !== "cross") {
        marks[k] = "cross";
        changedKeys.push(k);
        autoEliminatedCount++;
      }
    }
  }

  return { marks, changedKeys, autoEliminatedCount };
}

/**
 * Derives progress, the server-shaped answer, and the live case-board rows purely from the
 * player's own check marks — never from the hidden solution, and never by evaluating clue text.
 */
export function deriveLogicGridState(
  categories: LogicGridCategoryNormalized[],
  marks: LogicGridCellMarks
): LogicGridDerivedState {
  const primary = categories[0];
  const others = categories.slice(1);

  const answer: Record<string, Record<string, string>> = {};
  const caseRows: LogicGridCaseRow[] = [];
  let confirmedFacts = 0;
  const totalFacts = (primary?.entries.length ?? 0) * others.length;

  for (const primaryEntry of primary?.entries ?? []) {
    const row: Record<string, string> = {};
    const facts: LogicGridConfirmedFact[] = [];

    for (const other of others) {
      const checked = other.entries.filter((entry) => {
        const key = getLogicGridCellKey(categories, primary.id, primaryEntry, other.id, entry);
        return key !== null && marks[key] === "check";
      });

      if (checked.length === 1) {
        row[other.id] = checked[0];
        facts.push({ categoryId: other.id, categoryName: other.name, value: checked[0] });
        confirmedFacts++;
      }
    }

    answer[primaryEntry] = row;
    caseRows.push({ primaryEntry, facts });
  }

  const complete = totalFacts > 0 && confirmedFacts === totalFacts;
  const progressPercent =
    totalFacts > 0 ? Math.max(0, Math.min(100, Math.round((confirmedFacts / totalFacts) * 100))) : 0;

  return { answer, complete, confirmedFacts, totalFacts, progressPercent, caseRows };
}
