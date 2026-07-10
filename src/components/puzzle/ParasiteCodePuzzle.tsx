'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ParasiteCodeClientCase,
  QuarantineFeedback,
  Rank,
  StrainFamily,
} from '@/lib/parasiteCode';
import { RANK_LABELS, RANK_COLORS, STRAIN_DESCRIPTIONS, OPCODE_DESCRIPTIONS } from '@/lib/parasiteCode';

// ── Props ─────────────────────────────────────────────────────────────────────
interface ParasiteCodePuzzleProps {
  puzzleId: string;
  onSolved: () => void;
}

// ── Server state shape ────────────────────────────────────────────────────────
interface ServerState {
  puzzle: ParasiteCodeClientCase;
  solved: boolean;
  solvedAt: string | null;
  submissionCount: number;
  rank: Rank;
  lastFeedback: QuarantineFeedback | null;
  activationCondition: string | null;
  retentionUnlock: string | null;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  locked: boolean;
}

// ── Submit result shape ───────────────────────────────────────────────────────
interface SubmitResult {
  correct: boolean;
  feedback: QuarantineFeedback;
  foundCount: number;
  totalParasiteCount: number;
  submissionCount: number;
  rank: Rank;
  activationCondition?: string;
  retentionUnlock?: string | null;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  maxAttempts?: number;
  locked?: boolean;
}

// ── Opcode color map ─────────────────────────────────────────────────────────
const OPCODE_COLORS: Record<string, string> = {
  SET:  '#7DF9AA',  // mint
  ADD:  '#A8DAFF',  // sky blue
  SUB:  '#A8DAFF',
  MUL:  '#A8DAFF',
  CMP:  '#FFD580',  // amber
  IF:   '#FFD580',
  GOTO: '#FF9EC4',  // pink
  CALL: '#FF9EC4',
  RET:  '#FF9EC4',
  LOAD: '#C9B8FF',  // purple
  OUT:  '#60FFF0',  // cyan
  HALT: '#FF6060',  // red
};

// ── Feedback messages ─────────────────────────────────────────────────────────
const FEEDBACK_TEXT: Record<QuarantineFeedback, string> = {
  'exact':         '✓ Quarantine confirmed. All malicious segments isolated.',
  'over-flagged':  '⚠ False positives detected. Clean lines included in quarantine.',
  'under-flagged': '⚠ Incomplete isolation. Additional parasite segments remain active.',
  'off':           '✗ Quarantine rejected. Wrong lines flagged — re-analyze.',
};
const FEEDBACK_COLOR: Record<QuarantineFeedback, string> = {
  'exact':         '#7DF9AA',
  'over-flagged':  '#FFD580',
  'under-flagged': '#FFD580',
  'off':           '#FF6060',
};

type RuntimeValue = string | number;

interface InputDiagnostics {
  executedLineIds: string[];
  visitedLineIds: string[];
  outputValues: RuntimeValue[];
  observedOutput: string;
  matchedExpected: boolean;
  registerSnapshot: Array<[string, RuntimeValue]>;
  runtimeError: string | null;
  reachedStepLimit: boolean;
}

interface TraceComparisonSummary {
  sharedPrefixCount: number;
  firstActiveOnlyLine: string | null;
  firstBaselineOnlyLine: string | null;
  uniqueActiveCount: number;
  uniqueBaselineCount: number;
}

interface InvestigationRun {
  inputId: string;
  inputLabel: string;
  executedAt: number;
  diagnostics: InputDiagnostics;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,%\s,]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compareObservedToExpected(
  outputValues: RuntimeValue[],
  observedOutput: string,
  expectedOutput: string,
): boolean {
  const expected = expectedOutput.trim();
  if (!expected) return outputValues.length === 0;

  if (outputValues.length === 1) {
    const observedSingle = parseNumericValue(outputValues[0]);
    const expectedSingle = parseNumericValue(expected);
    if (observedSingle !== null && expectedSingle !== null) {
      return Math.abs(observedSingle - expectedSingle) < 0.0001;
    }
  }

  const observedNumeric = parseNumericValue(observedOutput);
  const expectedNumeric = parseNumericValue(expected);
  if (observedNumeric !== null && expectedNumeric !== null) {
    return Math.abs(observedNumeric - expectedNumeric) < 0.0001;
  }

  return normalizeText(observedOutput) === normalizeText(expected);
}

function simulateProgramExecution(
  program: ParasiteCodeClientCase['program'],
  inputValues: Record<string, string | number>,
  expectedOutput: string,
): InputDiagnostics {
  const registers: Record<string, RuntimeValue> = {};
  const labels = new Map<string, number>();

  program.forEach((line, idx) => {
    labels.set(line.id, idx);
    const firstOperand = line.operands[0];
    if (firstOperand && /^[A-Z_][A-Z0-9_]*:$/.test(firstOperand)) {
      labels.set(firstOperand.slice(0, -1), idx);
    }
  });

  const executedLineIds: string[] = [];
  const outputValues: RuntimeValue[] = [];
  const callStack: number[] = [];

  const toNumeric = (value: RuntimeValue): number => {
    const n = parseNumericValue(value);
    return n ?? 0;
  };

  const resolveToken = (token: string | undefined): RuntimeValue => {
    if (!token) return 0;
    if (Object.prototype.hasOwnProperty.call(registers, token)) return registers[token];
    if (Object.prototype.hasOwnProperty.call(inputValues, token)) return inputValues[token];
    const n = parseNumericValue(token);
    if (n !== null && /^-?\d+(\.\d+)?$/.test(token.trim())) return n;
    return token;
  };

  const evaluateComparison = (left: RuntimeValue, op: string, right: RuntimeValue): boolean => {
    const leftNum = parseNumericValue(left);
    const rightNum = parseNumericValue(right);
    const numeric = leftNum !== null && rightNum !== null;

    switch (op) {
      case '=':
      case '==':
        return numeric ? leftNum === rightNum : String(left) === String(right);
      case '!=':
      case '<>':
        return numeric ? leftNum !== rightNum : String(left) !== String(right);
      case '>':
        return numeric ? leftNum > rightNum : String(left) > String(right);
      case '>=':
        return numeric ? leftNum >= rightNum : String(left) >= String(right);
      case '<':
        return numeric ? leftNum < rightNum : String(left) < String(right);
      case '<=':
        return numeric ? leftNum <= rightNum : String(left) <= String(right);
      default:
        return numeric ? leftNum === rightNum : String(left) === String(right);
    }
  };

  let pc = 0;
  let steps = 0;
  const maxSteps = Math.max(40, program.length * 20);
  let runtimeError: string | null = null;

  while (pc >= 0 && pc < program.length && steps < maxSteps) {
    const line = program[pc];
    executedLineIds.push(line.id);
    steps += 1;

    const [a, b, c] = line.operands;

    switch (line.opcode) {
      case 'LOAD': {
        if (a) registers[a] = typeof b === 'string' && b in inputValues ? inputValues[b] : 0;
        pc += 1;
        break;
      }
      case 'SET': {
        if (a) registers[a] = resolveToken(b);
        pc += 1;
        break;
      }
      case 'ADD': {
        if (a) registers[a] = toNumeric(resolveToken(b)) + toNumeric(resolveToken(c));
        pc += 1;
        break;
      }
      case 'SUB': {
        if (a) registers[a] = toNumeric(resolveToken(b)) - toNumeric(resolveToken(c));
        pc += 1;
        break;
      }
      case 'MUL': {
        if (a) registers[a] = toNumeric(resolveToken(b)) * toNumeric(resolveToken(c));
        pc += 1;
        break;
      }
      case 'CMP': {
        const left = resolveToken(a);
        const right = resolveToken(b);
        registers.FLAG = evaluateComparison(left, '==', right) ? 1 : 0;
        pc += 1;
        break;
      }
      case 'IF': {
        const left = resolveToken(a);
        const op = b ?? '==';
        const right = resolveToken(c);
        const condition = evaluateComparison(left, op, right);
        // IF condition is false => skip next line.
        pc += condition ? 1 : 2;
        break;
      }
      case 'GOTO': {
        const target = (a ?? '').replace(/:$/, '');
        const targetPc = labels.get(target);
        if (typeof targetPc !== 'number') {
          runtimeError = `Unknown jump target: ${target || '(empty)'}`;
          pc = program.length;
        } else {
          pc = targetPc;
        }
        break;
      }
      case 'CALL': {
        const target = (a ?? '').replace(/:$/, '');
        const targetPc = labels.get(target);
        if (typeof targetPc !== 'number') {
          runtimeError = `Unknown subroutine target: ${target || '(empty)'}`;
          pc = program.length;
        } else {
          callStack.push(pc + 1);
          pc = targetPc;
        }
        break;
      }
      case 'RET': {
        if (callStack.length === 0) {
          pc = program.length;
        } else {
          const returnPc = callStack.pop();
          pc = typeof returnPc === 'number' ? returnPc : program.length;
        }
        break;
      }
      case 'OUT': {
        outputValues.push(resolveToken(a));
        pc += 1;
        break;
      }
      case 'HALT': {
        pc = program.length;
        break;
      }
      default: {
        pc += 1;
      }
    }
  }

  const reachedStepLimit = steps >= maxSteps;
  if (reachedStepLimit && !runtimeError) {
    runtimeError = 'Execution reached the safety step limit (possible loop).';
  }

  const observedOutput = outputValues.length > 0
    ? outputValues.map(v => String(v)).join(', ')
    : 'No output emitted';

  const matchedExpected = compareObservedToExpected(outputValues, observedOutput, expectedOutput);
  const visitedLineIds = [...new Set(executedLineIds)];
  const registerSnapshot = Object.entries(registers)
    .filter(([k]) => /^R\d+$/i.test(k) || k === 'FLAG')
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 10);

  return {
    executedLineIds,
    visitedLineIds,
    outputValues,
    observedOutput,
    matchedExpected,
    registerSnapshot,
    runtimeError,
    reachedStepLimit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank, size = 'sm' }: { rank: Rank; size?: 'sm' | 'lg' }) {
  const color = RANK_COLORS[rank];
  const label = RANK_LABELS[rank];
  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="text-5xl font-black font-mono tracking-tighter"
          style={{ color, textShadow: `0 0 20px ${color}` }}
        >
          {rank}
        </div>
        <div className="text-xs font-mono tracking-widest uppercase" style={{ color }}>
          {label}
        </div>
      </div>
    );
  }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-black font-mono tracking-wider"
      style={{ color, border: `1px solid ${color}`, background: `${color}15` }}
    >
      {rank} — {label}
    </span>
  );
}

// ── Strain chip ───────────────────────────────────────────────────────────────
function StrainChip({ strain }: { strain: StrainFamily }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono tracking-wide"
      style={{ color: '#C9B8FF', border: '1px solid #C9B8FF44', background: '#C9B8FF15' }}>
      {strain.replace(/-/g, '\u200B-')}
    </span>
  );
}

// ── Briefing screen ───────────────────────────────────────────────────────────
function BriefingScreen({
  puzzle,
  onBegin,
}: {
  puzzle: ParasiteCodeClientCase;
  onBegin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="border border-green-500/30 rounded-lg p-6 bg-black/60 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-green-400/70 tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          MALWARE ANALYSIS TERMINAL — CASE INCOMING
        </div>
        <h2 className="text-2xl font-black font-mono text-white">{puzzle.caseTitle}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-mono text-gray-400">Program:</span>
          <span className="text-xs font-mono text-green-300">{puzzle.programName}</span>
          <span className="text-gray-600">·</span>
          <span className="text-xs font-mono text-gray-400">Strain family:</span>
          <StrainChip strain={puzzle.strainFamily} />
        </div>
      </div>

      {/* Narrative */}
      <div className="border border-gray-700 rounded-lg p-5 bg-gray-900/40 space-y-2">
        <div className="text-xs font-mono text-gray-500 tracking-widest uppercase">FIELD BRIEF</div>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
          {puzzle.contextNarrative}
        </p>
      </div>

      {/* Strain info */}
      <div className="border border-purple-500/20 rounded-lg p-4 bg-purple-900/10 space-y-1">
        <div className="text-xs font-mono text-purple-300/70 tracking-widest uppercase">STRAIN CLASSIFICATION</div>
        <div className="text-sm text-purple-200">
          <span className="font-mono font-bold">{puzzle.strainFamily}</span>
          {' — '}
          {STRAIN_DESCRIPTIONS[puzzle.strainFamily]}
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-yellow-500/20 rounded-lg p-4 bg-yellow-900/10 space-y-2 text-sm text-yellow-200/80">
        <div className="text-xs font-mono text-yellow-400/70 tracking-widest uppercase mb-1">ANALYST BRIEFING</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>Read through the program listing using the <span className="font-mono text-yellow-300">OPCODE GUIDE</span> if needed</li>
          <li>Run the <span className="font-mono text-yellow-300">TEST INPUTS</span> to observe program behavior</li>
          <li>Click lines you believe are malicious to <span className="font-mono text-yellow-300">quarantine</span> them</li>
          <li>Submit when you have isolated every parasite segment</li>
          <li>You are scored on attempts — fewer is better</li>
        </ul>
      </div>

      <button
        onClick={onBegin}
        className="w-full py-3 rounded-lg font-mono font-bold tracking-widest text-sm uppercase transition-all hover:scale-[1.02] active:scale-100"
        style={{
          background: 'linear-gradient(to right, #0f2a0f, #1a3a1a)',
          border: '1px solid #7DF9AA55',
          color: '#7DF9AA',
          boxShadow: '0 0 20px #7DF9AA20',
        }}
      >
        ▶ BEGIN ANALYSIS
      </button>
    </motion.div>
  );
}

// ── Program line ──────────────────────────────────────────────────────────────
function ProgramLineRow({
  line,
  flagged,
  inspected,
  tracing,
  visited,
  solved,
  onInspect,
  onClick,
}: {
  line: ParasiteCodeClientCase['program'][number];
  flagged: boolean;
  inspected: boolean;
  tracing: boolean;
  visited: boolean;
  solved: boolean;
  onInspect: (lineId: string) => void;
  onClick: () => void;
}) {
  const opcodeColor = OPCODE_COLORS[line.opcode] ?? '#e2e8f0';
  return (
    <motion.div
      layout
      onClick={solved ? undefined : onClick}
      onMouseEnter={() => onInspect(line.id)}
      onFocus={() => onInspect(line.id)}
      className="flex items-start gap-3 px-3 py-1.5 rounded cursor-pointer select-none transition-colors"
      tabIndex={0}
      style={{
        background: flagged
          ? 'rgba(255, 96, 96, 0.15)'
          : inspected
          ? 'rgba(253, 231, 76, 0.08)'
          : tracing
          ? 'rgba(125, 249, 170, 0.08)'
          : visited
          ? 'rgba(96, 255, 240, 0.06)'
          : 'transparent',
        borderLeft: flagged
          ? '2px solid #FF6060'
          : inspected
          ? '2px solid rgba(253,231,76,0.45)'
          : tracing
          ? '2px solid #7DF9AA'
          : visited
          ? '2px solid rgba(96,255,240,0.45)'
          : '2px solid transparent',
        cursor: solved ? 'default' : 'pointer',
      }}
      whileHover={solved ? {} : { backgroundColor: 'rgba(255,255,255,0.04)' }}
    >
      {/* Line ID */}
      <span className="text-xs font-mono text-gray-600 w-8 shrink-0 pt-0.5">
        {line.id}
      </span>

      {/* Tracing arrow */}
      <span className="text-xs font-mono w-4 shrink-0 pt-0.5" style={{ color: '#7DF9AA' }}>
        {tracing ? '▶' : ' '}
      </span>

      {/* Opcode */}
      <span className="text-sm font-mono font-bold w-12 shrink-0" style={{ color: opcodeColor }}>
        {line.opcode}
      </span>

      {/* Operands */}
      <span className="text-sm font-mono text-gray-200 flex-1">
        {line.operands.join(' ')}
        {line.comment && (
          <span className="text-gray-500 ml-3">{'; '}{line.comment}</span>
        )}
      </span>

      {/* Quarantine indicator */}
      {flagged && (
        <span className="text-xs font-mono shrink-0 pt-0.5" style={{ color: '#FF6060' }}>
          [QUARANTINE]
        </span>
      )}
      {!flagged && visited && (
        <span className="text-xs font-mono shrink-0 pt-0.5" style={{ color: '#60FFF0' }}>
          [VISITED]
        </span>
      )}
    </motion.div>
  );
}

// ── Opcode guide panel ────────────────────────────────────────────────────────
function OpcodeGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        OPCODE REFERENCE
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 border border-gray-700 rounded p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {(Object.entries(OPCODE_DESCRIPTIONS) as [string, string][]).map(([op, desc]) => (
                <div key={op} className="flex gap-2 text-xs font-mono">
                  <span className="w-10 shrink-0 font-bold" style={{ color: OPCODE_COLORS[op] ?? '#e2e8f0' }}>
                    {op}
                  </span>
                  <span className="text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Test input panel ──────────────────────────────────────────────────────────
function TestInputPanel({
  inputs,
  activeId,
  diagnostics,
  runs,
  comparisonId,
  onActivate,
  onSelectComparison,
}: {
  inputs: ParasiteCodeClientCase['testInputs'];
  activeId: string | null;
  diagnostics: InputDiagnostics | null;
  runs: InvestigationRun[];
  comparisonId: string | null;
  onActivate: (id: string) => void;
  onSelectComparison: (id: string | null) => void;
}) {
  const runMap = useMemo(() => {
    return new Map(runs.map((run) => [run.inputId, run]));
  }, [runs]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono text-gray-500 tracking-widest uppercase">EXECUTION CASES</div>
        <div className="text-[11px] font-mono text-gray-600">
          Run cases, then compare traces.
        </div>
      </div>
      {inputs.map(inp => {
        const active = inp.id === activeId;
        const comparison = inp.id === comparisonId && inp.id !== activeId;
        const priorRun = runMap.get(inp.id) ?? null;
        const diagnosticsForInput = active ? diagnostics ?? priorRun?.diagnostics ?? null : priorRun?.diagnostics ?? null;
        const tracePreview = diagnosticsForInput
          ? diagnosticsForInput.visitedLineIds.slice(0, active ? 14 : 8)
          : [];
        const hasTraceOverflow = diagnosticsForInput
          ? diagnosticsForInput.visitedLineIds.length > tracePreview.length
          : false;
        return (
          <div
            key={inp.id}
            className="border rounded p-3 space-y-1 cursor-pointer transition-colors"
            style={{
              borderColor: active ? '#60FFF0' : comparison ? '#FDE74C' : '#374151',
              background: active ? 'rgba(96,255,240,0.05)' : comparison ? 'rgba(253,231,76,0.05)' : 'transparent',
            }}
            onClick={() => onActivate(inp.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-mono font-bold" style={{ color: active ? '#60FFF0' : comparison ? '#FDE74C' : '#9ca3af' }}>
                {inp.label}
              </div>
              <div className="flex flex-wrap justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onActivate(inp.id);
                  }}
                  className="px-2 py-1 rounded border text-[11px] font-mono transition-colors"
                  style={{
                    borderColor: active ? 'rgba(96,255,240,0.45)' : 'rgba(255,255,255,0.12)',
                    color: active ? '#60FFF0' : '#d1d5db',
                    background: active ? 'rgba(96,255,240,0.08)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  {active ? 'RUNNING VIEW' : priorRun ? 'OPEN RUN' : 'RUN CASE'}
                </button>
                {priorRun && !active && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectComparison(comparison ? null : inp.id);
                    }}
                    className="px-2 py-1 rounded border text-[11px] font-mono transition-colors"
                    style={{
                      borderColor: comparison ? 'rgba(253,231,76,0.45)' : 'rgba(255,255,255,0.12)',
                      color: comparison ? '#FDE74C' : '#9ca3af',
                      background: comparison ? 'rgba(253,231,76,0.08)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {comparison ? 'COMPARE ON' : 'USE AS COMPARE'}
                  </button>
                )}
              </div>
            </div>
            {priorRun && !active && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-gray-500">
                <span style={{ color: priorRun.diagnostics.matchedExpected ? '#7DF9AA' : '#FFB86B' }}>
                  {priorRun.diagnostics.matchedExpected ? 'Expected output matched' : 'Output drift detected'}
                </span>
                <span>Visited {priorRun.diagnostics.visitedLineIds.length} lines</span>
              </div>
            )}
            {active && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1 mt-1"
              >
                <div className="text-xs font-mono text-gray-400">
                  {Object.entries(inp.values).map(([k, v]) => (
                    <span key={k} className="mr-3">
                      <span className="text-purple-300">{k}</span>=<span className="text-green-300">{String(v)}</span>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 text-xs font-mono mt-1">
                  <span className="text-gray-500">Expected output:</span>
                  <span className="text-yellow-300">{inp.expectedOutput}</span>
                </div>
                {diagnosticsForInput && (
                  <>
                    <div className="flex gap-2 text-xs font-mono mt-1">
                      <span className="text-gray-500">Observed output:</span>
                      <span style={{ color: diagnosticsForInput.matchedExpected ? '#7DF9AA' : '#FFB86B' }}>
                        {diagnosticsForInput.observedOutput}
                      </span>
                    </div>
                    <div
                      className="text-xs font-mono"
                      style={{ color: diagnosticsForInput.matchedExpected ? '#7DF9AA' : '#FFD580' }}
                    >
                      {diagnosticsForInput.matchedExpected
                        ? '✓ Observed output matches expected baseline'
                        : '⚠ Observed output diverges from expected baseline'}
                    </div>
                    <div className="text-xs font-mono text-cyan-300 break-words">
                      Trace: {tracePreview.join(' → ')}
                      {hasTraceOverflow ? ` → … (+${diagnosticsForInput.visitedLineIds.length - tracePreview.length} more)` : ''}
                    </div>
                    {diagnosticsForInput.registerSnapshot.length > 0 && (
                      <div className="text-xs font-mono text-gray-400 break-words">
                        Registers: {diagnosticsForInput.registerSnapshot.map(([k, v]) => `${k}=${String(v)}`).join(' · ')}
                      </div>
                    )}
                    {diagnosticsForInput.runtimeError && (
                      <div className="text-xs font-mono text-red-300">
                        Runtime warning: {diagnosticsForInput.runtimeError}
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-gray-500">
                      Save this trace in your head, then compare it against another case to see where behavior branches.
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Investigation workbench panel ───────────────────────────────────────────
function InvestigationWorkbenchPanel({
  activeRun,
  compareRun,
  traceComparison,
  totalRuns,
  flaggedCount,
  flaggedVisitedCount,
  flaggedUnvisitedCount,
  attemptsRemaining,
  maxAttempts,
  locked,
}: {
  activeRun: InvestigationRun | null;
  compareRun: InvestigationRun | null;
  traceComparison: TraceComparisonSummary | null;
  totalRuns: number;
  flaggedCount: number;
  flaggedVisitedCount: number;
  flaggedUnvisitedCount: number;
  attemptsRemaining: number;
  maxAttempts: number;
  locked: boolean;
}) {
  const diagnostics = activeRun?.diagnostics ?? null;
  const hasAnyFlagged = flaggedCount > 0;

  return (
    <div className="border border-cyan-500/20 rounded-lg p-3 bg-cyan-900/10 space-y-2">
      <div className="text-xs font-mono tracking-widest uppercase text-cyan-300/80">
        INVESTIGATION WORKBENCH
      </div>

      {!activeRun ? (
        <div className="text-xs font-mono text-gray-300 leading-relaxed">
          No evidence captured yet. Run a case to collect output, registers, and a line trace.
        </div>
      ) : (
        <div className="border border-gray-700/60 rounded p-2 bg-black/25 text-[11px] font-mono text-gray-300 leading-relaxed space-y-1">
          <div>
            Current run: <span style={{ color: '#60FFF0' }}>{activeRun.inputLabel}</span>
          </div>
          <div>
            Output status:{' '}
            <span style={{ color: diagnostics?.matchedExpected ? '#7DF9AA' : '#FFB86B' }}>
              {diagnostics?.matchedExpected ? 'matches expected result' : 'drifts from expected result'}
            </span>
          </div>
          <div>
            Lines visited in this run: <span className="text-cyan-300">{diagnostics?.visitedLineIds.length ?? 0}</span>
          </div>
        </div>
      )}

      {compareRun && (
        <div className="border border-gray-700/60 rounded p-2 bg-black/25 text-[11px] font-mono text-gray-300 leading-relaxed space-y-1">
          <div>
            Comparison run: <span style={{ color: '#FDE74C' }}>{compareRun.inputLabel}</span>
          </div>
          {traceComparison ? (
            <>
              <div>
                Shared prefix: {traceComparison.sharedPrefixCount} step{traceComparison.sharedPrefixCount === 1 ? '' : 's'}.
              </div>
              <div>
                Divergence starts around current {traceComparison.firstActiveOnlyLine ?? 'END'} vs compare {traceComparison.firstBaselineOnlyLine ?? 'END'}.
              </div>
              <div>
                Unique line count: current {traceComparison.uniqueActiveCount}, compare {traceComparison.uniqueBaselineCount}.
              </div>
            </>
          ) : (
            <div>
              Run a different case or switch your compare target to see where control flow changes.
            </div>
          )}
        </div>
      )}

      {!compareRun && totalRuns === 1 && (
        <div className="text-[11px] font-mono text-gray-500 leading-relaxed">
          One run logged. Capture a second case to see where the program starts behaving differently.
        </div>
      )}

      <div className="text-[11px] font-mono text-gray-400 leading-relaxed space-y-1">
        {!hasAnyFlagged && (
          <div>
            Quarantine the smallest cluster that best explains the bad output, not every line in the neighborhood.
          </div>
        )}
        {hasAnyFlagged && (
          <>
            <div>
              Current quarantine set: {flaggedCount} line{flaggedCount === 1 ? '' : 's'}.
            </div>
            {flaggedUnvisitedCount > 0 ? (
              <div className="text-yellow-300">
                {flaggedUnvisitedCount} flagged line{flaggedUnvisitedCount === 1 ? '' : 's'} were not visited in this run. Re-check with another input.
              </div>
            ) : (
              <div>
                {flaggedVisitedCount} flagged line{flaggedVisitedCount === 1 ? '' : 's'} are present on the active trace.
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="text-[11px] font-mono"
        style={{ color: locked || attemptsRemaining <= 1 ? '#FF8A8A' : '#9ca3af' }}
      >
        {locked
          ? 'Case locked: no retries remain.'
          : attemptsRemaining <= 1
          ? `Final retry warning: ${attemptsRemaining}/${maxAttempts} remaining.`
          : `Retries remaining: ${attemptsRemaining}/${maxAttempts}.`}
      </div>
    </div>
  );
}

// ── Line evidence panel ─────────────────────────────────────────────────────
function LineEvidencePanel({
  line,
  activeRun,
  compareRun,
  runs,
  flagged,
}: {
  line: ParasiteCodeClientCase['program'][number] | null;
  activeRun: InvestigationRun | null;
  compareRun: InvestigationRun | null;
  runs: InvestigationRun[];
  flagged: boolean;
}) {
  if (!line) {
    return (
      <div className="border border-yellow-500/20 rounded-lg p-3 bg-yellow-900/10 space-y-2">
        <div className="text-xs font-mono tracking-widest uppercase text-yellow-300/80">LINE INSPECTOR</div>
        <div className="text-[11px] font-mono text-gray-400 leading-relaxed">
          Hover a code line to inspect its role across your collected runs.
        </div>
      </div>
    );
  }

  const touchedRuns = runs.filter((run) => run.diagnostics.visitedLineIds.includes(line.id));
  const driftRuns = touchedRuns.filter((run) => !run.diagnostics.matchedExpected);
  const stableRuns = touchedRuns.filter((run) => run.diagnostics.matchedExpected);
  const activeVisited = Boolean(activeRun?.diagnostics.visitedLineIds.includes(line.id));
  const compareVisited = Boolean(compareRun?.diagnostics.visitedLineIds.includes(line.id));

  let evidenceSummary = 'This line has not been reached in any run yet.';
  if (touchedRuns.length > 0 && driftRuns.length > 0 && stableRuns.length === 0) {
    evidenceSummary = 'This line has only appeared in runs where the output drifted.';
  } else if (touchedRuns.length > 0 && stableRuns.length > 0 && driftRuns.length === 0) {
    evidenceSummary = 'This line has only appeared in runs that behaved as expected.';
  } else if (touchedRuns.length > 0) {
    evidenceSummary = 'This line appears in both stable and unstable runs, so context matters more than presence alone.';
  }

  return (
    <div className="border border-yellow-500/20 rounded-lg p-3 bg-yellow-900/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono tracking-widest uppercase text-yellow-300/80">LINE INSPECTOR</div>
        {flagged && <div className="text-[11px] font-mono text-red-300">QUARANTINED</div>}
      </div>

      <div className="border border-gray-700/60 rounded p-2 bg-black/25 space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-yellow-200">{line.id}</span>
          <span style={{ color: OPCODE_COLORS[line.opcode] ?? '#e2e8f0' }}>{line.opcode}</span>
        </div>
        <div className="text-[11px] font-mono text-gray-300 break-words">
          {line.operands.join(' ')}
        </div>
        <div className="text-[11px] font-mono text-gray-500">
          {OPCODE_DESCRIPTIONS[line.opcode]}
        </div>
        {line.comment && (
          <div className="text-[11px] font-mono text-gray-400">
            Comment: {line.comment}
          </div>
        )}
      </div>

      <div className="text-[11px] font-mono text-gray-300 leading-relaxed space-y-1">
        <div>{evidenceSummary}</div>
        <div>Runs touching this line: <span className="text-yellow-200">{touchedRuns.length}</span></div>
        <div>Drift runs: <span className="text-orange-300">{driftRuns.length}</span> · Stable runs: <span className="text-green-300">{stableRuns.length}</span></div>
      </div>

      <div className="border border-gray-700/60 rounded p-2 bg-black/25 text-[11px] font-mono text-gray-300 leading-relaxed space-y-1">
        <div>
          Current run: <span style={{ color: activeVisited ? '#60FFF0' : '#6b7280' }}>{activeVisited ? 'visited' : 'not visited'}</span>
        </div>
        {compareRun && (
          <div>
            Compare run: <span style={{ color: compareVisited ? '#FDE74C' : '#6b7280' }}>{compareVisited ? 'visited' : 'not visited'}</span>
          </div>
        )}
      </div>

      {touchedRuns.length > 0 && (
        <div className="text-[11px] font-mono text-gray-500 leading-relaxed">
          Seen in: {touchedRuns.map((run) => run.inputLabel).join(' · ')}
        </div>
      )}
    </div>
  );
}

// ── Quarantine panel ──────────────────────────────────────────────────────────
function QuarantinePanel({
  flaggedIds,
  onRemove,
  onClearAll,
  onSubmit,
  onCheckAgain,
  submitting,
  submitResult,
  submitError,
  submissionCount,
  attemptsUsed,
  attemptsRemaining,
  maxAttempts,
  locked,
  solved,
}: {
  flaggedIds: Set<string>;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onSubmit: () => void;
  onCheckAgain: () => void;
  submitting: boolean;
  submitResult: SubmitResult | null;
  submitError: string | null;
  submissionCount: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  locked: boolean;
  solved: boolean;
}) {
  const ids = [...flaggedIds];
  const lastFeedback = submitResult && !submitResult.correct ? submitResult.feedback : null;
  const safeMaxAttempts = Math.max(1, maxAttempts);
  const usedAttemptPct = Math.min(100, Math.round((attemptsUsed / safeMaxAttempts) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono text-gray-500 tracking-widest uppercase">QUARANTINE WORKSPACE</div>
        {!solved && ids.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {!solved && (
        <div className="border border-gray-800 rounded p-3 bg-black/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Retry budget</span>
            <span style={{ color: locked ? '#FF6060' : '#FFD580' }}>
              {attemptsRemaining}/{maxAttempts} left
            </span>
          </div>
          <div className="h-1.5 rounded bg-gray-800 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${usedAttemptPct}%`,
                background: locked ? '#FF6060' : '#FFD580',
              }}
            />
          </div>
          <div className="text-[11px] font-mono text-gray-500">
            Incorrect submissions used: {attemptsUsed}/{maxAttempts}
          </div>
        </div>
      )}

      {ids.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded p-4 text-center text-xs font-mono text-gray-600">
          Click program lines above to quarantine them
        </div>
      ) : (
        <div className="border border-red-900/50 rounded p-3 bg-red-900/10 space-y-1">
          {ids.map(id => (
            <div key={id} className="flex items-center justify-between text-xs font-mono">
              <span style={{ color: '#FF6060' }}>{id}</span>
              {!solved && (
                <button
                  onClick={() => onRemove(id)}
                  className="text-gray-500 hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Feedback from last attempt */}
      {lastFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded p-3 text-xs font-mono"
          style={{
            borderColor: `${FEEDBACK_COLOR[lastFeedback]}44`,
            background: `${FEEDBACK_COLOR[lastFeedback]}10`,
            color: FEEDBACK_COLOR[lastFeedback],
          }}
        >
          {FEEDBACK_TEXT[lastFeedback]}
        </motion.div>
      )}

      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded p-3 text-xs font-mono"
          style={{
            borderColor: 'rgba(255,96,96,0.35)',
            background: 'rgba(255,96,96,0.08)',
            color: '#FF9C9C',
          }}
        >
          {submitError}
        </motion.div>
      )}

      {locked && !solved && (
        <div className="border border-red-500/30 rounded p-3 bg-red-900/10 text-xs font-mono text-red-300 flex items-center justify-between gap-3">
          <span>Case locked for this round. Your attempts reset automatically — check again to retry.</span>
          <button
            type="button"
            onClick={onCheckAgain}
            className="shrink-0 px-3 py-1.5 rounded border border-red-500/40 text-red-200 hover:bg-red-900/20 transition-colors"
          >
            Check Again
          </button>
        </div>
      )}

      {/* Attempt counter */}
      {submissionCount > 0 && !solved && (
        <div className="text-xs font-mono text-gray-500">
          Attempts: {submissionCount}
        </div>
      )}

      {!solved && (
        <button
          onClick={onSubmit}
          disabled={submitting || ids.length === 0 || locked || attemptsRemaining <= 0}
          className="w-full py-2.5 rounded font-mono font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: ids.length === 0 ? 'transparent' : 'rgba(255,96,96,0.15)',
            border: '1px solid rgba(255,96,96,0.4)',
            color: '#FF6060',
          }}
        >
          {locked || attemptsRemaining <= 0
            ? '▶ CASE LOCKED'
            : submitting
            ? '▶ SUBMITTING…'
            : `▶ SUBMIT QUARANTINE (${ids.length} line${ids.length !== 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  );
}

// ── Solved screen ─────────────────────────────────────────────────────────────
function SolvedScreen({
  rank,
  submissionCount,
  activationCondition,
  retentionUnlock,
  strainFamily,
}: {
  rank: Rank;
  submissionCount: number;
  activationCondition: string | null;
  retentionUnlock: string | null;
  strainFamily: StrainFamily;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-5 max-w-2xl mx-auto"
    >
      {/* Rank display */}
      <div className="border border-green-500/30 rounded-lg p-6 bg-black/60 text-center space-y-3">
        <div className="text-xs font-mono text-green-400/70 tracking-widest uppercase">QUARANTINE SUCCESSFUL</div>
        <RankBadge rank={rank} size="lg" />
        <div className="text-sm font-mono text-gray-400">
          Isolated in <span className="text-white font-bold">{submissionCount}</span> attempt{submissionCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Activation condition */}
      {activationCondition && (
        <div className="border border-yellow-500/20 rounded-lg p-4 bg-yellow-900/10 space-y-2">
          <div className="text-xs font-mono text-yellow-400/70 tracking-widest uppercase">ACTIVATION CONDITION</div>
          <p className="text-sm font-mono text-yellow-200">{activationCondition}</p>
        </div>
      )}

      {/* Strain classification */}
      <div className="border border-purple-500/20 rounded-lg p-4 bg-purple-900/10 space-y-2">
        <div className="text-xs font-mono text-purple-300/70 tracking-widest uppercase">STRAIN LOGGED</div>
        <div className="text-sm text-purple-200">
          <StrainChip strain={strainFamily} />
          <span className="ml-2 text-purple-300/70">{STRAIN_DESCRIPTIONS[strainFamily]}</span>
        </div>
      </div>

      {/* Retention unlock */}
      {retentionUnlock && (
        <div className="border border-gray-600 rounded-lg p-4 bg-gray-900/50 space-y-2">
          <div className="text-xs font-mono text-gray-500 tracking-widest uppercase">DECLASSIFIED</div>
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
            {retentionUnlock}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────// How to play modal
// ─────────────────────────────────────────────────────────────────────────────────
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={onClose}>
      <div className="max-w-lg w-full rounded-xl p-6 shadow-2xl" style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-extrabold" style={{ color: "#FDE74C" }}>How to Play — Parasite Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-4">✕</button>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <p>🧫 <strong>Goal:</strong> Investigate why the program behaves incorrectly and quarantine the smallest set of lines that explains the bad behavior.</p>
          <p>📝 <strong>Read the program</strong> listing and use the Opcode Guide when you need a quick reminder.</p>
          <p>🔍 <strong>Run cases:</strong> execute different inputs, compare their traces, and look for the point where behavior splits.</p>
          <p>🧠 <strong>Inspect evidence:</strong> hover lines to see which runs touched them and whether those runs were stable or drifting.</p>
          <p>🚩 <strong>Quarantine lines</strong> by clicking them in the listing once your hypothesis is strong enough.</p>
          <p>🚀 <strong>Submit</strong> when your quarantine set is tight. Fewer wrong attempts earns a better rank.</p>
          <p>📈 Ranks go from <strong>F</strong> (many attempts) up to <strong>S</strong> (first try).</p>
        </div>
        <div className="mt-5 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-80" style={{ background: "#FDE74C", color: "#000" }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ParasiteCodePuzzle({ puzzleId, onSolved }: ParasiteCodePuzzleProps) {
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // UI state
  const [phase, setPhase] = useState<'briefing' | 'analysis' | 'solved'>('briefing');
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [tracingLine, setTracingLine] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [activeDiagnostics, setActiveDiagnostics] = useState<InputDiagnostics | null>(null);
  const [runHistory, setRunHistory] = useState<InvestigationRun[]>([]);
  const [comparisonInputId, setComparisonInputId] = useState<string | null>(null);
  const [inspectedLineId, setInspectedLineId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const tracerTimeoutRef = useRef<number | null>(null);

  // ── Load state ──────────────────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/parasite/state`);
      if (!res.ok) throw new Error('Failed to load');
      const data: ServerState = await res.json();
      setServerState(data);
      setSubmitError(data.locked && !data.solved ? 'No attempts remaining. This case is locked for your account.' : null);
      if (data.solved) {
        setPhase('solved');
      }
      if (data.lastFeedback) {
        // Restore last feedback as a synthetic result
        setSubmitResult({
          correct: false,
          feedback: data.lastFeedback,
          foundCount: 0,
          totalParasiteCount: 0,
          submissionCount: data.submissionCount,
          rank: data.rank,
        });
      }
    } catch (e) {
      setError('Failed to load puzzle. Please refresh.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [puzzleId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // ── Toggle quarantine ───────────────────────────────────────────────────────
  const toggleFlag = useCallback((lineId: string) => {
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const stopTraceAnimation = useCallback(() => {
    if (tracerTimeoutRef.current !== null) {
      window.clearTimeout(tracerTimeoutRef.current);
      tracerTimeoutRef.current = null;
    }
    setTracingLine(null);
  }, []);

  // ── Tracer + runtime diagnostics ───────────────────────────────────────────
  const handleActivateInput = useCallback((inputId: string) => {
    setActiveInput(inputId);
    setComparisonInputId((prev) => {
      if (prev && prev !== inputId) return prev;
      return activeInput && activeInput !== inputId ? activeInput : prev;
    });

    const puzzle = serverState?.puzzle;
    if (!puzzle?.program?.length) {
      setActiveDiagnostics(null);
      stopTraceAnimation();
      return;
    }

    const selectedInput = puzzle.testInputs.find(inp => inp.id === inputId);
    if (!selectedInput) {
      setActiveDiagnostics(null);
      stopTraceAnimation();
      return;
    }

    const diagnostics = simulateProgramExecution(
      puzzle.program,
      selectedInput.values,
      selectedInput.expectedOutput,
    );
    setActiveDiagnostics(diagnostics);
    setRunHistory((prev) => {
      const nextRun: InvestigationRun = {
        inputId: selectedInput.id,
        inputLabel: selectedInput.label,
        executedAt: Date.now(),
        diagnostics,
      };
      return [nextRun, ...prev.filter((run) => run.inputId !== selectedInput.id)];
    });

    stopTraceAnimation();
    if (diagnostics.executedLineIds.length === 0) return;

    let i = 0;
    const trace = diagnostics.executedLineIds;
    const step = () => {
      if (i >= trace.length) {
        setTracingLine(null);
        tracerTimeoutRef.current = null;
        return;
      }
      setTracingLine(trace[i]);
      i += 1;
      tracerTimeoutRef.current = window.setTimeout(step, 130);
    };
    tracerTimeoutRef.current = window.setTimeout(step, 180);
  }, [activeInput, serverState?.puzzle, stopTraceAnimation]);

  useEffect(() => {
    return () => {
      if (tracerTimeoutRef.current !== null) {
        window.clearTimeout(tracerTimeoutRef.current);
      }
    };
  }, []);

  const visitedLineIds = useMemo(
    () => new Set(activeDiagnostics?.visitedLineIds ?? []),
    [activeDiagnostics],
  );

  const puzzleData = serverState?.puzzle ?? null;

  const activeInputConfig = useMemo(() => {
    if (!puzzleData?.testInputs?.length || !activeInput) return null;
    return puzzleData.testInputs.find(inp => inp.id === activeInput) ?? null;
  }, [activeInput, puzzleData]);

  const activeRun = useMemo(() => {
    if (!activeInput) return null;
    return runHistory.find((run) => run.inputId === activeInput) ?? null;
  }, [activeInput, runHistory]);

  const compareRun = useMemo(() => {
    if (runHistory.length === 0) return null;
    if (comparisonInputId && comparisonInputId !== activeInput) {
      const explicit = runHistory.find((run) => run.inputId === comparisonInputId);
      if (explicit) return explicit;
    }
    return runHistory.find((run) => run.inputId !== activeInput) ?? null;
  }, [activeInput, comparisonInputId, runHistory]);

  const traceComparison = useMemo<TraceComparisonSummary | null>(() => {
    if (!activeDiagnostics || !compareRun) {
      return null;
    }

    const activeTrace = activeDiagnostics.executedLineIds;
    const baselineTrace = compareRun.diagnostics.executedLineIds;
    let sharedPrefixCount = 0;

    while (
      sharedPrefixCount < activeTrace.length &&
      sharedPrefixCount < baselineTrace.length &&
      activeTrace[sharedPrefixCount] === baselineTrace[sharedPrefixCount]
    ) {
      sharedPrefixCount += 1;
    }

    const activeVisited = new Set(activeDiagnostics.visitedLineIds);
    const baselineVisited = new Set(compareRun.diagnostics.visitedLineIds);
    let uniqueActiveCount = 0;
    let uniqueBaselineCount = 0;

    activeVisited.forEach(id => {
      if (!baselineVisited.has(id)) uniqueActiveCount += 1;
    });
    baselineVisited.forEach(id => {
      if (!activeVisited.has(id)) uniqueBaselineCount += 1;
    });

    return {
      sharedPrefixCount,
      firstActiveOnlyLine: activeTrace[sharedPrefixCount] ?? null,
      firstBaselineOnlyLine: baselineTrace[sharedPrefixCount] ?? null,
      uniqueActiveCount,
      uniqueBaselineCount,
    };
  }, [activeDiagnostics, compareRun]);

  const flaggedTraceStats = useMemo(() => {
    let flaggedVisitedCount = 0;
    let flaggedUnvisitedCount = 0;

    flaggedIds.forEach(id => {
      if (visitedLineIds.has(id)) {
        flaggedVisitedCount += 1;
      } else {
        flaggedUnvisitedCount += 1;
      }
    });

    return {
      flaggedVisitedCount,
      flaggedUnvisitedCount,
    };
  }, [flaggedIds, visitedLineIds]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting || flaggedIds.size === 0) return;
    if (serverState?.locked || (serverState?.attemptsRemaining ?? 1) <= 0) {
      setSubmitError('No attempts remaining. This case is locked for your account.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/parasite/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarantinedIds: [...flaggedIds] }),
      });
      const payload = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        const message = typeof payload.error === 'string' ? payload.error : 'Submission failed. Please try again.';
        setSubmitError(message);
        setServerState(prev => prev ? {
          ...prev,
          attemptsUsed: typeof payload.attemptsUsed === 'number' ? payload.attemptsUsed : prev.attemptsUsed,
          attemptsRemaining: typeof payload.attemptsRemaining === 'number' ? payload.attemptsRemaining : prev.attemptsRemaining,
          maxAttempts: typeof payload.maxAttempts === 'number' ? payload.maxAttempts : prev.maxAttempts,
          locked: typeof payload.locked === 'boolean' ? payload.locked : prev.locked,
        } : prev);
        return;
      }

      const data = payload as SubmitResult;
      setSubmitResult(data);
      setServerState(prev => prev ? {
        ...prev,
        submissionCount: data.submissionCount,
        rank: data.rank,
        solved: data.correct,
        activationCondition: data.activationCondition ?? prev.activationCondition,
        retentionUnlock: data.retentionUnlock ?? prev.retentionUnlock,
        attemptsUsed: typeof data.attemptsUsed === 'number' ? data.attemptsUsed : prev.attemptsUsed,
        attemptsRemaining: typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : prev.attemptsRemaining,
        maxAttempts: typeof data.maxAttempts === 'number' ? data.maxAttempts : prev.maxAttempts,
        locked: typeof data.locked === 'boolean' ? data.locked : prev.locked,
      } : prev);

      if (!data.correct && data.locked) {
        setSubmitError('No attempts remaining. This case is locked for your account.');
      }

      if (data.correct) {
        setPhase('solved');
        onSolved();
      }
    } catch (e) {
      console.error('[submit]', e);
      setSubmitError('Submission failed. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [flaggedIds, puzzleId, submitting, onSolved, serverState]);

  // ── Render states ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-green-400 font-mono text-sm animate-pulse">
        ▶ INITIALISING ANALYSIS TERMINAL…
      </div>
    );
  }
  if (error || !serverState) {
    return (
      <div className="p-6 border border-red-700/50 rounded-lg bg-red-900/10 text-red-400 font-mono text-sm">
        {error ?? 'Puzzle data unavailable.'}
      </div>
    );
  }

  const { puzzle } = serverState;

  // ── Briefing ────────────────────────────────────────────────────────────────
  if (phase === 'briefing') {
    return (
      <div className="min-h-64 py-4 font-mono">
        <BriefingScreen puzzle={puzzle} onBegin={() => setPhase('analysis')} />
      </div>
    );
  }

  // ── Solved ──────────────────────────────────────────────────────────────────
  if (phase === 'solved') {
    return (
      <div className="py-4 font-mono">
        <SolvedScreen
          rank={serverState.rank}
          submissionCount={serverState.submissionCount}
          activationCondition={serverState.activationCondition}
          retentionUnlock={serverState.retentionUnlock}
          strainFamily={puzzle.strainFamily}
        />
      </div>
    );
  }

  const inspectedLine = puzzle.program.find((line) => line.id === (inspectedLineId ?? tracingLine)) ?? null;

  // ── Analysis layout ─────────────────────────────────────────────────────────
  return (
    <div className="font-mono space-y-4">
      {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-green-400/70 tracking-widest uppercase">
            {puzzle.programName}
          </span>
          <StrainChip strain={puzzle.strainFamily} />
        </div>
        <div className="flex items-center gap-3">
          {serverState.submissionCount > 0 && (
            <RankBadge rank={serverState.rank} />
          )}
          <span className="text-xs text-gray-500">
            Attempts logged: {serverState.submissionCount}
          </span>
          <span
            className="text-xs"
            style={{ color: serverState.locked || serverState.attemptsRemaining <= 0 ? '#FF6060' : '#9ca3af' }}
          >
            Retries left: {serverState.attemptsRemaining}/{serverState.maxAttempts}
          </span>
          <button onClick={() => setShowHelp(true)} className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-80" style={{ background: "rgba(253,231,76,0.08)", border: "1px solid rgba(253,231,76,0.3)", color: "#FDE74C" }}>? How to play</button>
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg px-4 py-2 bg-black/35">
        <div className="text-[11px] font-mono text-gray-400 leading-relaxed">
          Build evidence like a debugger: run cases, compare their traces, inspect which lines only appear when behavior drifts, then quarantine the smallest suspicious cluster.
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT — program listing */}
        <div className="lg:col-span-2 space-y-3">
          {/* Opcode guide collapsible */}
          <div className="px-1">
            <OpcodeGuide />
          </div>

          {/* Program listing */}
          <div
            className="border border-gray-800 rounded-lg p-2 bg-black/70 space-y-0.5 overflow-y-auto"
            style={{ maxHeight: '60vh' }}
          >
            <div className="px-3 py-1 text-xs text-gray-600 flex gap-3 border-b border-gray-800 mb-1">
              <span className="w-8">ID</span>
              <span className="w-4" />
              <span className="w-12">OP</span>
              <span>OPERANDS + COMMENT</span>
            </div>
            {puzzle.program.map(line => (
              <ProgramLineRow
                key={line.id}
                line={line}
                flagged={flaggedIds.has(line.id)}
                inspected={inspectedLine?.id === line.id}
                tracing={tracingLine === line.id}
                visited={visitedLineIds.has(line.id)}
                solved={serverState.solved}
                onInspect={setInspectedLineId}
                onClick={() => toggleFlag(line.id)}
              />
            ))}
          </div>

          {/* Submit result banner */}
          <AnimatePresence>
            {submitResult?.correct && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-green-500/40 rounded p-3 text-xs font-mono text-green-300 bg-green-900/15"
              >
                {FEEDBACK_TEXT['exact']}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-5">
          <InvestigationWorkbenchPanel
            activeRun={activeRun}
            compareRun={compareRun}
            traceComparison={traceComparison}
            totalRuns={runHistory.length}
            flaggedCount={flaggedIds.size}
            flaggedVisitedCount={flaggedTraceStats.flaggedVisitedCount}
            flaggedUnvisitedCount={flaggedTraceStats.flaggedUnvisitedCount}
            attemptsRemaining={serverState.attemptsRemaining}
            maxAttempts={serverState.maxAttempts}
            locked={serverState.locked}
          />

          <LineEvidencePanel
            line={inspectedLine}
            activeRun={activeRun}
            compareRun={compareRun}
            runs={runHistory}
            flagged={Boolean(inspectedLine && flaggedIds.has(inspectedLine.id))}
          />

          {/* Test inputs */}
          <TestInputPanel
            inputs={puzzle.testInputs}
            activeId={activeInput}
            diagnostics={activeDiagnostics}
            runs={runHistory}
            comparisonId={compareRun?.inputId ?? null}
            onActivate={handleActivateInput}
            onSelectComparison={setComparisonInputId}
          />

          {/* Quarantine workspace */}
          <QuarantinePanel
            flaggedIds={flaggedIds}
            onRemove={id => setFlaggedIds(prev => { const n = new Set(prev); n.delete(id); return n; })}
            onClearAll={() => setFlaggedIds(new Set())}
            onSubmit={handleSubmit}
            onCheckAgain={() => { void loadState(); }}
            submitting={submitting}
            submitResult={submitResult}
            submitError={submitError}
            submissionCount={serverState.submissionCount}
            attemptsUsed={serverState.attemptsUsed}
            attemptsRemaining={serverState.attemptsRemaining}
            maxAttempts={serverState.maxAttempts}
            locked={serverState.locked}
            solved={serverState.solved}
          />
        </div>
      </div>
    </div>
  );
}
