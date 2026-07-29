import {
  stripCrosswordAnswers,
  type CrosswordPuzzleDataInput,
  validateCrosswordPuzzleData,
} from "@/lib/crosswordCore";
import { stripLogicGridSolution, validateLogicGridPuzzleData } from "@/lib/logicGridCore";
import { getGridlockFileData, sanitizeGridlockForClient } from "@/lib/gridlockFile";

function sanitizeHiddenWordData(rawData: Record<string, unknown>): Record<string, unknown> {
  const safeData = { ...rawData };
  const secretWord = String(safeData.word ?? "").trim();
  const inferredLength = secretWord.length || Number(safeData.wordLength ?? 5);

  delete safeData.word;
  safeData.wordLength =
    Number.isFinite(inferredLength) && inferredLength > 0
      ? Math.floor(inferredLength)
      : 5;

  return safeData;
}

function sanitizeCrosswordData(rawData: Record<string, unknown>): Record<string, unknown> {
  const crossword = validateCrosswordPuzzleData(rawData, {
    requireAnswers: true,
    enforceStyle: false,
  });

  if (!crossword.valid || !crossword.normalized) {
    const stripped = stripCrosswordAnswers(rawData as CrosswordPuzzleDataInput);
    return {
      ...rawData,
      ...stripped,
    };
  }

  const stripped = stripCrosswordAnswers(crossword.normalized);
  return {
    ...rawData,
    ...stripped,
    rows: crossword.normalized.rows,
    cols: crossword.normalized.cols,
    blackSquareRatio: Number(crossword.normalized.blackSquareRatio.toFixed(4)),
  };
}

function sanitizeLogicGridData(rawData: Record<string, unknown>): Record<string, unknown> {
  // Defensively strip the raw `solution` key regardless of whether the data validates —
  // an admin-authored puzzle with otherwise-malformed data should still never leak its answer.
  const safeData = { ...rawData };
  delete safeData.solution;

  const logicGrid = validateLogicGridPuzzleData(rawData, { requireSolution: false });
  if (!logicGrid.valid || !logicGrid.normalized) {
    // Fail closed: an invalid puzzle must never echo raw/partial clue data (which may carry
    // contaminated structured-clue metadata) back to the client.
    return { ...safeData, clues: [] };
  }

  return {
    ...safeData,
    ...stripLogicGridSolution(logicGrid.normalized),
  };
}

export function sanitizePublicPuzzleData(puzzleType: unknown, rawData: unknown): unknown {
  if (!rawData || typeof rawData !== "object") {
    return rawData;
  }

  const normalizedType = String(puzzleType ?? "").trim().toLowerCase();
  const data = { ...(rawData as Record<string, unknown>) };

  if (normalizedType === "word_crack") {
    return sanitizeHiddenWordData(data);
  }

  if (normalizedType === "crossword") {
    return sanitizeCrosswordData(data);
  }

  if (normalizedType === "logic_grid") {
    return sanitizeLogicGridData(data);
  }

  if (normalizedType === "gridlock_file") {
    const normalized = getGridlockFileData(data);
    if (!normalized) return {};
    const safe = sanitizeGridlockForClient(normalized) as Record<string, unknown>;
    return data.gridlockFile && typeof data.gridlockFile === "object"
      ? { gridlockFile: safe }
      : safe;
  }

  return data;
}
