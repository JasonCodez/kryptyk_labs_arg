import {
  createGridlockCellId,
  GRIDLOCK_SIZE_LIMITS,
  normalizeGridlockFileData,
  validateGridlockFileData,
  type GridCell,
  type GridlockFileData,
  type GridlockRule,
  type GridlockValidationResult,
} from './gridlockFile';

export type GridlockDraft = GridlockFileData;

export type GridlockResizeResult = {
  draft: GridlockDraft;
  requiresConfirmation: boolean;
  removedCells: GridCell[];
};

export type GridlockImportResult =
  | { ok: true; draft: GridlockDraft; validation: GridlockValidationResult }
  | { ok: false; error: string; line?: number; column?: number };

export function createUniqueGridlockId(prefix: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  let suffix = 1;
  while (existing.has(`${prefix}-${suffix}`)) suffix++;
  return `${prefix}-${suffix}`;
}

function blankCell(row: number, column: number): GridCell {
  return { id: createGridlockCellId(row, column), row, column, label: '', value: '' };
}

export function createGridlockDraft(rows = 4, columns = 4): GridlockDraft {
  const safeRows = Math.max(GRIDLOCK_SIZE_LIMITS.minRows, Math.min(rows, GRIDLOCK_SIZE_LIMITS.maxRows));
  let safeColumns = Math.max(GRIDLOCK_SIZE_LIMITS.minColumns, Math.min(columns, GRIDLOCK_SIZE_LIMITS.maxColumns));
  if (safeRows * safeColumns > GRIDLOCK_SIZE_LIMITS.maxCells) {
    safeColumns = Math.max(GRIDLOCK_SIZE_LIMITS.minColumns, Math.floor(GRIDLOCK_SIZE_LIMITS.maxCells / safeRows));
  }
  const rule: GridlockRule = {
    id: 'rule-1',
    type: 'constraint',
    text: '',
    displayOrder: 0,
    initiallyVisible: true,
    relatedCellIds: [],
  };
  return {
    schemaVersion: 2,
    answerMode: 'selection',
    fileNumber: 1,
    fileTitle: '',
    flavorText: '',
    objective: '',
    gridType: 'logic',
    rows: safeRows,
    columns: safeColumns,
    requiredSelections: 1,
    maximumAttempts: 3,
    difficulty: 'medium',
    rewardSettings: { points: 100, xp: 50 },
    grid: Array.from({ length: safeRows }, (_, row) =>
      Array.from({ length: safeColumns }, (_, column) => blankCell(row, column)),
    ),
    correctAnswers: [],
    ruleExplanation: '',
    primaryRuleFamily: 'constraint',
    primaryRuleAxis: 'both',
    rules: [rule],
  };
}

export function gridlockDataToDraft(input: unknown): GridlockDraft | null {
  return normalizeGridlockFileData(input);
}

export function gridlockDraftToData(draft: GridlockDraft): GridlockFileData {
  const normalized = normalizeGridlockFileData(draft);
  if (!normalized) throw new Error('The Gridlock draft cannot be normalized.');
  return normalized;
}

function hasConfiguredData(cell: GridCell, answers: Set<string>, related: Set<string>): boolean {
  return Boolean(
    String(cell.label ?? cell.value ?? '').trim() || cell.description || cell.category || cell.icon ||
    cell.disabled || cell.locked || cell.evidence || answers.has(cell.id ?? '') || related.has(cell.id ?? ''),
  );
}

export function resizeGridlockDraft(
  draft: GridlockDraft,
  rows: number,
  columns: number,
  confirmed = false,
): GridlockResizeResult {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) ||
      rows < GRIDLOCK_SIZE_LIMITS.minRows || rows > GRIDLOCK_SIZE_LIMITS.maxRows ||
      columns < GRIDLOCK_SIZE_LIMITS.minColumns || columns > GRIDLOCK_SIZE_LIMITS.maxColumns ||
      rows * columns > GRIDLOCK_SIZE_LIMITS.maxCells) {
    throw new Error(`Grid size must be within ${GRIDLOCK_SIZE_LIMITS.minRows}-${GRIDLOCK_SIZE_LIMITS.maxRows} rows, ${GRIDLOCK_SIZE_LIMITS.minColumns}-${GRIDLOCK_SIZE_LIMITS.maxColumns} columns, and ${GRIDLOCK_SIZE_LIMITS.maxCells} cells.`);
  }
  const answerIds = new Set(draft.answerMode === 'selection' ? draft.correctAnswers.map(String) : []);
  const relatedIds = new Set((draft.rules ?? []).flatMap(rule => rule.relatedCellIds ?? []));
  const removedCells = draft.grid.flat().filter(cell => (cell.row ?? 0) >= rows || (cell.column ?? 0) >= columns)
    .filter(cell => hasConfiguredData(cell, answerIds, relatedIds));
  if (removedCells.length && !confirmed) return { draft, requiresConfirmation: true, removedCells };

  const grid = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
    const existing = draft.grid[row]?.[column];
    return existing ? { ...existing, row, column } : blankCell(row, column);
  }));
  const retainedIds = new Set(grid.flat().map(cell => cell.id as string));
  const next: GridlockDraft = {
    ...draft,
    rows,
    columns,
    grid,
    correctAnswers: draft.answerMode === 'selection'
      ? draft.correctAnswers.filter(id => retainedIds.has(String(id)))
      : draft.correctAnswers,
    rules: (draft.rules ?? []).map(rule => ({
      ...rule,
      relatedCellIds: (rule.relatedCellIds ?? []).filter(id => retainedIds.has(id)),
    })),
  };
  return { draft: next, requiresConfirmation: false, removedCells };
}

export function toggleGridlockSolution(draft: GridlockDraft, cellId: string): GridlockDraft {
  if (draft.answerMode !== 'selection') return draft;
  const selected = new Set(draft.correctAnswers.map(String));
  if (selected.has(cellId)) selected.delete(cellId); else selected.add(cellId);
  return { ...draft, correctAnswers: draft.grid.flat().map(cell => cell.id as string).filter(id => selected.has(id)) };
}

export function reorderGridlockRule(draft: GridlockDraft, ruleId: string, direction: -1 | 1): GridlockDraft {
  const rules = [...(draft.rules ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const index = rules.findIndex(rule => rule.id === ruleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rules.length) return draft;
  [rules[index], rules[target]] = [rules[target], rules[index]];
  return { ...draft, rules: rules.map((rule, displayOrder) => ({ ...rule, displayOrder })) };
}

function locateJsonError(text: string, error: unknown): { error: string; line?: number; column?: number } {
  const message = error instanceof Error ? error.message : 'Invalid JSON.';
  const match = message.match(/position\s+(\d+)/i);
  const tokenMatch = message.match(/Unexpected token\s+['"]?([^'"\s,])['"]?/i);
  const offset = match ? Number(match[1]) : tokenMatch ? text.indexOf(tokenMatch[1]) : -1;
  if (offset < 0) return { error: message };
  const before = text.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return { error: message, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function importGridlockJson(text: string): GridlockImportResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (error) { return { ok: false, ...locateJsonError(text, error) }; }
  const draft = gridlockDataToDraft(parsed);
  if (!draft) return { ok: false, error: 'JSON does not contain a Gridlock grid.' };
  const validation = validateGridlockFileData(draft);
  if (!validation.valid) return { ok: false, error: validation.errors.map(issue => issue.message).join(' ') };
  return { ok: true, draft, validation };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('Malformed CSV: a quoted field is not closed.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function importGridlockCsv(text: string, baseDraft?: GridlockDraft): GridlockImportResult {
  let rows: string[][];
  try { rows = parseCsvRows(text); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Malformed CSV.' }; }
  if (rows.length < 2) return { ok: false, error: 'CSV must include a header and at least one cell.' };
  const headers = rows[0].map(value => value.trim().toLowerCase());
  const required = ['row', 'col', 'label'];
  if (required.some(name => !headers.includes(name))) return { ok: false, error: 'CSV headers must include row, col, and label.' };
  const records = rows.slice(1).map(values => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ''])) as Record<string, string> & { sourceLine?: number });
  const maxRow = Math.max(...records.map(record => Number(record.row)));
  const maxCol = Math.max(...records.map(record => Number(record.col)));
  if (!records.every(record => Number.isInteger(Number(record.row)) && Number(record.row) > 0 && Number.isInteger(Number(record.col)) && Number(record.col) > 0)) {
    return { ok: false, error: 'CSV row and col values must be positive integers.' };
  }
  let draft = baseDraft ?? createGridlockDraft(maxRow, maxCol);
  try { draft = resizeGridlockDraft(draft, maxRow, maxCol, true).draft; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unsupported CSV grid size.' }; }
  const seen = new Set<string>();
  const grid = draft.grid.map(row => row.map(cell => ({ ...cell })));
  const answers = new Set<string>();
  for (const record of records) {
    const row = Number(record.row) - 1;
    const column = Number(record.col) - 1;
    const key = `${row}:${column}`;
    if (seen.has(key)) return { ok: false, error: `CSV contains duplicate coordinates at row ${record.row}, col ${record.col}.` };
    seen.add(key);
    const existing = grid[row][column];
    const id = record.id?.trim() || existing.id || createGridlockCellId(row, column);
    grid[row][column] = {
      ...existing, id, row, column, label: record.label.trim(), value: record.label.trim(),
      description: record.description?.trim() || undefined,
      category: record.category?.trim() || undefined,
      disabled: /^(true|1|yes)$/i.test(record.disabled ?? ''),
    };
    if (/^(true|1|yes)$/i.test(record.correct ?? '')) answers.add(id);
  }
  draft = { ...draft, answerMode: 'selection', grid, correctAnswers: [...answers], requiredSelections: answers.size || draft.requiredSelections };
  return { ok: true, draft, validation: validateGridlockFileData(draft) };
}
