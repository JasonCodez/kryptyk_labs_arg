import {
  applyGridlockSelection,
  clearGridlockSelection,
  createInitialGridlockState,
  getGridlockPuzzleSignature,
  gridlockStorageKey,
  isGridlockStateComplete,
  normalizeGridlockData,
  restoreGridlockState,
  serializeGridlockState,
  setGridlockValue,
  validateGridlockData,
  validateGridlockSubmission,
} from './gridlockCore';

function selectionPuzzle() {
  const normalized = normalizeGridlockData({
    schemaVersion: 2,
    answerMode: 'selection',
    fileNumber: 7,
    fileTitle: 'Evidence Matrix',
    flavorText: 'Find the linked files.',
    objective: 'Select both matching records.',
    gridType: 'logic',
    rows: 2,
    columns: 2,
    requiredSelections: 2,
    maximumAttempts: 3,
    ruleExplanation: 'The matching records share a category.',
    primaryRuleFamily: 'constraint',
    primaryRuleAxis: 'both',
    grid: [
      [{ id: 'alpha', label: 'Alpha', value: 'Alpha' }, { id: 'beta', label: 'Beta', value: 'Beta' }],
      [{ id: 'gamma', label: 'Gamma', value: 'Gamma' }, { id: 'delta', label: 'Delta', value: 'Delta', disabled: true }],
    ],
    correctAnswers: ['alpha', 'gamma'],
    rules: [{ id: 'rule-1', type: 'constraint', text: 'Match categories.', relatedCellIds: ['alpha'], displayOrder: 0, initiallyVisible: true }],
  });
  if (!normalized) throw new Error('fixture failed to normalize');
  return normalized;
}

describe('gridlockCore', () => {
  test('normalizes legacy value-entry data and preserves unknown fields', () => {
    const data = normalizeGridlockData({
      fileTitle: 'Legacy', fileNumber: 1, flavorText: 'Old', gridType: 'letter',
      grid: [[{ value: 'A' }, { value: '?', isMissing: true }], [{ value: 'B' }, { value: 'C' }]],
      correctAnswers: ['D'], ruleExplanation: 'Complete the sequence.',
      primaryRuleFamily: 'alphabetic', primaryRuleAxis: 'rows', vendorField: { keep: true },
    });
    expect(data?.answerMode).toBe('value-entry');
    expect(data?.grid[0][0].id).toBe('cell-r1-c1');
    expect(data?.vendorField).toEqual({ keep: true });
    expect(validateGridlockData(data).valid).toBe(true);
  });

  test('does not manufacture IDs for an invalid version-two selection draft', () => {
    const data = selectionPuzzle();
    data.grid[0][0].id = '';
    expect(validateGridlockData(data).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-id' }),
    ]));
  });

  test('toggles selections, enforces limits, rejects locked cells, and clears safely', () => {
    const data = selectionPuzzle();
    let state = createInitialGridlockState(data);
    state = applyGridlockSelection(state, data, 'alpha');
    state = applyGridlockSelection(state, data, 'gamma');
    expect(isGridlockStateComplete(state, data)).toBe(true);
    expect(applyGridlockSelection(state, data, 'beta').answer).toEqual(state.answer);
    expect(applyGridlockSelection(state, data, 'delta').message).toMatch(/locked/i);
    state = applyGridlockSelection(state, data, 'alpha');
    expect(state.answer).toEqual({ mode: 'selection', cellIds: ['gamma'] });
    expect(clearGridlockSelection(state).answer).toEqual({ mode: 'selection', cellIds: [] });
  });

  test('updates legacy values and determines completion', () => {
    const data = normalizeGridlockData({
      fileTitle: 'Legacy', grid: [[{ value: '?', isMissing: true }, { value: 'A' }], [{ value: 'B' }, { value: 'C' }]],
      correctAnswers: ['D'], ruleExplanation: 'Rule', primaryRuleFamily: 'constraint', primaryRuleAxis: 'both',
    })!;
    let state = createInitialGridlockState(data);
    expect(isGridlockStateComplete(state, data)).toBe(false);
    state = setGridlockValue(state, 0, 'D');
    expect(isGridlockStateComplete(state, data)).toBe(true);
  });

  test('validates submissions without accepting malformed IDs or duplicate IDs', () => {
    const data = selectionPuzzle();
    expect(validateGridlockSubmission(data, { answers: ['gamma', 'alpha'] })).toEqual(expect.objectContaining({ valid: true, correct: true }));
    expect(validateGridlockSubmission(data, { answers: ['alpha', 'alpha'] }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-cell-id' }),
    ]));
    expect(validateGridlockSubmission(data, { answers: ['alpha', 'server-secret'] }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-cell-id' }),
    ]));
  });

  test('serializes and restores only compatible progress, including retry identity', () => {
    const data = selectionPuzzle();
    let state = applyGridlockSelection(createInitialGridlockState(data), data, 'alpha');
    state = applyGridlockSelection(state, data, 'gamma');
    state = { ...state, elapsedMs: 12000, attemptsUsed: 1, completionPending: true, pendingSubmissionId: 'submission-7' };
    const signature = getGridlockPuzzleSignature(data);
    const serialized = serializeGridlockState(state, signature, 123);
    expect(restoreGridlockState(serialized, data)).toEqual(expect.objectContaining({
      status: 'completion-pending', elapsedMs: 12000, pendingSubmissionId: 'submission-7',
    }));
    expect(restoreGridlockState({ ...serialized, signature: 'stale' }, data)).toBeNull();
  });

  test('scopes persistence keys by play mode and daily identity', () => {
    expect(gridlockStorageKey('catalog', 'p-1')).toBe('gridlock-progress:v1:catalog:p-1');
    expect(gridlockStorageKey('daily', 'p-1', '2026-07-16')).toContain('daily:2026-07-16:p-1');
    expect(gridlockStorageKey('daily', 'p-1')).toBeNull();
    expect(gridlockStorageKey('none', 'p-1')).toBeNull();
  });
});
