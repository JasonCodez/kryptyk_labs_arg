export type GridlockValue = string | number;
export type GridlockAnswerMode = "selection" | "value-entry";
export type GridlockPersistenceScope = "catalog" | "daily" | "none";
export type GridlockPlayerStatus =
  | "loading"
  | "ready"
  | "playing"
  | "checking"
  | "completion-pending"
  | "won"
  | "failed"
  | "config-error"
  | "network-error";

export const GRIDLOCK_CORE_LIMITS = {
  minRows: 2,
  maxRows: 12,
  minColumns: 2,
  maxColumns: 12,
  maxCells: 100,
} as const;

export const GRIDLOCK_SUPPORTED_RULE_TYPES = [
  "arithmetic", "geometric", "fibonacci", "polynomial", "alphabetic",
  "compound-word", "constraint", "positional", "semantic", "hybrid",
] as const;
export type GridlockRuleType = typeof GRIDLOCK_SUPPORTED_RULE_TYPES[number];

export const GRIDLOCK_SUPPORTED_RULE_AXES = ["rows", "columns", "both", "diagonal", "spiral", "cell-position"] as const;
export type GridlockRuleAxis = typeof GRIDLOCK_SUPPORTED_RULE_AXES[number];

export interface GridlockCell {
  id: string;
  row: number;
  column: number;
  label: string;
  value: GridlockValue;
  description?: string;
  category?: string;
  icon?: string;
  evidence?: string;
  disabled?: boolean;
  locked?: boolean;
  isMissing?: boolean;
}

export interface GridlockRule {
  id: string;
  type: GridlockRuleType;
  text: string;
  relatedCellIds: string[];
  displayOrder: number;
  initiallyVisible: boolean;
  unlock?: { afterAttempts?: number; afterRuleId?: string };
}

export interface GridlockPuzzleData {
  schemaVersion: 2;
  answerMode: GridlockAnswerMode;
  fileNumber: number;
  fileTitle: string;
  flavorText: string;
  objective: string;
  gridType: "letter" | "number" | "word" | "logic" | "hybrid";
  grid: GridlockCell[][];
  rows: number;
  columns: number;
  requiredSelections: number;
  maximumAttempts: number;
  correctAnswers: GridlockValue[];
  ruleExplanation: string;
  primaryRuleFamily: GridlockRuleType;
  primaryRuleAxis: GridlockRuleAxis;
  secondaryRuleFamily?: GridlockRuleType;
  secondaryRuleAxis?: GridlockRuleAxis;
  rules: GridlockRule[];
  hints?: Array<{ id: string; text: string; cost: number }>;
  difficulty?: "easy" | "medium" | "hard" | "expert" | "extreme";
  rewardSettings?: { points?: number; xp?: number };
  arcNumber?: number;
  arcDay?: number;
  retentionUnlock?: string;
  shadowRuleNote?: string;
  seasonKeyIndex?: number;
  legacyUnsupportedValues?: Record<string, unknown>;
  [key: string]: unknown;
}

export type GridlockAnswer =
  | { mode: "selection"; cellIds: string[] }
  | { mode: "value-entry"; values: string[] };

export interface GridlockPlayerState {
  status: GridlockPlayerStatus;
  answer: GridlockAnswer;
  elapsedMs: number;
  attemptsUsed: number;
  hintsUsed: string[];
  completionPending: boolean;
  pendingSubmissionId: string | null;
  rulePanelOpen: boolean;
  focusedCellId: string | null;
  message: string;
}

export interface GridlockValidationIssue {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface GridlockValidationResult {
  valid: boolean;
  errors: GridlockValidationIssue[];
  warnings: GridlockValidationIssue[];
  normalized: GridlockPuzzleData | null;
}

export interface GridlockCompletionResult {
  valid: boolean;
  correct: boolean;
  correctCount: number;
  requiredCount: number;
  errors: GridlockValidationIssue[];
}

export interface SerializedGridlockState {
  version: 1;
  signature: string;
  answer: GridlockAnswer;
  elapsedMs: number;
  attemptsUsed: number;
  hintsUsed: string[];
  completionPending: boolean;
  pendingSubmissionId?: string | null;
  savedAt: number;
}

export interface GridlockStorageReader {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isFiniteInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
const isRuleType = (value: unknown): value is GridlockRuleType => typeof value === "string" && (GRIDLOCK_SUPPORTED_RULE_TYPES as readonly string[]).includes(value);
const isRuleAxis = (value: unknown): value is GridlockRuleAxis => typeof value === "string" && (GRIDLOCK_SUPPORTED_RULE_AXES as readonly string[]).includes(value);
const isGridType = (value: unknown): value is GridlockPuzzleData["gridType"] => typeof value === "string" && ["letter", "number", "word", "logic", "hybrid"].includes(value);
const isDifficulty = (value: unknown): value is NonNullable<GridlockPuzzleData["difficulty"]> => typeof value === "string" && ["easy", "medium", "hard", "expert", "extreme"].includes(value);
const cellIdAt = (row: number, column: number) => `cell-r${row + 1}-c${column + 1}`;

function rootRecord(input: unknown): Record<string, unknown> | null {
  if (typeof input === "string") {
    try { return rootRecord(JSON.parse(input)); } catch { return null; }
  }
  if (!isRecord(input)) return null;
  return isRecord(input.gridlockFile) ? input.gridlockFile : input;
}

function valueOrEmpty(value: unknown): GridlockValue {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function issue(path: string, code: string, message: string, severity: "error" | "warning" = "error"): GridlockValidationIssue {
  return { path, code, message, severity };
}

export function normalizeGridlockData(input: unknown): GridlockPuzzleData | null {
  const source = rootRecord(input);
  if (!source || !Array.isArray(source.grid)) return null;
  const explicitSelection = source.answerMode === "selection"
    || (source.schemaVersion === 2 && source.answerMode !== "value-entry");
  const rawGrid = source.grid;
  const normalizedGrid: GridlockCell[][] = rawGrid.map((rawRow, row) => {
    if (!Array.isArray(rawRow)) return [];
    return rawRow.map((rawCell, column) => {
      const cell: Record<string, unknown> = isRecord(rawCell) ? rawCell : { value: rawCell };
      const value = valueOrEmpty(cell.value ?? cell.label);
      const id = typeof cell.id === "string" && cell.id.trim() ? cell.id.trim() : explicitSelection ? "" : cellIdAt(row, column);
      return {
        id,
        row,
        column,
        label: typeof cell.label === "string" ? cell.label : String(value),
        value,
        ...(typeof cell.description === "string" ? { description: cell.description } : {}),
        ...(typeof cell.category === "string" ? { category: cell.category } : {}),
        ...(typeof cell.icon === "string" ? { icon: cell.icon } : {}),
        ...(typeof cell.evidence === "string" ? { evidence: cell.evidence } : {}),
        ...(cell.disabled === true ? { disabled: true } : {}),
        ...(cell.locked === true ? { locked: true } : {}),
        ...(cell.isMissing === true ? { isMissing: true } : {}),
      };
    });
  });
  const rows = normalizedGrid.length;
  const columns = normalizedGrid.reduce((max, row) => Math.max(max, row.length), 0);
  const ids = new Set(normalizedGrid.flat().map(cell => cell.id));
  const correctAnswers = Array.isArray(source.correctAnswers)
    ? source.correctAnswers.filter((answer): answer is GridlockValue => typeof answer === "string" || typeof answer === "number")
    : [];
  const answersReferenceCells = correctAnswers.length > 0 && correctAnswers.every(answer => typeof answer === "string" && ids.has(answer));
  const answerMode: GridlockAnswerMode = source.answerMode === "selection" || source.answerMode === "value-entry"
    ? source.answerMode
    : answersReferenceCells ? "selection" : "value-entry";
  const primaryRuleFamily = isRuleType(source.primaryRuleFamily) ? source.primaryRuleFamily : "constraint";
  const primaryRuleAxis = isRuleAxis(source.primaryRuleAxis) ? source.primaryRuleAxis : "both";
  const ruleExplanation = typeof source.ruleExplanation === "string" ? source.ruleExplanation : "";
  const legacyUnsupportedValues = isRecord(source.legacyUnsupportedValues) ? { ...source.legacyUnsupportedValues } : {};
  if (source.primaryRuleFamily != null && !isRuleType(source.primaryRuleFamily)) legacyUnsupportedValues.primaryRuleFamily = source.primaryRuleFamily;
  if (source.primaryRuleAxis != null && !isRuleAxis(source.primaryRuleAxis)) legacyUnsupportedValues.primaryRuleAxis = source.primaryRuleAxis;
  const rawRules = Array.isArray(source.rules) ? source.rules : [];
  const rules: GridlockRule[] = rawRules.flatMap((rawRule, index) => {
    if (!isRecord(rawRule) || !isRuleType(rawRule.type)) {
      if (isRecord(rawRule)) legacyUnsupportedValues[`rules.${index}.type`] = rawRule.type;
      return [];
    }
    const unlock = isRecord(rawRule.unlock) ? {
      ...(isFiniteInteger(rawRule.unlock.afterAttempts) ? { afterAttempts: rawRule.unlock.afterAttempts } : {}),
      ...(typeof rawRule.unlock.afterRuleId === "string" ? { afterRuleId: rawRule.unlock.afterRuleId } : {}),
    } : undefined;
    return [{
      id: typeof rawRule.id === "string" ? rawRule.id.trim() : "",
      type: rawRule.type,
      text: typeof rawRule.text === "string" ? rawRule.text : "",
      relatedCellIds: Array.isArray(rawRule.relatedCellIds) ? rawRule.relatedCellIds.filter((id): id is string => typeof id === "string") : [],
      displayOrder: isFiniteInteger(rawRule.displayOrder) ? rawRule.displayOrder : index,
      initiallyVisible: rawRule.initiallyVisible === true,
      ...(unlock && Object.keys(unlock).length ? { unlock } : {}),
    }];
  }).sort((a, b) => a.displayOrder - b.displayOrder).map((rule, displayOrder) => ({ ...rule, displayOrder }));
  if (!rules.length && ruleExplanation) {
    rules.push({ id: "rule-1", type: primaryRuleFamily, text: ruleExplanation, relatedCellIds: [], displayOrder: 0, initiallyVisible: false });
  }
  const hints = Array.isArray(source.hints) ? source.hints.flatMap((rawHint, index) => {
    if (!isRecord(rawHint) || typeof rawHint.text !== "string") return [];
    return [{ id: typeof rawHint.id === "string" && rawHint.id ? rawHint.id : `hint-${index + 1}`, text: rawHint.text, cost: typeof rawHint.cost === "number" && Number.isFinite(rawHint.cost) ? rawHint.cost : 1 }];
  }) : undefined;

  return {
    ...source,
    schemaVersion: 2,
    answerMode,
    fileNumber: isFiniteInteger(source.fileNumber) ? source.fileNumber : 1,
    fileTitle: typeof source.fileTitle === "string" ? source.fileTitle : "",
    flavorText: typeof source.flavorText === "string" ? source.flavorText : "",
    objective: typeof source.objective === "string" ? source.objective : typeof source.flavorText === "string" ? source.flavorText : "",
    gridType: isGridType(source.gridType) ? source.gridType : "logic",
    grid: normalizedGrid,
    rows: isFiniteInteger(source.rows) ? source.rows : rows,
    columns: isFiniteInteger(source.columns) ? source.columns : columns,
    requiredSelections: isFiniteInteger(source.requiredSelections) ? source.requiredSelections : correctAnswers.length,
    maximumAttempts: isFiniteInteger(source.maximumAttempts) ? source.maximumAttempts : answerMode === "selection" ? 3 : 999,
    correctAnswers,
    ruleExplanation,
    primaryRuleFamily,
    primaryRuleAxis,
    ...(isRuleType(source.secondaryRuleFamily) ? { secondaryRuleFamily: source.secondaryRuleFamily } : {}),
    ...(isRuleAxis(source.secondaryRuleAxis) ? { secondaryRuleAxis: source.secondaryRuleAxis } : {}),
    rules,
    ...(hints ? { hints } : {}),
    ...(isDifficulty(source.difficulty) ? { difficulty: source.difficulty } : {}),
    ...(isRecord(source.rewardSettings) ? { rewardSettings: {
      ...(typeof source.rewardSettings.points === "number" && Number.isFinite(source.rewardSettings.points) ? { points: source.rewardSettings.points } : {}),
      ...(typeof source.rewardSettings.xp === "number" && Number.isFinite(source.rewardSettings.xp) ? { xp: source.rewardSettings.xp } : {}),
    } } : {}),
    ...(Object.keys(legacyUnsupportedValues).length ? { legacyUnsupportedValues } : {}),
  } as GridlockPuzzleData;
}

export function validateGridlockData(input: unknown, options: { requireAnswers?: boolean; requireRuleExplanation?: boolean } = {}): GridlockValidationResult {
  const data = normalizeGridlockData(input);
  const errors: GridlockValidationIssue[] = [];
  const warnings: GridlockValidationIssue[] = [];
  const add = (entry: GridlockValidationIssue) => (entry.severity === "warning" ? warnings : errors).push(entry);
  if (!data) return { valid: false, errors: [issue("grid", "invalid-root", "Gridlock data must contain a two-dimensional grid.")], warnings, normalized: null };
  const actualRows = data.grid.length;
  const actualColumns = data.grid.reduce((max, row) => Math.max(max, row.length), 0);
  if (!data.fileTitle.trim()) add(issue("fileTitle", "missing-title", "Gridlock title is required."));
  if (data.rows !== actualRows) add(issue("rows", "row-count-mismatch", `Configured rows (${data.rows}) do not match the grid (${actualRows}).`));
  if (data.columns !== actualColumns) add(issue("columns", "column-count-mismatch", `Configured columns (${data.columns}) do not match the grid (${actualColumns}).`));
  if (actualRows < GRIDLOCK_CORE_LIMITS.minRows || actualRows > GRIDLOCK_CORE_LIMITS.maxRows) add(issue("rows", "unsupported-rows", `Rows must be between ${GRIDLOCK_CORE_LIMITS.minRows} and ${GRIDLOCK_CORE_LIMITS.maxRows}.`));
  if (actualColumns < GRIDLOCK_CORE_LIMITS.minColumns || actualColumns > GRIDLOCK_CORE_LIMITS.maxColumns) add(issue("columns", "unsupported-columns", `Columns must be between ${GRIDLOCK_CORE_LIMITS.minColumns} and ${GRIDLOCK_CORE_LIMITS.maxColumns}.`));
  if (actualRows * actualColumns > GRIDLOCK_CORE_LIMITS.maxCells) add(issue("grid", "too-many-cells", `Grid may contain at most ${GRIDLOCK_CORE_LIMITS.maxCells} cells.`));
  if (data.answerMode === "selection" && data.grid.some(row => row.length !== actualColumns)) add(issue("grid", "ragged-grid", "Selection grids must be rectangular."));
  const cells = data.grid.flat();
  const ids = new Set<string>();
  cells.forEach((cell, index) => {
    if (!cell.id) add(issue(`grid.${index}.id`, "missing-id", `Cell at row ${cell.row + 1}, column ${cell.column + 1} needs a stable ID.`));
    else if (ids.has(cell.id)) add(issue(`grid.${index}.id`, "duplicate-id", `Duplicate cell ID "${cell.id}".`));
    ids.add(cell.id);
    if (!cell.label.trim()) add(issue(`grid.${index}.label`, "missing-label", `Cell at row ${cell.row + 1}, column ${cell.column + 1} needs a label.`, "warning"));
  });
  const requireAnswers = options.requireAnswers !== false;
  if (requireAnswers && data.correctAnswers.length === 0) add(issue("correctAnswers", "missing-answer", "At least one canonical answer is required."));
  if (data.answerMode === "selection") {
    if (!Number.isInteger(data.requiredSelections) || data.requiredSelections < 1) add(issue("requiredSelections", "invalid-required-count", "Required selections must be at least 1."));
    if (data.requiredSelections > cells.filter(cell => !cell.disabled && !cell.locked).length) add(issue("requiredSelections", "impossible-required-count", "Required selections exceed the number of selectable cells."));
    const answerIds = data.correctAnswers.map(String);
    if (new Set(answerIds).size !== answerIds.length) add(issue("correctAnswers", "duplicate-answer-cell", "Canonical answer cell IDs must be unique."));
    answerIds.forEach((id, index) => {
      const cell = cells.find(candidate => candidate.id === id);
      if (!cell) add(issue(`correctAnswers.${index}`, "invalid-answer-cell", `Answer cell "${id}" does not exist.`));
      else if (cell.disabled || cell.locked) add(issue(`correctAnswers.${index}`, "unselectable-answer-cell", `Answer cell "${id}" cannot be disabled or locked.`));
    });
    if (requireAnswers && data.correctAnswers.length !== data.requiredSelections) add(issue("requiredSelections", "required-count-mismatch", `Required selections (${data.requiredSelections}) must match canonical answers (${data.correctAnswers.length}).`));
  } else {
    const missingCount = cells.filter(cell => cell.isMissing).length;
    if (missingCount < 1) add(issue("grid", "missing-input-cell", "Legacy value-entry puzzles need at least one missing cell."));
    if (requireAnswers && missingCount !== data.correctAnswers.length) add(issue("correctAnswers", "legacy-answer-mismatch", `Missing cells (${missingCount}) must match canonical answers (${data.correctAnswers.length}).`));
    add(issue("answerMode", "legacy-mode", "Legacy value-entry behavior is preserved.", "warning"));
  }
  if (!Number.isInteger(data.maximumAttempts) || data.maximumAttempts < 1) add(issue("maximumAttempts", "invalid-maximum-attempts", "Maximum attempts must be at least 1."));
  if (options.requireRuleExplanation !== false && !data.ruleExplanation.trim()) add(issue("ruleExplanation", "missing-rule-explanation", "Rule explanation is required."));
  const ruleIds = new Set<string>();
  data.rules.forEach((rule, index) => {
    if (!rule.id) add(issue(`rules.${index}.id`, "missing-rule-id", "Every rule needs a stable ID."));
    else if (ruleIds.has(rule.id)) add(issue(`rules.${index}.id`, "duplicate-rule-id", `Duplicate rule ID "${rule.id}".`));
    ruleIds.add(rule.id);
    if (!isRuleType(rule.type)) add(issue(`rules.${index}.type`, "unsupported-rule", `Unsupported rule type "${String(rule.type)}".`));
    if (!rule.text.trim()) add(issue(`rules.${index}.text`, "missing-rule-text", "Rule text is required."));
    rule.relatedCellIds.forEach(id => { if (!ids.has(id)) add(issue(`rules.${index}.relatedCellIds`, "invalid-related-cell", `Related cell "${id}" does not exist.`)); });
    if (rule.unlock?.afterAttempts != null && (!Number.isInteger(rule.unlock.afterAttempts) || rule.unlock.afterAttempts < 1)) add(issue(`rules.${index}.unlock.afterAttempts`, "invalid-rule-unlock", "Rule unlock attempts must be a positive integer."));
  });
  Object.entries(data.legacyUnsupportedValues ?? {}).forEach(([path, value]) => add(issue(path, "unsupported-legacy-value", `Legacy value "${String(value)}" is unsupported and preserved for migration.`, "warning")));
  return { valid: errors.length === 0, errors, warnings, normalized: data };
}

export function createInitialGridlockState(data: Pick<GridlockPuzzleData, "answerMode" | "grid">, status: GridlockPlayerStatus = "ready"): GridlockPlayerState {
  const missingCount = data.grid.flat().filter(cell => cell.isMissing).length;
  return {
    status,
    answer: data.answerMode === "selection" ? { mode: "selection", cellIds: [] } : { mode: "value-entry", values: Array(missingCount).fill("") },
    elapsedMs: 0,
    attemptsUsed: 0,
    hintsUsed: [],
    completionPending: false,
    pendingSubmissionId: null,
    rulePanelOpen: false,
    focusedCellId: data.grid.flat()[0]?.id || null,
    message: "",
  };
}

export function applyGridlockSelection(state: GridlockPlayerState, data: GridlockPuzzleData, cellId: string): GridlockPlayerState {
  if (state.answer.mode !== "selection") return { ...state, message: "This puzzle uses value entry." };
  const cell = data.grid.flat().find(candidate => candidate.id === cellId);
  if (!cell) return { ...state, message: "That cell is not part of this puzzle." };
  if (cell.disabled || cell.locked) return { ...state, message: "That cell is locked." };
  const selected = state.answer.cellIds;
  if (selected.includes(cellId)) return { ...state, status: "playing", answer: { mode: "selection", cellIds: selected.filter(id => id !== cellId) }, message: `${cell.label} unselected.` };
  if (selected.length >= data.requiredSelections) return { ...state, message: `You can select only ${data.requiredSelections} cell${data.requiredSelections === 1 ? "" : "s"}.` };
  return { ...state, status: "playing", answer: { mode: "selection", cellIds: [...selected, cellId] }, message: `${cell.label} selected.` };
}

export function clearGridlockSelection(state: GridlockPlayerState): GridlockPlayerState {
  return {
    ...state,
    status: state.status === "won" ? "won" : "playing",
    answer: state.answer.mode === "selection" ? { mode: "selection", cellIds: [] } : { mode: "value-entry", values: state.answer.values.map(() => "") },
    completionPending: false,
    pendingSubmissionId: null,
    message: "Progress reset.",
  };
}

export function setGridlockValue(state: GridlockPlayerState, index: number, value: string): GridlockPlayerState {
  if (state.answer.mode !== "value-entry" || !Number.isInteger(index) || index < 0 || index >= state.answer.values.length) return state;
  const values = [...state.answer.values];
  values[index] = value;
  return { ...state, status: "playing", answer: { mode: "value-entry", values }, message: "" };
}

export function isGridlockStateComplete(state: GridlockPlayerState, data: GridlockPuzzleData): boolean {
  return state.answer.mode === "selection"
    ? state.answer.cellIds.length === data.requiredSelections
    : state.answer.values.length > 0 && state.answer.values.every(value => value.trim().length > 0);
}

export function gridlockAnswerValues(answer: GridlockAnswer): GridlockValue[] {
  return answer.mode === "selection" ? answer.cellIds : answer.values.map(value => value.trim());
}

export function validateGridlockSubmission(data: GridlockPuzzleData, payload: unknown): GridlockCompletionResult {
  const errors: GridlockValidationIssue[] = [];
  const record = isRecord(payload) ? payload : null;
  const answers = record && Array.isArray(record.answers) ? record.answers : null;
  if (!answers) return { valid: false, correct: false, correctCount: 0, requiredCount: data.correctAnswers.length, errors: [issue("answers", "missing-answers", "Submission must include an answers array.")] };
  if (answers.some(answer => typeof answer !== "string" && typeof answer !== "number")) errors.push(issue("answers", "invalid-answer-type", "Every submitted answer must be a string or number."));
  if (data.answerMode === "selection") {
    const ids = answers.filter((answer): answer is string => typeof answer === "string");
    const selectable = new Set(data.grid.flat().filter(cell => !cell.disabled && !cell.locked).map(cell => cell.id));
    if (ids.length !== answers.length || ids.some(id => !selectable.has(id))) errors.push(issue("answers", "invalid-cell-id", "Submission contains an invalid or locked cell ID."));
    if (new Set(ids).size !== ids.length) errors.push(issue("answers", "duplicate-cell-id", "Submitted cell IDs must be unique."));
    if (ids.length !== data.requiredSelections) errors.push(issue("answers", "invalid-answer-count", `Submit exactly ${data.requiredSelections} selections.`));
  } else if (answers.length !== data.correctAnswers.length) {
    errors.push(issue("answers", "invalid-answer-count", `Submit exactly ${data.correctAnswers.length} values.`));
  }
  if (errors.length) return { valid: false, correct: false, correctCount: 0, requiredCount: data.correctAnswers.length, errors };
  const canonical = data.answerMode === "selection" ? new Set(data.correctAnswers.map(String)) : null;
  const submitted = data.answerMode === "selection" ? new Set(answers.map(String)) : null;
  const correctCount = data.answerMode === "selection"
    ? [...submitted!].filter(value => canonical!.has(value)).length
    : data.correctAnswers.reduce<number>((count, answer, index) => count + (String(answer).trim().toUpperCase() === String(answers[index]).trim().toUpperCase() ? 1 : 0), 0);
  return { valid: true, correct: correctCount === data.correctAnswers.length && answers.length === data.correctAnswers.length, correctCount, requiredCount: data.correctAnswers.length, errors: [] };
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getGridlockPuzzleSignature(data: GridlockPuzzleData): string {
  const publicShape = {
    mode: data.answerMode,
    rows: data.rows,
    columns: data.columns,
    required: data.requiredSelections,
    cells: data.grid.flat().map(cell => [cell.id, cell.row, cell.column, cell.label, cell.disabled === true, cell.locked === true, cell.isMissing === true]),
    rules: data.rules.map(rule => [rule.id, rule.type, rule.text, rule.relatedCellIds, rule.displayOrder, rule.initiallyVisible, rule.unlock ?? null]),
  };
  return `g2-${stableHash(JSON.stringify(publicShape))}`;
}

export function serializeGridlockState(state: GridlockPlayerState, signature: string, savedAt = Date.now()): SerializedGridlockState {
  return {
    version: 1,
    signature,
    answer: state.answer.mode === "selection" ? { mode: "selection", cellIds: [...state.answer.cellIds] } : { mode: "value-entry", values: [...state.answer.values] },
    elapsedMs: Number.isFinite(state.elapsedMs) ? Math.max(0, state.elapsedMs) : 0,
    attemptsUsed: Number.isInteger(state.attemptsUsed) ? Math.max(0, state.attemptsUsed) : 0,
    hintsUsed: [...new Set(state.hintsUsed.filter(id => typeof id === "string"))],
    completionPending: state.completionPending === true,
    pendingSubmissionId: state.pendingSubmissionId,
    savedAt,
  };
}

export function restoreGridlockState(value: unknown, data: GridlockPuzzleData, signature = getGridlockPuzzleSignature(data)): GridlockPlayerState | null {
  if (!isRecord(value) || value.version !== 1 || value.signature !== signature || !isRecord(value.answer)) return null;
  if (typeof value.elapsedMs !== "number" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0) return null;
  if (!Number.isInteger(value.attemptsUsed) || Number(value.attemptsUsed) < 0 || !Array.isArray(value.hintsUsed) || value.hintsUsed.some(id => typeof id !== "string")) return null;
  const state = createInitialGridlockState(data, "playing");
  if (data.answerMode === "selection") {
    if (value.answer.mode !== "selection" || !Array.isArray(value.answer.cellIds) || value.answer.cellIds.some(id => typeof id !== "string")) return null;
    const selectable = new Set(data.grid.flat().filter(cell => !cell.disabled && !cell.locked).map(cell => cell.id));
    const selected = [...new Set(value.answer.cellIds as string[])].filter(id => selectable.has(id));
    if (selected.length > data.requiredSelections) return null;
    state.answer = { mode: "selection", cellIds: selected };
  } else {
    if (value.answer.mode !== "value-entry" || !Array.isArray(value.answer.values) || value.answer.values.some(entry => typeof entry !== "string")) return null;
    const missingCount = data.grid.flat().filter(cell => cell.isMissing).length;
    if (value.answer.values.length !== missingCount) return null;
    state.answer = { mode: "value-entry", values: [...value.answer.values] as string[] };
  }
  state.elapsedMs = value.elapsedMs;
  state.attemptsUsed = Number(value.attemptsUsed);
  state.hintsUsed = [...new Set(value.hintsUsed as string[])];
  state.completionPending = value.completionPending === true && isGridlockStateComplete(state, data);
  state.pendingSubmissionId = typeof value.pendingSubmissionId === "string" && value.pendingSubmissionId.trim()
    ? value.pendingSubmissionId
    : null;
  if (!state.completionPending) state.pendingSubmissionId = null;
  state.status = state.completionPending ? "completion-pending" : "playing";
  return state;
}

export function gridlockStorageKey(scope: GridlockPersistenceScope, puzzleId: string, dailyIdentity?: string | number): string | null {
  if (scope === "catalog") return `gridlock-progress:v1:catalog:${puzzleId}`;
  if (scope === "daily" && dailyIdentity != null && String(dailyIdentity).trim()) return `gridlock-progress:v1:daily:${String(dailyIdentity)}:${puzzleId}`;
  return null;
}

export function restoreGridlockProgress(options: {
  storage: GridlockStorageReader | null;
  scope: GridlockPersistenceScope;
  puzzleId: string;
  dailyIdentity?: string | number;
  data: GridlockPuzzleData;
}): GridlockPlayerState | null {
  const key = gridlockStorageKey(options.scope, options.puzzleId, options.dailyIdentity);
  if (!key || !options.storage) return null;
  let parsed: unknown;
  try { const raw = options.storage.getItem(key); parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  const restored = restoreGridlockState(parsed, options.data);
  if (!restored) { try { options.storage.removeItem(key); } catch {} }
  return restored;
}
