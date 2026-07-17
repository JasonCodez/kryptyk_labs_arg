// ─────────────────────────────────────────────────────────────────────────────
// Gridlock File Puzzle — shared types, parser, and answer validator
// Used by:
//   • API routes   src/app/api/puzzles/[id]/gridlock/state   (state GET)
//   •              src/app/api/puzzles/[id]/gridlock/submit  (answer POST)
//   • Component    src/components/puzzle/GridlockFilePuzzle.tsx
//
// DESIGN PRINCIPLE:
//   The correct ANSWER is always unambiguous. A player who finds the right
//   answer by any valid reasoning path is ALWAYS accepted. The Law Declaration
//   is purely cosmetic / bonus — it never blocks or penalises a correct answer.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GRIDLOCK_CORE_LIMITS,
  GRIDLOCK_SUPPORTED_RULE_AXES,
  GRIDLOCK_SUPPORTED_RULE_TYPES,
  normalizeGridlockData,
  validateGridlockData,
  validateGridlockSubmission,
} from './gridlockCore';

export type GridCellValue = string | number;

export type GridCell = {
  /** Legacy display value. New visual-builder cells also mirror label here. */
  value?: GridCellValue;
  /** Legacy value-entry marker. */
  isMissing?: boolean;
  /** Stable visual-builder identity. Generated deterministically for legacy cells. */
  id?: string;
  row?: number;
  column?: number;
  label?: string;
  description?: string;
  category?: string;
  icon?: string;
  disabled?: boolean;
  locked?: boolean;
  evidence?: string;
};

export const GRIDLOCK_SIZE_LIMITS = {
  ...GRIDLOCK_CORE_LIMITS,
  mobileComfortableCellSize: 44,
} as const;

export function getGridlockCellSize(columns: number, containerWidth: number): number {
  const safeColumns = Math.max(1, columns);
  const ideal = safeColumns <= 3 ? 84 : safeColumns <= 5 ? 68 : 54;
  const gap = 8;
  return containerWidth > 0
    ? Math.max(28, Math.min(ideal, Math.floor((containerWidth - gap * (safeColumns - 1)) / safeColumns)))
    : ideal;
}

// ── Grid types ────────────────────────────────────────────────────────────────

export type GridType =
  | 'letter'   // alphabet-based logic
  | 'number'   // mathematical / sequence logic
  | 'word'     // semantic / compound word logic
  | 'logic'    // constraint satisfaction
  | 'hybrid';  // mixed systems

// ── Law families (used for the optional Law Declaration bonus) ────────────────

export type RuleFamily =
  | 'arithmetic'
  | 'geometric'
  | 'fibonacci'
  | 'polynomial'
  | 'alphabetic'
  | 'compound-word'
  | 'constraint'
  | 'positional'
  | 'semantic'
  | 'hybrid';

export type RuleAxis =
  | 'rows'
  | 'columns'
  | 'both'
  | 'diagonal'
  | 'spiral'
  | 'cell-position';

export const GRIDLOCK_RULE_TYPES = [
  ...GRIDLOCK_SUPPORTED_RULE_TYPES,
] as const satisfies readonly RuleFamily[];

export const GRIDLOCK_RULE_TYPE_LABELS: Record<RuleFamily, string> = {
  arithmetic: 'Arithmetic (constant step)', geometric: 'Geometric (constant ratio)',
  fibonacci: 'Fibonacci / Recursive sum', polynomial: 'Polynomial / Power rule',
  alphabetic: 'Alphabetic position', 'compound-word': 'Compound word structure',
  constraint: 'Logical constraint', positional: 'Positional encoding',
  semantic: 'Semantic / Word meaning', hybrid: 'Hybrid (multiple systems)',
};

export const GRIDLOCK_RULE_AXES: readonly RuleAxis[] = GRIDLOCK_SUPPORTED_RULE_AXES;

export const GRIDLOCK_RULE_AXIS_LABELS: Record<RuleAxis, string> = {
  rows: 'Rows', columns: 'Columns', both: 'Both rows and columns', diagonal: 'Diagonal',
  spiral: 'Spiral / outward', 'cell-position': 'Cell position (row x column)',
};

export type GridlockRule = {
  id: string;
  type: RuleFamily;
  text: string;
  relatedCellIds?: string[];
  displayOrder: number;
  initiallyVisible: boolean;
  unlock?: { afterAttempts?: number; afterRuleId?: string };
};

export type GridlockValidationIssue = {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
};

export type GridlockValidationResult = {
  valid: boolean;
  errors: GridlockValidationIssue[];
  warnings: GridlockValidationIssue[];
};

// ── Hint ──────────────────────────────────────────────────────────────────────

export type GridlockHint = {
  id: string;
  /** What this hint reveals — never gives the answer, only an axis or property */
  text: string;
  /** Signal cost (in-puzzle currency) */
  cost: number;
};

// ── The full puzzle data shape (server-side, stored in puzzle.data.gridlockFile) ──

export type GridlockFileData = {
  schemaVersion?: 2;
  answerMode?: 'selection' | 'value-entry';
  fileNumber: number;
  fileTitle: string;
  /** One-line redacted-brief flavor text shown under the grid */
  flavorText: string;
  gridType: GridType;
  /** rows × cols grid. Missing cells have isMissing:true and value:'?' */
  grid: GridCell[][];
  /**
   * The canonical correct answer(s).
   * Single-missing: one string/number.
   * Multi-missing: array parallel to grid scan order (left→right, top→bottom).
   */
  correctAnswers: GridCellValue[];
  /**
   * Human-readable rule explanation — revealed AFTER the player solves.
   * Never shown before a correct submission.
   */
  ruleExplanation: string;
  /** The primary rule family — used to validate Law Declarations */
  primaryRuleFamily: RuleFamily;
  primaryRuleAxis: RuleAxis;
  /** Optional secondary rule (for multi-layer puzzles) */
  secondaryRuleFamily?: RuleFamily;
  secondaryRuleAxis?: RuleAxis;
  /** Optional hints the player can purchase */
  hints?: GridlockHint[];
  /**
   * Optional shadow rule note — revealed only to players who submit the
   * optional "Deep Analysis" description. Never affects scoring.
   */
  shadowRuleNote?: string;
  /** Optional meta-puzzle contribution: which character of the season key this answer maps to */
  seasonKeyIndex?: number;
  /** Free text shown after solve (declassified lore / meta note) */
  retentionUnlock?: string;
  /** Arc number (1–N) and day within arc (1–7) */
  arcNumber?: number;
  arcDay?: number;
  rows?: number;
  columns?: number;
  requiredSelections?: number;
  maximumAttempts?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';
  objective?: string;
  rules?: GridlockRule[];
  rewardSettings?: { points?: number; xp?: number; [key: string]: unknown };
  legacyUnsupportedValues?: Record<string, unknown>;
};

// ── Client-safe shape (secrets stripped) ─────────────────────────────────────

export type GridlockFileClientData = Omit<
  GridlockFileData,
  'correctAnswers' | 'shadowRuleNote' | 'seasonKeyIndex' | 'ruleExplanation' |
  'primaryRuleFamily' | 'primaryRuleAxis' | 'secondaryRuleFamily' | 'secondaryRuleAxis' |
  'retentionUnlock' | 'rewardSettings' | 'legacyUnsupportedValues'
>;

export const DEFAULT_GRIDLOCK_FILE_TEMPLATE: GridlockFileData = {
  fileNumber: 1,
  fileTitle: 'The Multiplication Alphabet',
  flavorText:
    'A 4x4 cipher matrix recovered from a decommissioned terminal. Rows and columns appear to encode something alphabetical.',
  gridType: 'letter',
  grid: [
    [{ value: 'A' }, { value: 'B' }, { value: 'C' }, { value: 'D' }],
    [{ value: 'B' }, { value: 'D' }, { value: 'F' }, { value: 'H' }],
    [{ value: 'C' }, { value: 'F' }, { value: 'I' }, { value: 'L' }],
    [{ value: 'D' }, { value: 'H' }, { value: 'L' }, { value: 'P', isMissing: true }],
  ],
  correctAnswers: ['P'],
  ruleExplanation:
    'Cell(row, col) = the letter at position row*col in the alphabet (A=1). Row 4, Col 4 = 16 = P.',
  primaryRuleFamily: 'alphabetic',
  primaryRuleAxis: 'cell-position',
  hints: [
    {
      id: 'H1',
      text: 'The top-left cell is A. The position in the alphabet equals the product of its row and column numbers.',
      cost: 1,
    },
    {
      id: 'H2',
      text: 'Row 4, Col 4 = 4*4 = 16. What is the 16th letter of the alphabet?',
      cost: 1,
    },
  ],
  retentionUnlock:
    'TRANSMISSION LOG - TERMINAL 04\n\nThis encoding scheme was used to map memory addresses to register labels in early assembly systems. Each register\'s name encoded its position in the execution pipeline.',
};

export function createDefaultGridlockFileData(): GridlockFileData {
  const clone = JSON.parse(JSON.stringify(DEFAULT_GRIDLOCK_FILE_TEMPLATE)) as GridlockFileData;
  return normalizeGridlockFileData(clone) ?? clone;
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function createGridlockCellId(row: number, column: number): string {
  return `cell-r${row + 1}-c${column + 1}`;
}

export function normalizeGridlockFileData(puzzleData: unknown): GridlockFileData | null {
  return normalizeGridlockData(puzzleData) as unknown as GridlockFileData | null;
}

export function validateGridlockFileData(puzzleData: unknown): GridlockValidationResult {
  const result = validateGridlockData(puzzleData);
  return { valid: result.valid, errors: result.errors, warnings: result.warnings };
}

export function getGridlockFileData(puzzleData: unknown): GridlockFileData | null {
  const normalized = normalizeGridlockFileData(puzzleData);
  return normalized && validateGridlockFileData(normalized).valid ? normalized : null;
}

// ── Sanitiser ──────────────────────────────────────────────────────────────────

export function sanitizeGridlockForClient(data: GridlockFileData): GridlockFileClientData {
  const grid = data.grid.map(row => row.map(cell => {
    const { isMissing, ...safe } = cell;
    return data.answerMode === 'value-entry' && isMissing ? { ...safe, isMissing: true } : safe;
  }));
  return {
    schemaVersion: data.schemaVersion,
    answerMode: data.answerMode,
    fileNumber: data.fileNumber,
    fileTitle: data.fileTitle,
    flavorText: data.flavorText,
    objective: data.objective,
    gridType: data.gridType,
    grid,
    hints: data.hints,
    arcNumber: data.arcNumber,
    arcDay: data.arcDay,
    rows: data.rows,
    columns: data.columns,
    requiredSelections: data.requiredSelections,
    maximumAttempts: data.maximumAttempts,
    difficulty: data.difficulty,
    rules: data.rules?.filter(rule => rule.initiallyVisible).map(rule => ({ ...rule, unlock: undefined })),
  };
}

// ── Answer validator ──────────────────────────────────────────────────────────

export type AnswerResult = {
  correct: boolean;
  /** How many of the missing cells were answered correctly */
  correctCount: number;
  totalMissing: number;
};

export function validateGridlockAnswer(
  data: GridlockFileData,
  submittedAnswers: GridCellValue[],
): AnswerResult {
  const result = validateGridlockSubmission(
    data as unknown as Parameters<typeof validateGridlockSubmission>[0],
    { answers: submittedAnswers },
  );
  return { correct: result.valid && result.correct, correctCount: result.correctCount, totalMissing: result.requiredCount };
}

// ── Law Declaration validator (BONUS ONLY — never blocks a correct answer) ────

export type LawDeclarationResult =
  | 'confirmed'   // matches primary rule exactly
  | 'alternate'   // matches secondary rule (also valid)
  | 'partial'     // one of the two components correct
  | 'incorrect';  // both components wrong

export function validateLawDeclaration(
  data: GridlockFileData,
  declaredFamily: RuleFamily,
  declaredAxis: RuleAxis,
): LawDeclarationResult {
  const familyMatch = declaredFamily === data.primaryRuleFamily;
  const axisMatch = declaredAxis === data.primaryRuleAxis;

  if (familyMatch && axisMatch) return 'confirmed';

  // Accept secondary rule as equally valid
  if (
    data.secondaryRuleFamily &&
    data.secondaryRuleAxis &&
    declaredFamily === data.secondaryRuleFamily &&
    declaredAxis === data.secondaryRuleAxis
  ) {
    return 'alternate';
  }

  if (familyMatch || axisMatch) return 'partial';
  return 'incorrect';
}

// ── Rank calculator ───────────────────────────────────────────────────────────

export type GridlockRank = 'S' | 'A' | 'B' | 'C' | 'F';

export function calcGridlockRank(
  attemptCount: number,
  hintsUsed: number,
): GridlockRank {
  if (attemptCount === 1 && hintsUsed === 0) return 'S';
  if (attemptCount === 1) return 'A';
  if (attemptCount === 2) return 'A';
  if (attemptCount <= 4) return 'B';
  if (attemptCount <= 7) return 'C';
  return 'F';
}

export const GRIDLOCK_RANK_LABELS: Record<GridlockRank, string> = {
  S: 'PATTERN MASTER',
  A: 'SENIOR ANALYST',
  B: 'FIELD ANALYST',
  C: 'JUNIOR ANALYST',
  F: 'FILE OPEN',
};

export const GRIDLOCK_RANK_COLORS: Record<GridlockRank, string> = {
  S: '#FFD700',
  A: '#7DF9AA',
  B: '#60CFFF',
  C: '#C0C0C0',
  F: '#FF6060',
};

// ── Sample week data (verified correct) ───────────────────────────────────────
// These are the 7 starter puzzles. Admins seed them via the admin panel.

export const SAMPLE_WEEK: GridlockFileData[] = [
  // ── DAY 1 — The Multiplication Alphabet ────────────────────────────────────
  {
    fileNumber: 1,
    fileTitle: 'The Multiplication Alphabet',
    flavorText: 'SIGNAL INTERCEPT — Transmission encoded. Decode the positional cipher to recover the missing value.',
    gridType: 'letter',
    grid: [
      [{value:'A'},{value:'B'},{value:'C'},{value:'D'}],
      [{value:'B'},{value:'D'},{value:'F'},{value:'H'}],
      [{value:'C'},{value:'F'},{value:'I'},{value:'L'}],
      [{value:'D'},{value:'H'},{value:'L'},{value:'?',isMissing:true}],
    ],
    correctAnswers: ['P'],
    ruleExplanation: 'Cell(row, col) = the letter at alphabetical position (row × col). A=1, B=2 … Z=26. Row 4, Col 4 = 4×4 = 16 = P.',
    primaryRuleFamily: 'positional',
    primaryRuleAxis: 'both',
    hints: [
      { id:'h1', text:'Each cell encodes a number. Try converting the letters to their alphabet positions.', cost: 1 },
      { id:'h2', text:'Look at the top-left 2×2 block. A=1, B=2, D=4. What operation connects row/column position to cell position?', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 1,
    retentionUnlock: 'The grid is a multiplication table wearing the alphabet as a disguise. Every grid in this sequence hides a familiar structure behind an unfamiliar encoding.',
  },

  // ── DAY 2 — The Fibonacci Tile ─────────────────────────────────────────────
  {
    fileNumber: 2,
    fileTitle: 'The Fibonacci Tile',
    flavorText: 'STRUCTURAL ANALYSIS — Pattern repeats across both axes. Find the missing cell value.',
    gridType: 'number',
    grid: [
      [{value:1},{value:1},{value:2},{value:3}],
      [{value:1},{value:2},{value:3},{value:5}],
      [{value:2},{value:3},{value:5},{value:8}],
      [{value:3},{value:5},{value:8},{value:'?',isMissing:true}],
    ],
    correctAnswers: [13],
    ruleExplanation: 'Every row is a Fibonacci sequence (each value = sum of the two before it). Every column is also a Fibonacci sequence. Both axes independently confirm the answer: 8 + 5 = 13.',
    primaryRuleFamily: 'fibonacci',
    primaryRuleAxis: 'both',
    secondaryRuleFamily: 'fibonacci',
    secondaryRuleAxis: 'columns',
    hints: [
      { id:'h1', text:'In the top row: 1, 1, 2, 3. What is the relationship between any three consecutive values?', cost: 1 },
      { id:'h2', text:'The same rule that works across each row also works down each column.', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 2,
  },

  // ── DAY 3 — The Compound Cross ─────────────────────────────────────────────
  // All 9 words are verified real dictionary compounds.
  // ? = MOONBEAM — everyone knows this word, unambiguous.
  {
    fileNumber: 3,
    fileTitle: 'The Compound Cross',
    flavorText: 'LEXICAL ANALYSIS — Each cell is a compound. The hidden components govern rows and columns.',
    gridType: 'word',
    grid: [
      [{value:'SUNLIGHT'},{value:'SUNBEAM'},{value:'SUNSHINE'}],
      [{value:'MOONLIGHT'},{value:'?',isMissing:true},{value:'MOONSHINE'}],
      [{value:'STARLIGHT'},{value:'STARBEAM'},{value:'STARSHINE'}],
    ],
    correctAnswers: ['MOONBEAM'],
    ruleExplanation: 'Each row uses a sky-body prefix (SUN / MOON / STAR). Each column uses a light-quality suffix (LIGHT / BEAM / SHINE). Every cell = row-prefix + column-suffix. Row 2, Col 2 = MOON + BEAM = MOONBEAM.',
    primaryRuleFamily: 'compound-word',
    primaryRuleAxis: 'both',
    hints: [
      { id:'h1', text:'Every cell is a compound word. Examine what the three cells in Row 1 have in common.', cost: 1 },
      { id:'h2', text:'The first part of every word in a row is the same. The second part of every word in a column is the same.', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 3,
    retentionUnlock: 'Note: this grid has eight fully valid compound words visible. The missing cell is uniquely determined by both the row rule and the column rule simultaneously.',
  },

  // ── DAY 4 — The Anomaly ────────────────────────────────────────────────────
  // Surface rule (cubes + row constant) → 30.
  // Deep rule (cubes + triangular numbers) also → 30 AND explains WHY the offsets are 0,1,3.
  // Player gets 30 either way. Law Declaration accepts either description.
  {
    fileNumber: 4,
    fileTitle: 'The Anomaly',
    flavorText: 'DEVIATION DETECTED — The pattern looks familiar. Look again at the offsets.',
    gridType: 'number',
    grid: [
      [{value:1},{value:8},{value:27}],
      [{value:2},{value:9},{value:28}],
      [{value:4},{value:11},{value:'?',isMissing:true}],
    ],
    correctAnswers: [30],
    ruleExplanation: 'Column values are the cubes of the column index: 1³=1, 2³=8, 3³=27. Each row adds a triangular number offset: Row 1 adds T(0)=0, Row 2 adds T(1)=1, Row 3 adds T(2)=3. T(n)=n(n+1)/2. Answer: 3³ + T(2) = 27 + 3 = 30. The "obvious" surface reading (row 3 adds 3 to each cube) also gives 30 and is accepted.',
    primaryRuleFamily: 'polynomial',
    primaryRuleAxis: 'columns',
    secondaryRuleFamily: 'arithmetic',
    secondaryRuleAxis: 'rows',
    hints: [
      { id:'h1', text:'Look at Column 3: 27, 28, ?. The values are close to perfect cubes. How close?', cost: 1 },
      { id:'h2', text:'Row 1 adds 0 to the cubes. Row 2 adds 1. Row 3 adds 3. These increments (0, 1, 3) are themselves a named sequence.', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 4,
    shadowRuleNote: 'The row offsets 0, 1, 3 are the triangular numbers T(0), T(1), T(2). Row 4 (if it existed) would add T(3)=6, giving 1+6=7, 8+6=14, 27+6=33.',
    retentionUnlock: 'Note: this grid contains a secondary pattern in the row offsets not required for the answer. Sharp analysts will find it.',
  },

  // ── DAY 5 — The Three Languages ───────────────────────────────────────────
  // Three columns encode the SAME value (n²) in three different systems.
  // ? = D (4th letter = 2² = 4). Unambiguous, clean, verified.
  {
    fileNumber: 5,
    fileTitle: 'The Three Languages',
    flavorText: 'MULTI-CHANNEL SIGNAL — Three encodings. One underlying value. Crack all three channels.',
    gridType: 'hybrid',
    grid: [
      [{value:'ONCE'},{value:'A'},{value:1}],
      [{value:'TWICE'},{value:'?',isMissing:true},{value:4}],
      [{value:'THRICE'},{value:'I'},{value:9}],
    ],
    correctAnswers: ['D'],
    ruleExplanation: 'Each row encodes the same number in three systems. Column 1: Latin multiplier (ONCE=1, TWICE=2, THRICE=3). Column 2: the letter at alphabetical position n² (A=1st, D=4th, I=9th). Column 3: the number n² itself (1, 4, 9). Row 2 encodes 2: TWICE = 2, n²=4, letter at position 4 = D.',
    primaryRuleFamily: 'hybrid',
    primaryRuleAxis: 'rows',
    hints: [
      { id:'h1', text:'Column 3 contains 1, 4, 9. What mathematical sequence is this?', cost: 1 },
      { id:'h2', text:'Column 2 contains A (1st letter) and I (9th letter). The numbers 1 and 9 also appear in Column 3. What connects the letter position to the number?', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 5,
  },

  // ── DAY 6 — The Hidden Axis ────────────────────────────────────────────────
  // Verified: B E H K N / E I M Q U / H M R W B. Both row and column rules →B.
  {
    fileNumber: 6,
    fileTitle: 'The Hidden Axis',
    flavorText: 'ENCRYPTED TRANSMISSION — The step is not constant. It is itself a pattern.',
    gridType: 'letter',
    grid: [
      [{value:'B'},{value:'E'},{value:'H'},{value:'K'},{value:'N'}],
      [{value:'E'},{value:'I'},{value:'M'},{value:'Q'},{value:'U'}],
      [{value:'H'},{value:'M'},{value:'R'},{value:'W'},{value:'?',isMissing:true}],
    ],
    correctAnswers: ['B'],
    ruleExplanation: 'Row 1 advances by +3 (B E H K N). Row 2 advances by +4 (E I M Q U). Row 3 advances by +5 (H M R W ?). The alphabet wraps at Z→A. Row 3, position 5: W(23) + 5 = 28 → 28 mod 26 = 2 = B. Columns also advance with increasing steps: Col 1 step=3, Col 2 step=4, Col 3 step=5, Col 4 step=6, Col 5 step=7 — confirming B.',
    primaryRuleFamily: 'arithmetic',
    primaryRuleAxis: 'rows',
    secondaryRuleFamily: 'arithmetic',
    secondaryRuleAxis: 'columns',
    hints: [
      { id:'h1', text:'Look at Row 1: B, E, H, K, N. The letters advance by the same amount each step. What is that step?', cost: 1 },
      { id:'h2', text:'Row 1 step = 3. Row 2 step = 4. What is Row 3\'s step? And does the alphabet wrap around at Z?', cost: 2 },
    ],
    arcNumber: 1,
    arcDay: 6,
    shadowRuleNote: 'The starting letters of each row (B=2, E=5, H=8) also advance by +3 — the same step as Row 1. The step-of-steps is itself the step of Row 1.',
  },

  // ── DAY 7 — Arc Capstone: Six Frequencies ─────────────────────────────────
  // Each row uses the rule from one of days 1-6.
  // Players who solved all prior days have an implicit advantage.
  {
    fileNumber: 7,
    fileTitle: 'Six Frequencies',
    flavorText: 'ARC CAPSTONE — Six rows. Each row operates on a different frequency. You have heard them all before.',
    gridType: 'hybrid',
    grid: [
      // Row 1: Day 1 rule (mult×alphabet). Showing row 3 of the multiplication grid: C F I L ?  (cols 1-5, row3 of the mult table)
      [{value:'C'},{value:'F'},{value:'I'},{value:'L'},{value:'?',isMissing:true}],
      // Row 2: Day 2 rule (Fibonacci). 5 8 13 ? 34
      [{value:5},{value:8},{value:13},{value:'?',isMissing:true},{value:34}],
      // Row 3: Day 3 rule (compound word prefix MOON). MOONLIGHT MOONBEAM ? (suffix col3=SHINE)
      [{value:'MOONLIGHT'},{value:'MOONBEAM'},{value:'?',isMissing:true}],
      // Row 4: Day 4 rule (cubes+triangular, show row 3). 4 11 ?
      [{value:4},{value:11},{value:'?',isMissing:true}],
      // Row 5: Day 5 rule (three languages, show row2). TWICE ? 4
      [{value:'TWICE'},{value:'?',isMissing:true},{value:4}],
      // Row 6: Day 6 rule (alphabet arithmetic, row4 of the day6 grid: K Q W ? I). Step=6
      [{value:'K'},{value:'Q'},{value:'W'},{value:'?',isMissing:true},{value:'I'}],
    ],
    // correctAnswers in grid scan order (left→right, top→bottom):
    correctAnswers: ['O', 21, 'MOONSHINE', 30, 'D', 'C'],
    ruleExplanation: [
      'Row 1 (Frequency 1): Multiplication table × alphabet. Row 3, Col 5 = 3×5=15 = O.',
      'Row 2 (Frequency 2): Fibonacci sequence. 5,8,13,?,34 — missing value: 13+8=21.',
      'Row 3 (Frequency 3): Compound word grid. MOON prefix + SHINE suffix = MOONSHINE.',
      'Row 4 (Frequency 4): Cubes + triangular offset. 4=1³+T(2), 11=2³+T(2) — Row 3 of the Day 4 grid. Answer: 3³+T(2)=27+3=30.',
      'Row 5 (Frequency 5): Three languages of squares. TWICE=2, n²=4, letter at position 4 = D.',
      'Row 6 (Frequency 6): Alphabet arithmetic, step=6. K(11) Q(17) W(23) ?(29→3=C) I(9).',
    ].join(' | '),
    primaryRuleFamily: 'hybrid',
    primaryRuleAxis: 'rows',
    hints: [
      { id:'h1', text:'Each row uses a completely different rule. You have seen every one of these rules in this arc.', cost: 1 },
      { id:'h2', text:'Row 1 contains letters increasing by consistent gaps. Row 2 contains numbers where each equals the sum of the two before it.', cost: 2 },
      { id:'h3', text:'Row 3 is a compound word. Row 4 follows the cube pattern with an offset. Row 5 uses three different encodings of the same value. Row 6 is an alphabet sequence that wraps past Z.', cost: 3 },
    ],
    arcNumber: 1,
    arcDay: 7,
    retentionUnlock: 'ARC 1 COMPLETE. The six frequencies were: positional cipher, recursive sum, lexical compound, polynomial offset, multi-encoding, and arithmetic modular. Arc 2 begins tomorrow. The rules will not stay the same.',
  },
];

/** Canonical seed entry point; seed scripts should never persist SAMPLE_WEEK directly. */
export function getNormalizedGridlockSeedData(): GridlockFileData[] {
  return SAMPLE_WEEK.map((entry, index) => {
    const normalized = normalizeGridlockFileData(entry);
    const validation = validateGridlockFileData(normalized);
    if (!normalized || !validation.valid) {
      throw new Error(`Gridlock seed ${index + 1} is invalid: ${validation.errors.map(issue => issue.message).join(' ')}`);
    }
    return normalized;
  });
}
