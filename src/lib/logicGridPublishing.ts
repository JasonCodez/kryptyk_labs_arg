// Server-side authoring and publication validation for Logic Grid puzzles.
// This module validates data but performs no database or network operations.
//
// Bridges the offline authoring tools (structured-clue validation, uniqueness analysis) to the
// admin publishing path: a Logic Grid puzzle may only be created or activated once its stored
// data has been proven — from its own structured clues alone, never by trusting the authored
// answer key — to have exactly one solution, and that solution must match what the author wrote
// down. This module never talks to Prisma or the network; it is pure validation logic reused by
// both the admin API routes and the standalone publishing script.

import {
  validateLogicGridPuzzleData,
  type LogicGridCategoryNormalized,
  type LogicGridNormalizedData,
  type LogicGridSolution,
} from "@/lib/logicGridCore";
import { analyzeLogicGridUniqueness, type LogicGridUniquenessStatus } from "@/lib/logicGridSolver";

/**
 * Placeholder answer for the generic `attempt_success` -> awardSolveRewards() reward path.
 * Logic Grid puzzles are solved through the dedicated `/api/puzzles/[id]/logic-grid` route, not
 * a text-answer submission — this row exists only so the existing reward code has somewhere to
 * read a configured point value from. It must never be sent to the player as an answer.
 */
export const LOGIC_GRID_PLACEHOLDER_ANSWER = "__LOGIC_GRID__";

export type LogicGridPublicationValidationResult =
  | {
      valid: true;
      normalized: LogicGridNormalizedData & { solution: LogicGridSolution };
      witness: LogicGridSolution;
    }
  | {
      valid: false;
      error: string;
      uniquenessStatus?: LogicGridUniquenessStatus;
    };

/**
 * Structural equality for two `LogicGridSolution` values against a known category list: every
 * primary entry must be an own property on both sides, every non-primary category assignment
 * must be an own property with an identical string value, and unrelated/inherited properties
 * never count. Deliberately not a `JSON.stringify` comparison — key order or extra fields could
 * otherwise make two meaningfully different solutions look equal (or vice versa).
 */
function solutionsMatch(
  categories: LogicGridCategoryNormalized[],
  a: LogicGridSolution,
  b: LogicGridSolution
): boolean {
  const primary = categories[0];
  const others = categories.slice(1);

  for (const primaryEntry of primary.entries) {
    if (!Object.prototype.hasOwnProperty.call(a, primaryEntry)) return false;
    if (!Object.prototype.hasOwnProperty.call(b, primaryEntry)) return false;
    const rowA = a[primaryEntry];
    const rowB = b[primaryEntry];
    if (!rowA || typeof rowA !== "object" || !rowB || typeof rowB !== "object") return false;

    for (const other of others) {
      const hasA = Object.prototype.hasOwnProperty.call(rowA, other.id);
      const hasB = Object.prototype.hasOwnProperty.call(rowB, other.id);
      if (!hasA || !hasB) return false;
      if (rowA[other.id] !== rowB[other.id]) return false;
    }
  }

  return true;
}

/**
 * Proves a Logic Grid puzzle is safe to publish: core-valid, carrying a stored authored
 * solution, proven to have exactly one solution derivable purely from its own structured
 * clues, and with that unique clue-derived witness matching the authored solution exactly.
 * Never trusts the authored solution as proof of uniqueness — `analyzeLogicGridUniqueness`
 * (which itself ignores any supplied `solution`) is the sole source of truth for uniqueness.
 * Never throws, never mutates `data`, never parses clue text.
 */
export function validateLogicGridForPublication(data: unknown): LogicGridPublicationValidationResult {
  const coreResult = validateLogicGridPuzzleData(data, { requireSolution: true });
  if (!coreResult.valid || !coreResult.normalized || !coreResult.normalized.solution) {
    return {
      valid: false,
      error: `Logic Grid publication validation failed: ${coreResult.error ?? "puzzleData is invalid."}`,
    };
  }

  const normalized = coreResult.normalized as LogicGridNormalizedData & { solution: LogicGridSolution };

  const uniqueness = analyzeLogicGridUniqueness(data);

  if (uniqueness.status === "invalid") {
    return {
      valid: false,
      error: `Logic Grid publication validation failed: ${uniqueness.error ?? "uniqueness analysis failed."}`,
      uniquenessStatus: uniqueness.status,
    };
  }

  if (uniqueness.status === "unsupported") {
    return {
      valid: false,
      error: "Logic Grid publication requires exactly one solution derived entirely from structured clues.",
      uniquenessStatus: uniqueness.status,
    };
  }

  if (uniqueness.status === "contradictory") {
    return {
      valid: false,
      error: "Logic Grid clue set is contradictory and cannot be published.",
      uniquenessStatus: uniqueness.status,
    };
  }

  if (uniqueness.status === "ambiguous") {
    return {
      valid: false,
      error: "Logic Grid clue set is ambiguous and cannot be published.",
      uniquenessStatus: uniqueness.status,
    };
  }

  // status === "unique"
  if (!uniqueness.firstSolution) {
    return {
      valid: false,
      error: "Logic Grid uniqueness analysis did not return its required witness.",
      uniquenessStatus: uniqueness.status,
    };
  }

  if (!solutionsMatch(normalized.categories, normalized.solution, uniqueness.firstSolution)) {
    return {
      valid: false,
      error: "Authored Logic Grid solution does not match the unique clue-derived solution.",
      uniquenessStatus: uniqueness.status,
    };
  }

  return {
    valid: true,
    normalized,
    witness: uniqueness.firstSolution,
  };
}
