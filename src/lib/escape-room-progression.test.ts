import { applyEscapeStageProgress } from './escape-room-progression';

describe('applyEscapeStageProgress', () => {
  it('marks the current stage as solved when advancing from stage 1 to 2', () => {
    const result = applyEscapeStageProgress({
      currentStageIndex: 1,
      solvedStages: [],
      requestedNextStageIndex: 2,
      totalRooms: 4,
    });

    expect(result.isComplete).toBe(false);
    expect(result.nextStageIndex).toBe(2);
    expect(result.solvedStages).toEqual([1]);
  });

  it('completes when requested next stage exceeds total rooms', () => {
    const result = applyEscapeStageProgress({
      currentStageIndex: 4,
      solvedStages: [1, 2, 3],
      requestedNextStageIndex: 5,
      totalRooms: 4,
    });

    expect(result.isComplete).toBe(true);
    expect(result.nextStageIndex).toBe(4);
    expect(result.solvedStages).toEqual([1, 2, 3, 4]);
  });

  it('deduplicates and sorts solved stage list', () => {
    const result = applyEscapeStageProgress({
      currentStageIndex: 2,
      solvedStages: [3, 1, 2, 1],
      requestedNextStageIndex: 3,
      totalRooms: 5,
    });

    expect(result.isComplete).toBe(false);
    expect(result.nextStageIndex).toBe(3);
    expect(result.solvedStages).toEqual([1, 2, 3]);
  });
});
