export interface EscapeStageProgressInput {
  currentStageIndex: number;
  solvedStages: number[];
  requestedNextStageIndex: number;
  totalRooms: number;
  explicitComplete?: boolean;
}

export interface EscapeStageProgressResult {
  isComplete: boolean;
  nextStageIndex: number;
  solvedStages: number[];
}

export function applyEscapeStageProgress(input: EscapeStageProgressInput): EscapeStageProgressResult {
  const cur = Math.max(1, Math.floor(Number(input.currentStageIndex) || 1));
  const requestedNext = Math.max(1, Math.floor(Number(input.requestedNextStageIndex) || (cur + 1)));
  const totalRooms = Math.max(0, Math.floor(Number(input.totalRooms) || 0));

  const isComplete = Boolean(input.explicitComplete) || (totalRooms > 0 && requestedNext > totalRooms);
  const nextStageIndex = isComplete ? (totalRooms || cur) : requestedNext;
  const solvedStageIndex = isComplete ? nextStageIndex : cur;

  const normalizedSolved = Array.isArray(input.solvedStages)
    ? input.solvedStages
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1)
        .map((value) => Math.floor(value))
    : [];

  const solvedSet = new Set<number>(normalizedSolved);
  solvedSet.add(solvedStageIndex);

  const solvedStages = Array.from(solvedSet).sort((a, b) => a - b);

  return {
    isComplete,
    nextStageIndex,
    solvedStages,
  };
}
