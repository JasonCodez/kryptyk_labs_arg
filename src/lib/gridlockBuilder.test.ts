import {
  createGridlockCellId,
  getNormalizedGridlockSeedData,
  normalizeGridlockFileData,
  sanitizeGridlockForClient,
  validateGridlockAnswer,
  validateGridlockFileData,
} from './gridlockFile';
import {
  createGridlockDraft,
  gridlockDataToDraft,
  gridlockDraftToData,
  importGridlockCsv,
  importGridlockJson,
  reorderGridlockRule,
  resizeGridlockDraft,
  toggleGridlockSolution,
} from './gridlockBuilder';

function validDraft() {
  const draft = createGridlockDraft(2, 2);
  draft.fileTitle = 'Case 7';
  draft.ruleExplanation = 'Select the matching evidence.';
  draft.rules = [{ id: 'rule-1', type: 'constraint', text: 'Match the evidence.', displayOrder: 0, initiallyVisible: true, relatedCellIds: [] }];
  draft.grid[0][0].label = 'Alpha'; draft.grid[0][0].value = 'Alpha';
  draft.grid[0][1].label = 'Beta'; draft.grid[0][1].value = 'Beta';
  draft.grid[1][0].label = 'Gamma'; draft.grid[1][0].value = 'Gamma';
  draft.grid[1][1].label = 'Delta'; draft.grid[1][1].value = 'Delta';
  draft.correctAnswers = [draft.grid[0][0].id!];
  draft.requiredSelections = 1;
  return draft;
}

describe('Gridlock visual builder contract', () => {
  test('converts visual drafts to normalized JSON and back with stable IDs', () => {
    const source = validDraft();
    const data = gridlockDraftToData(source);
    const restored = gridlockDataToDraft({ gridlockFile: data });
    expect(restored?.grid[0][0].id).toBe(createGridlockCellId(0, 0));
    expect(restored?.correctAnswers).toEqual(data.correctAnswers);
    expect(validateGridlockFileData(restored).valid).toBe(true);
  });

  test('resizes without changing retained cells and requests confirmation for destructive shrink', () => {
    const source = validDraft();
    const grown = resizeGridlockDraft(source, 3, 3);
    expect(grown.requiresConfirmation).toBe(false);
    expect(grown.draft.grid[0][0].id).toBe(source.grid[0][0].id);
    grown.draft.grid[2][2].label = 'Configured';
    const blocked = resizeGridlockDraft(grown.draft, 2, 2);
    expect(blocked.requiresConfirmation).toBe(true);
    expect(blocked.draft.rows).toBe(3);
    const confirmed = resizeGridlockDraft(grown.draft, 2, 2, true);
    expect(confirmed.requiresConfirmation).toBe(false);
    expect(confirmed.draft.grid.flat().some(cell => cell.label === 'Configured')).toBe(false);
  });

  test('marks solutions by ID and reports required-count mismatch', () => {
    const source = validDraft();
    const secondId = source.grid[0][1].id!;
    const marked = toggleGridlockSolution(source, secondId);
    expect(marked.correctAnswers).toContain(secondId);
    expect(validateGridlockFileData(marked).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'required-count-mismatch' })]));
    expect(validateGridlockAnswer({ ...marked, requiredSelections: 2 }, [...marked.correctAnswers].reverse())).toEqual(expect.objectContaining({ correct: true }));
  });

  test('creates and reorders rule cards and rejects invalid related cells', () => {
    const source = validDraft();
    source.rules!.push({ id: 'rule-2', type: 'semantic', text: 'Second', displayOrder: 1, initiallyVisible: false, relatedCellIds: ['missing-cell'] });
    expect(validateGridlockFileData(source).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid-related-cell' })]));
    const reordered = reorderGridlockRule(source, 'rule-2', -1);
    expect(reordered.rules?.map(rule => rule.id)).toEqual(['rule-2', 'rule-1']);
  });

  test('preserves the previous draft when JSON parsing or validation fails', () => {
    const source = validDraft();
    const malformed = importGridlockJson('{\n "grid": [}');
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.line).toBe(2);
    expect(source.fileTitle).toBe('Case 7');
    expect(importGridlockJson(JSON.stringify(source))).toEqual(expect.objectContaining({ ok: true }));
  });

  test('imports CSV cells and rejects malformed CSV', () => {
    const imported = importGridlockCsv('row,col,label,description,category,correct,disabled\n1,1,Alpha,First,A,true,false\n1,2,Beta,,B,false,true\n2,1,Gamma,,,false,false\n2,2,Delta,,,false,false');
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.draft.grid[0][0].id).toBe(createGridlockCellId(0, 0));
      expect(imported.draft.correctAnswers).toEqual([createGridlockCellId(0, 0)]);
      expect(imported.draft.grid[0][1].disabled).toBe(true);
    }
    expect(importGridlockCsv('row,col,label\n1,1,"never closes').ok).toBe(false);
  });

  test('reports duplicate IDs', () => {
    const source = validDraft();
    source.grid[0][1].id = source.grid[0][0].id;
    expect(validateGridlockFileData(source).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate-id' })]));
  });

  test('client preview data never includes answer state', () => {
    const source = validDraft();
    (source as unknown as Record<string, unknown>).legacyAnswerKey = ['secret'];
    source.retentionUnlock = 'post-solve only';
    source.primaryRuleFamily = 'semantic';
    source.rules!.push({ id: 'hidden', type: 'semantic', text: 'Hidden rule', displayOrder: 1, initiallyVisible: false });
    const safe = sanitizeGridlockForClient(source);
    expect('correctAnswers' in safe).toBe(false);
    expect('legacyAnswerKey' in safe).toBe(false);
    expect('primaryRuleFamily' in safe).toBe(false);
    expect('retentionUnlock' in safe).toBe(false);
    expect(safe.rules?.some(rule => rule.id === 'hidden')).toBe(false);
    expect(JSON.stringify(safe)).not.toContain('isCorrect');
    expect(safe.grid.flat().some(cell => 'correct' in cell)).toBe(false);
  });

  test('normalizes legacy puzzles without discarding unknown fields', () => {
    const legacy = normalizeGridlockFileData({
      grid: [[{ value: 'A' }, { value: '?', isMissing: true }], [{ value: 'B' }, { value: 'C' }]],
      correctAnswers: ['D'], ruleExplanation: 'Legacy rule', primaryRuleFamily: 'alphabetic', primaryRuleAxis: 'rows',
      fileNumber: 9, fileTitle: 'Legacy', flavorText: 'Old', gridType: 'letter', vendorExtension: { retained: true },
    });
    expect(legacy?.answerMode).toBe('value-entry');
    expect((legacy as unknown as Record<string, unknown>).vendorExtension).toEqual({ retained: true });
    expect(legacy?.grid[0][0].id).toBe(createGridlockCellId(0, 0));
    expect(legacy?.correctAnswers).toEqual(['D']);
    expect(validateGridlockFileData(legacy).valid).toBe(true);
  });

  test('preserves and warns about unsupported legacy rule values', () => {
    const legacy = normalizeGridlockFileData({
      ...validDraft(), answerMode: 'selection', primaryRuleFamily: 'custom-engine', primaryRuleAxis: 'hexagonal',
    });
    const validation = validateGridlockFileData(legacy);
    expect(validation.valid).toBe(true);
    expect(validation.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unsupported-legacy-value' })]));
    expect(legacy?.legacyUnsupportedValues).toEqual(expect.objectContaining({ primaryRuleFamily: 'custom-engine', primaryRuleAxis: 'hexagonal' }));
  });

  test('normalizes and validates all shared seed data', () => {
    expect(getNormalizedGridlockSeedData()).toHaveLength(7);
  });
});
