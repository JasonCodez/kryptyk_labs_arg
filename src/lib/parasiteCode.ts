// ─────────────────────────────────────────────────────────────────────────────
// Parasite Code Puzzle — shared types, parser, and quarantine validator
// Used by:
//   • API routes   src/app/api/puzzles/[id]/parasite/state   (state GET)
//   •              src/app/api/puzzles/[id]/parasite/submit  (quarantine POST)
//   • Component    src/components/puzzle/ParasiteCodePuzzle.tsx
// ─────────────────────────────────────────────────────────────────────────────

export type Opcode =
  | 'SET'   // SET <reg> <value>         — assign a value to a register
  | 'ADD'   // ADD <reg> <a> <b>         — reg = a + b
  | 'SUB'   // SUB <reg> <a> <b>         — reg = a - b
  | 'MUL'   // MUL <reg> <a> <b>         — reg = a * b
  | 'CMP'   // CMP <a> <b>               — compare: sets FLAG register
  | 'IF'    // IF FLAG <op> <val>        — conditional; skips next line if false
  | 'GOTO'  // GOTO <label>              — unconditional jump
  | 'CALL'  // CALL <label>              — call a subroutine
  | 'RET'   // RET                       — return from subroutine
  | 'LOAD'  // LOAD <reg> <key>          — load from input map
  | 'OUT'   // OUT <reg>                 — emit output value
  | 'HALT'; // HALT                      — stop execution

export const OPCODE_DESCRIPTIONS: Record<Opcode, string> = {
  SET:  'Assign a literal value to a register',
  ADD:  'Add two values into a register',
  SUB:  'Subtract one value from another into a register',
  MUL:  'Multiply two values into a register',
  CMP:  'Compare two values; result stored in FLAG',
  IF:   'Conditional branch: skip next line if condition is false',
  GOTO: 'Unconditional jump to a labeled line',
  CALL: 'Call a named subroutine',
  RET:  'Return to the call site',
  LOAD: 'Load a value from the test input map',
  OUT:  'Emit the current value of a register as output',
  HALT: 'Stop execution',
};

export type ProgramLine = {
  id: string;                  // e.g. "L01", "L02" — the IDs players quarantine
  lineNumber: number;          // 1-based display number
  opcode: Opcode;
  operands: string[];
  comment?: string;            // inline comment visible to player
  /** Server-only — stripped before sending to client */
  isParasite?: boolean;
};

export type TestInput = {
  id: string;
  label: string;               // e.g. "Normal invoice — Amount: $450"
  values: Record<string, string | number>;
  expectedOutput: string;      // what the legitimate program should produce
  activatesParasite: boolean;  // true = this input triggers the malicious branch
};

export type ClientTestInput = Omit<TestInput, 'activatesParasite'>;

export type StrainFamily =
  | 'timing-parasite'
  | 'input-triggered-sleeper'
  | 'obfuscated-redirect'
  | 'logic-bomb'
  | 'data-exfil'
  | 'privilege-escalation'
  | 'output-manipulator'
  | 'persistence-hook'
  | 'covert-channel';

export const STRAIN_DESCRIPTIONS: Record<StrainFamily, string> = {
  'timing-parasite':        'Activates based on date/time thresholds',
  'input-triggered-sleeper':'Dormant until specific input values are seen',
  'obfuscated-redirect':    'Redirects output to an alias or hidden register',
  'logic-bomb':             'Triggered by a specific logical state in the program',
  'data-exfil':             'Silently copies data to a secondary output channel',
  'privilege-escalation':   'Elevates an internal permission flag during normal execution',
  'output-manipulator':     'Subtly alters numeric or string output values',
  'persistence-hook':       'Injects a hook that persists across program restarts',
  'covert-channel':         'Uses a legitimate instruction sequence to signal externally',
};

export type ParasiteCodeCase = {
  caseTitle: string;
  programName: string;         // e.g. "payroll_v4.prg"
  contextNarrative: string;    // backstory shown on the briefing screen
  strainFamily: StrainFamily;
  activationCondition: string; // revealed AFTER the player solves: describes when it triggers
  program: ProgramLine[];
  parasiteLineIds: string[];   // canonical answer — STRIPPED before client
  testInputs: TestInput[];
  retentionUnlock?: string;    // revealed after solve: declassified note / lore
};

/** Shape sent to the browser: secrets removed */
export type ParasiteCodeClientCase = {
  caseTitle: string;
  programName: string;
  contextNarrative: string;
  strainFamily: StrainFamily;
  program: Omit<ProgramLine, 'isParasite'>[];
  testInputs: ClientTestInput[];
};

const FALLBACK_PARASITE_CODE_CASE: ParasiteCodeCase = {
  caseTitle: 'The Refund Siphon',
  programName: 'refund_router_v2.prg',
  contextNarrative:
    'Customer success reported that a handful of VIP refunds are settling a little short, but only on larger payouts. The service logs look normal, and the code review history shows no recent feature work in the refund path. You have the runtime cases and the source snapshot. Find the lines that siphon money out of the payout calculation.',
  strainFamily: 'input-triggered-sleeper',
  activationCondition: 'Triggers when TIER equals "VIP" and AMOUNT exceeds 500',
  parasiteLineIds: ['L10', 'L11'],
  program: [
    { id: 'L01', lineNumber: 1, opcode: 'LOAD', operands: ['R0', 'TIER'], comment: 'load customer tier' },
    { id: 'L02', lineNumber: 2, opcode: 'LOAD', operands: ['R1', 'AMOUNT'], comment: 'load requested refund amount' },
    { id: 'L03', lineNumber: 3, opcode: 'SET', operands: ['R2', '0.02'], comment: 'standard processing fee rate' },
    { id: 'L04', lineNumber: 4, opcode: 'MUL', operands: ['R3', 'R1', 'R2'], comment: 'R3 = standard fee' },
    { id: 'L05', lineNumber: 5, opcode: 'SET', operands: ['R4', 'VIP'], comment: '' },
    { id: 'L06', lineNumber: 6, opcode: 'CMP', operands: ['R0', 'R4'], comment: 'FLAG = tier is VIP' },
    { id: 'L07', lineNumber: 7, opcode: 'IF', operands: ['FLAG', '==', '1'], comment: 'VIP refunds waive the fee' },
    { id: 'L08', lineNumber: 8, opcode: 'SET', operands: ['R3', '0'], comment: '' },
    { id: 'L09', lineNumber: 9, opcode: 'IF', operands: ['R1', '>', '500'], comment: 'high-value branch' },
    { id: 'L10', lineNumber: 10, opcode: 'SET', operands: ['R5', '12.5'], comment: '', isParasite: true },
    { id: 'L11', lineNumber: 11, opcode: 'ADD', operands: ['R3', 'R3', 'R5'], comment: '', isParasite: true },
    { id: 'L12', lineNumber: 12, opcode: 'SUB', operands: ['R6', 'R1', 'R3'], comment: 'R6 = payout after fee adjustments' },
    { id: 'L13', lineNumber: 13, opcode: 'OUT', operands: ['R6'], comment: 'emit refund payout' },
    { id: 'L14', lineNumber: 14, opcode: 'HALT', operands: [], comment: '' },
  ],
  testInputs: [
    {
      id: 'T1',
      label: 'Standard customer refund - Tier: STANDARD, Amount: 250',
      values: { TIER: 'STANDARD', AMOUNT: 250 },
      expectedOutput: '245',
      activatesParasite: false,
    },
    {
      id: 'T2',
      label: 'VIP goodwill refund - Tier: VIP, Amount: 120',
      values: { TIER: 'VIP', AMOUNT: 120 },
      expectedOutput: '120',
      activatesParasite: false,
    },
    {
      id: 'T3',
      label: 'VIP escalation refund - Tier: VIP, Amount: 900',
      values: { TIER: 'VIP', AMOUNT: 900 },
      expectedOutput: '900',
      activatesParasite: true,
    },
  ],
  retentionUnlock:
    'INCIDENT NOTES - CASE RF-118\n\nThe extra fee was routed into a dormant ledger bucket that reconciled to a third-party settlement account every Friday night. The ledger name matched an abandoned migration artifact, which is why dashboards treated it as harmless noise.\n\nAccess keys rotated. Finance and platform security notified.',
};

export function createFallbackParasiteCodeCase(caseTitle?: string): ParasiteCodeCase {
  const fallback = JSON.parse(JSON.stringify(FALLBACK_PARASITE_CODE_CASE)) as ParasiteCodeCase;
  if (typeof caseTitle === 'string' && caseTitle.trim()) {
    fallback.caseTitle = caseTitle.trim();
  }
  return fallback;
}

function isValidParasiteCaseShape(c: Record<string, unknown>): boolean {
  return (
    typeof c.caseTitle === 'string' &&
    typeof c.programName === 'string' &&
    typeof c.contextNarrative === 'string' &&
    typeof c.strainFamily === 'string' &&
    typeof c.activationCondition === 'string' &&
    Array.isArray(c.program) &&
    Array.isArray(c.parasiteLineIds) &&
    Array.isArray(c.testInputs)
  );
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function getParasiteCodeData(puzzleData: unknown): ParasiteCodeCase | null {
  if (!puzzleData || typeof puzzleData !== 'object') return null;
  const d = puzzleData as Record<string, unknown>;

  // Supports both the canonical shape { parasiteCode: {...} } and a direct case object.
  const nested = d.parasiteCode;
  if (nested && typeof nested === 'object' && isValidParasiteCaseShape(nested as Record<string, unknown>)) {
    return nested as ParasiteCodeCase;
  }

  if (isValidParasiteCaseShape(d)) {
    return d as unknown as ParasiteCodeCase;
  }

  return null;
}

// ── Sanitizer ─────────────────────────────────────────────────────────────────

export function sanitizeParasiteForClient(data: ParasiteCodeCase): ParasiteCodeClientCase {
  return {
    caseTitle: data.caseTitle,
    programName: data.programName,
    contextNarrative: data.contextNarrative,
    strainFamily: data.strainFamily,
    program: data.program.map(({ isParasite: _dropped, ...rest }) => rest),
    testInputs: data.testInputs.map(({ activatesParasite: _hidden, ...rest }) => rest),
  };
}

// ── Validator ─────────────────────────────────────────────────────────────────

export type QuarantineFeedback =
  | 'exact'           // perfect match
  | 'over-flagged'    // correct lines included + extras
  | 'under-flagged'   // subset of correct lines, nothing wrong
  | 'off';            // at least one wrong line in the submission

export type QuarantineResult = {
  correct: boolean;
  feedback: QuarantineFeedback;
  /** How many of the parasite lines the player found (0–n) */
  foundCount: number;
  totalParasiteCount: number;
};

export function validateQuarantine(
  data: ParasiteCodeCase,
  submittedIds: string[],
): QuarantineResult {
  const canonical = new Set(data.parasiteLineIds);
  const submitted = new Set(submittedIds);

  const correct = canonical.size === submitted.size &&
    [...canonical].every(id => submitted.has(id));

  if (correct) {
    return { correct: true, feedback: 'exact', foundCount: canonical.size, totalParasiteCount: canonical.size };
  }

  const foundCount = [...canonical].filter(id => submitted.has(id)).length;
  const hasWrongLine = [...submitted].some(id => !canonical.has(id));

  let feedback: QuarantineFeedback;
  if (!hasWrongLine && foundCount < canonical.size) {
    feedback = 'under-flagged';       // only genuine parasite lines, but incomplete
  } else if (!hasWrongLine && foundCount === canonical.size) {
    feedback = 'over-flagged';        // all correct + extras (shouldn't happen — but guard anyway)
  } else if (hasWrongLine && foundCount === canonical.size) {
    feedback = 'over-flagged';        // all correct plus false positives
  } else {
    feedback = 'off';                 // at least one wrong line and/or missing parasite lines
  }

  return { correct: false, feedback, foundCount, totalParasiteCount: canonical.size };
}

// ── Rank calculator ───────────────────────────────────────────────────────────

export type Rank = 'S' | 'A' | 'B' | 'C' | 'F';

export function calcRank(submissionCount: number): Rank {
  if (submissionCount === 1) return 'S';
  if (submissionCount === 2) return 'A';
  if (submissionCount <= 4) return 'B';
  if (submissionCount <= 7) return 'C';
  return 'F';
}

export const RANK_LABELS: Record<Rank, string> = {
  S: 'ANALYST ELITE',
  A: 'SENIOR ANALYST',
  B: 'FIELD ANALYST',
  C: 'JUNIOR ANALYST',
  F: 'CASE OPEN',
};

export const RANK_COLORS: Record<Rank, string> = {
  S: '#FFD700',
  A: '#7DF9AA',
  B: '#60CFFF',
  C: '#C0C0C0',
  F: '#FF6060',
};
