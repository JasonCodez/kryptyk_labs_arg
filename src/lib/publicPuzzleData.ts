import {
  stripCrosswordAnswers,
  type CrosswordPuzzleDataInput,
  validateCrosswordPuzzleData,
} from "@/lib/crosswordCore";

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

  return data;
}